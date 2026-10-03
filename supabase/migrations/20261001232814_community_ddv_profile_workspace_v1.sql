create table public.ddv_profile_workspaces (
  workspace_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  relationship_kind text not null default 'self'
    check (relationship_kind in ('self','parent_guardian_managed')),
  created_at timestamptz not null default now(),
  unique (workspace_id,account_id)
);

create index ddv_profile_workspaces_account_created_idx
  on public.ddv_profile_workspaces(account_id,created_at,workspace_id);

alter table public.ddv_profile_workspaces enable row level security;

create policy ddv_profile_workspaces_owner_read
on public.ddv_profile_workspaces
for select
to authenticated
using (
  account_id=private.current_wand_account_id()
  or private.is_staff()
);

revoke all on table public.ddv_profile_workspaces from public,anon,authenticated;
grant select on table public.ddv_profile_workspaces to authenticated;
grant select,insert,update,delete on table public.ddv_profile_workspaces to service_role;

create table private.ddv_identity_associations (
  workspace_id uuid primary key,
  account_id uuid not null,
  binding_key_hash text not null
    check (binding_key_hash ~ '^hmac-sha256:v1:[0-9a-f]{64}$'),
  associated_at timestamptz not null default now(),
  constraint ddv_identity_associations_workspace_account_fkey
    foreign key (workspace_id,account_id)
    references public.ddv_profile_workspaces(workspace_id,account_id)
    on delete cascade,
  constraint ddv_identity_associations_account_hash_uq
    unique (account_id,binding_key_hash)
);

create index ddv_identity_associations_account_idx
  on private.ddv_identity_associations(account_id,associated_at,workspace_id);

revoke all on table private.ddv_identity_associations from public,anon,authenticated;
grant select,insert,update,delete on table private.ddv_identity_associations to service_role;

create or replace function private.enforce_ddv_profile_workspace_limit()
returns trigger
language plpgsql
set search_path=pg_catalog,public,private
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('ddv-profile-workspace-account:' || new.account_id::text,0)
  );

  if (
    select count(*)
    from public.ddv_profile_workspaces w
    where w.account_id=new.account_id
      and w.workspace_id<>new.workspace_id
  ) >= 5 then
    raise exception 'DDV_PROFILE_WORKSPACE_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_ddv_profile_workspace_limit()
from public,anon,authenticated,service_role;

create trigger ddv_profile_workspaces_limit
before insert or update of account_id
on public.ddv_profile_workspaces
for each row execute function private.enforce_ddv_profile_workspace_limit();

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
  v_created_at timestamptz;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_relationship_kind not in ('self','parent_guardian_managed') then
    raise exception 'Unsupported DDV Profile Workspace relationship kind';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ddv-profile-workspace-account:' || v_account_id::text,0)
  );

  insert into public.ddv_profile_workspaces(
    account_id,relationship_kind
  ) values (
    v_account_id,p_relationship_kind
  )
  returning workspace_id,created_at
  into v_workspace_id,v_created_at;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,'ddv_profile_workspace.created',null,
    jsonb_build_object(
      'workspaceId',v_workspace_id,
      'relationshipKind',p_relationship_kind
    )
  );

  return jsonb_build_object(
    'workspaceId',v_workspace_id,
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
        'relationshipKind',w.relationship_kind,
        'identityAssociated',(a.workspace_id is not null),
        'identityAssociatedAt',a.associated_at,
        'createdAt',w.created_at
      )
      order by w.created_at,w.workspace_id
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

