-- The original production database already had order_cancellations before the
-- production-foundation migration was introduced. CREATE TABLE IF NOT EXISTS
-- therefore did not add these newer columns.
alter table public.order_cancellations
  add column if not exists item_changes jsonb not null default '[]'::jsonb,
  add column if not exists amount_paise integer not null default 0;

alter table public.order_cancellations
  drop constraint if exists order_cancellations_status_check;
alter table public.order_cancellations
  add constraint order_cancellations_status_check
  check (status in ('requested', 'processing', 'completed', 'failed', 'rejected', 'refunded'));

create or replace function public.finalize_order_cancellation(
  target_order_id uuid,
  target_cancellation_id uuid,
  previous_fulfillment_status text,
  full_cancellation boolean,
  cancelled_amount_paise integer,
  item_changes jsonb,
  refund_state text,
  gateway_refund_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  change jsonb;
  affected integer;
begin
  if cancelled_amount_paise <= 0 then
    raise exception 'Invalid cancellation amount';
  end if;

  if not full_cancellation then
    for change in select * from jsonb_array_elements(item_changes)
    loop
      update public.order_items
      set cancelled_quantity = cancelled_quantity + (change->>'quantity')::integer,
          status = case
            when cancelled_quantity + (change->>'quantity')::integer = quantity then 'cancelled'
            else 'partially_cancelled'
          end,
          cancel_reason = coalesce(change->>'reason', cancel_reason)
      where id = (change->>'orderItemId')::uuid
        and order_id = target_order_id
        and (change->>'quantity')::integer between 1 and (quantity - cancelled_quantity);
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception 'Invalid cancellation item quantity'; end if;
    end loop;
  else
    update public.order_items
    set cancelled_quantity = quantity, status = 'cancelled'
    where order_id = target_order_id and status <> 'cancelled';
  end if;

  update public.orders
  set total_paise = greatest(0, total_paise - cancelled_amount_paise),
      fulfillment_status = case when full_cancellation then 'cancelled' else previous_fulfillment_status end,
      status = case when full_cancellation then 'cancelled' else status end,
      cancelled_at = case when full_cancellation then now() else cancelled_at end,
      refund_status = refund_state,
      refund_id = coalesce(gateway_refund_id, refund_id),
      updated_at = now()
  where id = target_order_id and fulfillment_status = 'cancellation_pending';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Cancellation reservation was lost'; end if;

  update public.order_cancellations
  set status = 'completed', resolved_at = now()
  where id = target_cancellation_id;
end;
$$;

revoke all on function public.finalize_order_cancellation(uuid,uuid,text,boolean,integer,jsonb,text,text)
  from public, anon, authenticated;
grant execute on function public.finalize_order_cancellation(uuid,uuid,text,boolean,integer,jsonb,text,text)
  to service_role;
