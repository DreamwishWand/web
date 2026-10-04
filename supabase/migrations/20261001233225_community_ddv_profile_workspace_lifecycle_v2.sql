alter table public.ddv_profile_workspaces
  add column if not exists slot_index smallint,
  add column if not exists display_name text,
  add column if not exists lifecycle_state text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

with ranked as (
  select
    workspace_id,
    row_number() over (
      partition by account_id
      order by created_at,workspace_id
    )::smallint as slot_index
  from public.ddv_profile_workspaces
)
update public.ddv_profile_workspaces w
set slot_index=r.slot_index
from ranked r
where r.workspace_id=w.workspace_id
  and w.slot_index is null;

alter table public.ddv_profile_workspaces
  alter column slot_index set not null;

alter table public.ddv_profile_workspaces
  drop constraint if exists ddv_profile_workspaces_slot_index_check;
alter table public.ddv_profile_workspaces
  add constraint ddv_profile_workspaces_slot_index_check
  check (slot_index between 1 and 5);

alter table public.ddv_profile_workspaces
  drop constraint if exists ddv_profile_workspaces_lifecycle_state_check;
alter table public.ddv_profile_workspaces
  add constraint ddv_profile_workspaces_lifecycle_state_check
  check (lifecycle_state in ('active','archived'));

alter table public.ddv_profile_workspaces
  drop constraint if exists ddv_profile_workspaces_display_name_check;
alter table public.ddv_profile_workspaces
  add constraint ddv_profile_workspaces_display_name_check
  check (
    display_name is null
    or (
      display_name=btrim(display_name)
      and char_length(display_name) between 1 and 80
    )
  );

create unique index if not exists ddv_profile_workspaces_account_slot_uq
  on public.ddv_profile_workspaces(account_id,slot_index);

create index if not exists ddv_profile_workspaces_account_state_idx
  on public.ddv_profile_workspaces(account_id,lifecycle_state,created_at,workspace_id);

create or replace function public.community_create_ddv_profile_workspace_v1(
  p_auth_subject uuid,
  p_relationship_kind text default 'self'
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_workspace_id uuid;
  v_slot_index smallint;
  v_created_at timestamptz;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_relationship_kind not in ('self','parent_guardian_managed') then
    raise exception 'Unsupported DDV Profile Workspace relationship kind';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ddv-profile-workspace-account:' || v_account_id::text,0)
  );

  select g.slot_index::smallint
  into v_slot_index
  from generate_series(1,5) as g(slot_index)
  where not exists (
    select 1
    from public.ddv_profile_workspaces w
    where w.account_id=v_account_id
      and w.slot_index=g.slot_index
  )
  order by g.slot_index
  limit 1;

  if v_slot_index is null then
    raise exception 'DDV_PROFILE_WORKSPACE_LIMIT_REACHED';
  end if;

  insert into public.ddv_profile_workspaces(
    account_id,
    relationship_kind,
    slot_index
  ) values (
    v_account_id,
    p_relationship_kind,
    v_slot_index
  )
  returning workspace_id,created_at
  into v_workspace_id,v_created_at;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,'ddv_profile_workspace.created',null,
    jsonb_build_object(
      'workspaceId',v_workspace_id,
      'slotIndex',v_slot_index,
      'relationshipKind',p_relationship_kind
    )
  );

  return jsonb_build_object(
    'workspaceId',v_workspace_id,
    'slotIndex',v_slot_index,
    'displayName',null,
    'lifecycleState','active',
    'relationshipKind',p_relationship_kind,
    'identityAssociated',false,
    'createdAt',v_created_at
  );
end;
$$;

create or replace function public.community_get_ddv_profile_workspaces_v1(
  p_auth_subject uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'workspaceId',w.workspace_id,
        'slotIndex',w.slot_index,
        'displayName',w.display_name,
        'lifecycleState',w.lifecycle_state,
        'relationshipKind',w.relationship_kind,
        'identityAssociated',(a.workspace_id is not null),
        'identityAssociatedAt',a.associated_at,
        'createdAt',w.created_at,
        'updatedAt',w.updated_at
      )
      order by w.slot_index,w.workspace_id
    ),
    '[]'::jsonb
  )
  into v_result
  from public.ddv_profile_workspaces w
  left join private.ddv_identity_associations a
    on a.workspace_id=w.workspace_id
   and a.account_id=w.account_id
  where w.account_id=v_account_id;

  return v_result;
end;
$$;

