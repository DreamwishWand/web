insert into private.community_security_config(policy_key,integer_value)
values ('ddv_profile_workspace_delete_recent_auth_seconds',900)
on conflict (policy_key) do update
set integer_value=excluded.integer_value,
    updated_at=now();

insert into private.community_action_rate_policies(bucket,window_seconds,max_actions,enabled)
values
  ('ddv_profile_workspace_write',3600,60,true),
  ('ddv_profile_identity',3600,12,true)
on conflict (bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=now();

update private.community_action_rate_policies
set enabled=false,
    updated_at=now()
where bucket='ddv_profile_link';

create or replace function public.community_delete_ddv_profile_workspace_v1(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
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
  v_delete_window integer;
begin
  if p_confirmation <> 'DELETE' then
    raise exception 'Explicit DDV Profile Workspace deletion confirmation is required';
  end if;

  select integer_value into v_delete_window
  from private.community_security_config
  where policy_key='ddv_profile_workspace_delete_recent_auth_seconds';

  if v_delete_window is null then
    raise exception 'DDV Profile Workspace deletion recent-auth policy is not configured';
  end if;

  v_account_id:=private.require_recent_session(
    p_auth_subject,
    p_session_id,
    p_issued_at_epoch,
    v_delete_window
  );

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
      'identityAssociationRemoved',v_identity_associated,
      'recentAuthRequired',true
    )
  );

  return jsonb_build_object(
    'workspaceId',v_workspace.workspace_id,
    'deleted',true,
    'freedSlotIndex',v_workspace.slot_index
  );
end;
$$;

revoke execute on function public.community_delete_ddv_profile_workspace_v1(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;
grant execute on function public.community_delete_ddv_profile_workspace_v1(
  uuid,uuid,bigint,uuid,text
) to service_role;

revoke execute on function public.community_delete_ddv_profile_workspace_v1(
  uuid,uuid,text
) from public,anon,authenticated,service_role;
drop function public.community_delete_ddv_profile_workspace_v1(uuid,uuid,text);

comment on function public.community_delete_ddv_profile_workspace_v1(
  uuid,uuid,bigint,uuid,text
) is
  'Irreversibly removes the Workspace and Workspace-scoped child data after explicit DELETE confirmation and session-bound recent authentication (default 900 seconds). Account/Creator-scoped Community content must not use this cascade.';
