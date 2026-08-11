alter table public.delivery_locations
  add column if not exists accuracy numeric;

alter table public.delivery_locations
  drop constraint if exists delivery_locations_accuracy_check;
alter table public.delivery_locations
  add constraint delivery_locations_accuracy_check
  check (accuracy is null or accuracy between 0 and 10000);