create or replace function public.community_update_ddv_profile_workspace_v1(
  p_auth_subject uuid,
  p_workspace_id uuid,
  p_display_name text,
  p_lifecycle_state text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_workspace public.ddv_profile_workspaces%rowtype;
  v_display_name text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_lifecycle_state not in ('active','archived') then
    raise exception 'Unsupported DDV Profile Workspace lifecycle state';
  end if;

  v_display_name:=case
    when p_display_name is null then null
    else btrim(p_display_name)
  end;

  if v_display_name is not null
     and (
       char_length(v_display_name)<1
       or char_length(v_display_name)>80
     ) then
    raise exception 'DDV Profile Workspace display name must be 1-80 characters';
  end if;

  select * into v_workspace
  from public.ddv_profile_workspaces
  where workspace_id=p_workspace_id
    and account_id=v_account_id
  for update;

  if v_workspace.workspace_id is null then
    raise exception 'DDV Profile Workspace not found';
  end if;

  update public.ddv_profile_workspaces
  set display_name=v_display_name,
      lifecycle_state=p_lifecycle_state,
      updated_at=clock_timestamp()
  where workspace_id=p_workspace_id
    and account_id=v_account_id
  returning * into v_workspace;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,'ddv_profile_workspace.updated',null,
    jsonb_build_object(
      'workspaceId',v_workspace.workspace_id,
      'slotIndex',v_workspace.slot_index,
      'lifecycleState',v_workspace.lifecycle_state,
      'hasCustomDisplayName',(v_workspace.display_name is not null)
    )
  );

  return jsonb_build_object(
    'workspaceId',v_workspace.workspace_id,
    'slotIndex',v_workspace.slot_index,
    'displayName',v_workspace.display_name,
    'lifecycleState',v_workspace.lifecycle_state,
    'relationshipKind',v_workspace.relationship_kind,
    'updatedAt',v_workspace.updated_at
  );
end;
$$;

create or replace function public.community_delete_ddv_profile_workspace_v1(
  p_auth_subject uuid,
  p_workspace_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_workspace public.ddv_profile_workspaces%rowtype;
  v_identity_associated boolean;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_confirmation <> 'DELETE' then
    raise exception 'Explicit DDV Profile Workspace deletion confirmation is required';
  end if;

  select * into v_workspace
  from public.ddv_profile_workspaces
  where workspace_id=p_workspace_id
    and account_id=v_account_id
  for update;

  if v_workspace.workspace_id is null then
    raise exception 'DDV Profile Workspace not found';
  end if;

  select exists (
    select 1
    from private.ddv_identity_associations a
    where a.workspace_id=p_workspace_id
      and a.account_id=v_account_id
  ) into v_identity_associated;

  delete from public.ddv_profile_workspaces
  where workspace_id=p_workspace_id
    and account_id=v_account_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,'ddv_profile_workspace.deleted',null,
    jsonb_build_object(
      'workspaceId',v_workspace.workspace_id,
      'slotIndex',v_workspace.slot_index,
      'relationshipKind',v_workspace.relationship_kind,
      'lifecycleState',v_workspace.lifecycle_state,
      'identityAssociationRemoved',v_identity_associated
    )
  );

  return jsonb_build_object(
    'workspaceId',v_workspace.workspace_id,
    'deleted',true,
    'freedSlotIndex',v_workspace.slot_index
  );
end;
$$;

create or replace function private.community_remove_ddv_profile_workspaces_on_account_delete()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.status='deleted'
     and (
       old.status is distinct from new.status
       or old.deleted_at is distinct from new.deleted_at
     ) then
    delete from public.ddv_profile_workspaces
    where account_id=new.account_id;
  end if;

  return new;
end;
$$;

drop trigger if exists wand_accounts_remove_ddv_profile_workspaces_on_delete
on public.wand_accounts;

create trigger wand_accounts_remove_ddv_profile_workspaces_on_delete
after update of status,deleted_at
on public.wand_accounts
for each row
execute function private.community_remove_ddv_profile_workspaces_on_account_delete();

revoke execute on function private.community_remove_ddv_profile_workspaces_on_account_delete()
from public,anon,authenticated,service_role;

revoke execute on function public.community_update_ddv_profile_workspace_v1(
  uuid,uuid,text,text
) from public,anon,authenticated;

revoke execute on function public.community_delete_ddv_profile_workspace_v1(
  uuid,uuid,text
) from public,anon,authenticated;

grant execute on function public.community_update_ddv_profile_workspace_v1(
  uuid,uuid,text,text
) to service_role;

grant execute on function public.community_delete_ddv_profile_workspace_v1(
  uuid,uuid,text
) to service_role;

comment on column public.ddv_profile_workspaces.slot_index is
  'Stable account-local slot 1-5 used for default localized Profile N presentation. Active and archived workspaces both consume capacity.';
comment on column public.ddv_profile_workspaces.display_name is
  'Optional private custom label. NULL means the client should present the localized default label for slot_index.';
comment on column public.ddv_profile_workspaces.lifecycle_state is
  'Organizational state only. Archived workspaces still count toward the five-workspace account limit.';
comment on function public.community_delete_ddv_profile_workspace_v1(uuid,uuid,text) is
  'Irreversibly removes the Workspace and ON DELETE CASCADE profile-scoped child data. Account/Creator-scoped Community content must not use this cascade.';
