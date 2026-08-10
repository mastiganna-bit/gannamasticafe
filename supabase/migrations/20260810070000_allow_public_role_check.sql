-- Public menu policies coexist with legacy administrator policies that call
-- is_admin(). Anonymous visitors must be able to evaluate that predicate; it
-- safely returns false when auth.uid() is null and exposes no profile data.
begin;

grant execute on function public.is_admin() to anon;

commit;
