create or replace function private.mark_platform_admin_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set must_change_password = true
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists platform_admin_password_flag on public.platform_admins;
create trigger platform_admin_password_flag
after insert on public.platform_admins
for each row execute function private.mark_platform_admin_password_change();

update public.profiles p
set must_change_password = true
where exists (select 1 from public.platform_admins pa where pa.user_id = p.id);
