create or replace function private.current_org_role(p_org_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select private.is_platform_admin()) then 'owner'::public.app_role
    else (
      select om.role
      from public.organization_members om
      where om.organization_id = p_org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
      limit 1
    )
  end
$$;

create or replace function private.has_org_access(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin())
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = p_org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
$$;

create or replace function private.can_access_branch(p_org_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and (om.role = 'owner' or om.branch_id = p_branch_id)
    )
$$;

create or replace function private.can_manage_branch(p_org_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and (om.role = 'owner' or (om.role = 'manager' and om.branch_id = p_branch_id))
    )
$$;

create or replace function private.can_manage_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin())
    or (select private.current_org_role(p_org_id)) = 'owner'
$$;
