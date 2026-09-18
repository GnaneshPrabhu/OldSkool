alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

update public.profiles p
set must_change_password = true
where exists (
  select 1 from public.organization_members om
  where om.user_id = p.id
);

comment on column public.profiles.must_change_password is
  'Forces the signed-in user to replace an administrator-provided/default password before accessing the workspace.';