create or replace function public.community_associate_ddv_identity_v1(
  p_auth_subject uuid,
  p_workspace_id uuid,
  p_binding_key_hash text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_existing private.ddv_identity_associations%rowtype;
  v_associated_at timestamptz;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_binding_key_hash is null
     or p_binding_key_hash !~ '^hmac-sha256:v1:[0-9a-f]{64}$' then
    raise exception 'Invalid DDV identity digest';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ddv-profile-workspace-account:' || v_account_id::text,
      0
    )
  );
  perform pg_advisory_xact_lock(
    hashtextextended(
      'ddv-identity-account:' || v_account_id::text || ':' || p_binding_key_hash,
      0
    )
  );

  if not exists (
    select 1
    from public.ddv_profile_workspaces w
    where w.workspace_id=p_workspace_id
      and w.account_id=v_account_id
  ) then
    raise exception 'DDV Profile Workspace not found';
  end if;

  select * into v_existing
  from private.ddv_identity_associations a
  where a.workspace_id=p_workspace_id
  for update;

  if v_existing.workspace_id is not null then
    if v_existing.binding_key_hash=p_binding_key_hash then
      return jsonb_build_object(
        'workspaceId',p_workspace_id,
        'identityAssociated',true,
        'associatedAt',v_existing.associated_at,
        'replayed',true
      );
    end if;
    raise exception 'DDV_IDENTITY_ASSOCIATION_EXISTS';
  end if;

  if exists (
    select 1
    from private.ddv_identity_associations a
    where a.account_id=v_account_id
      and a.binding_key_hash=p_binding_key_hash
      and a.workspace_id<>p_workspace_id
  ) then
    raise exception 'DDV_IDENTITY_ALREADY_ASSOCIATED_IN_ACCOUNT';
  end if;

  insert into private.ddv_identity_associations(
    workspace_id,account_id,binding_key_hash
  ) values (
    p_workspace_id,v_account_id,p_binding_key_hash
  )
  returning associated_at into v_associated_at;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,'ddv_profile_workspace.identity_associated',null,
    jsonb_build_object('workspaceId',p_workspace_id)
  );

  return jsonb_build_object(
    'workspaceId',p_workspace_id,
    'identityAssociated',true,
    'associatedAt',v_associated_at,
    'replayed',false
  );
end;
$$;

create or replace function public.community_unlink_ddv_identity_v1(
  p_auth_subject uuid,
  p_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_deleted integer;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if not exists (
    select 1
    from public.ddv_profile_workspaces w
    where w.workspace_id=p_workspace_id
      and w.account_id=v_account_id
  ) then
    raise exception 'DDV Profile Workspace not found';
  end if;

  delete from private.ddv_identity_associations
  where workspace_id=p_workspace_id
    and account_id=v_account_id;

  get diagnostics v_deleted=row_count;

  if v_deleted>0 then
    insert into public.audit_events(
      actor_account_id,action_type,target_entity_id,metadata
    ) values (
      v_account_id,'ddv_profile_workspace.identity_unlinked',null,
      jsonb_build_object('workspaceId',p_workspace_id)
    );
  end if;

  return jsonb_build_object(
    'workspaceId',p_workspace_id,
    'identityAssociated',false,
    'unlinked',(v_deleted>0)
  );
end;
$$;

revoke execute on function public.community_create_ddv_profile_workspace_v1(uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_get_ddv_profile_workspaces_v1(uuid)
from public,anon,authenticated;
revoke execute on function public.community_associate_ddv_identity_v1(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_unlink_ddv_identity_v1(uuid,uuid)
from public,anon,authenticated;

grant execute on function public.community_create_ddv_profile_workspace_v1(uuid,text)
to service_role;
grant execute on function public.community_get_ddv_profile_workspaces_v1(uuid)
to service_role;
grant execute on function public.community_associate_ddv_identity_v1(uuid,uuid,text)
to service_role;
grant execute on function public.community_unlink_ddv_identity_v1(uuid,uuid)
to service_role;

comment on table public.ddv_profile_workspaces is
  'Wand-owned DDV Profile Workspace. mdc/Player ID association is optional and stored separately.';
comment on table private.ddv_identity_associations is
  'Private optional mdc/Player ID digest association. Digest is unique only within one Wand Account; cross-account reuse is allowed.';
