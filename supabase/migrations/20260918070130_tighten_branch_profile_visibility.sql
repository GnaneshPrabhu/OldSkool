create or replace function private.can_access_branch(p_org_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and (
        om.role = 'owner'
        or om.branch_id = p_branch_id
      )
  )
$$;

create or replace function private.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members target
    join public.organization_members viewer
      on viewer.organization_id = target.organization_id
    where target.user_id = p_user_id
      and target.status = 'active'
      and viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and (
        viewer.role = 'owner'
        or viewer.branch_id = target.branch_id
      )
  )
$$;

revoke execute on function private.can_view_profile(uuid) from public;
grant execute on function private.can_view_profile(uuid) to authenticated;

drop policy if exists "memberships_read" on public.organization_members;
create policy "organization_members_branch_scoped_read"
on public.organization_members
for select
to authenticated
using (
  private.can_access_branch(organization_members.organization_id, organization_members.branch_id)
);

drop policy if exists "platform admins can view profiles" on public.profiles;
drop policy if exists "profile_self_read" on public.profiles;
create policy "profiles_branch_scoped_read"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_platform_admin()
  or private.can_view_profile(id)
);
