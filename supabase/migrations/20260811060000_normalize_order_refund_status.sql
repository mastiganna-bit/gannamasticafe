alter table public.orders
  drop constraint if exists orders_refund_status_check;

update public.orders
set refund_status = case refund_status
  when 'none' then 'not_required'
  when 'processing' then 'pending'
  when 'refunded' then 'processed'
  else refund_status
end
where refund_status in ('none', 'processing', 'refunded');

alter table public.orders
  alter column refund_status set default 'not_required';

alter table public.orders
  add constraint orders_refund_status_check
  check (refund_status in ('not_required', 'pending', 'processed', 'failed'));
