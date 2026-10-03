insert into private.community_security_config(policy_key,integer_value,updated_at)
values ('moderation_staff_recent_auth_seconds',900,now())
on conflict(policy_key) do update
set integer_value=excluded.integer_value,
    updated_at=excluded.updated_at;

create or replace function private.require_recent_moderation_staff(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_window integer;
  v_account_id uuid;
begin
  select integer_value into v_window
  from private.community_security_config
  where policy_key='moderation_staff_recent_auth_seconds';

  if v_window is null then
    raise exception 'Moderation staff recent-auth policy is not configured';
  end if;

  v_account_id:=private.require_recent_session(
    p_auth_subject,p_session_id,p_issued_at_epoch,v_window
  );

  if not exists(
    select 1 from public.account_roles
    where account_id=v_account_id
      and role in ('moderator','admin')
  ) then
    raise exception 'Moderator or admin role required';
  end if;

  return v_account_id;
end;
$$;

create or replace function public.community_get_moderation_cases(
  p_admin_auth_subject uuid,
  p_state text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_staff_account_id uuid;
  v_result jsonb;
begin
  v_staff_account_id:=private.resolve_active_account(p_admin_auth_subject);

  if not exists(
    select 1 from public.account_roles
    where account_id=v_staff_account_id
      and role in ('moderator','admin')
  ) then
    raise exception 'Moderator or admin role required';
  end if;

  if p_state is not null
     and p_state not in ('open','reviewing','resolved','closed') then
    raise exception 'Unsupported moderation-case state';
  end if;

  if p_limit<1 or p_limit>200 then
    raise exception 'p_limit must be between 1 and 200';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'caseId',c.case_id,
        'targetEntityId',c.target_entity_id,
        'targetEntityType',e.entity_type,
        'status',c.status,
        'createdAt',c.created_at,
        'updatedAt',c.updated_at,
        'work',case
          when w.work_id is null then null
          else jsonb_build_object(
            'workId',w.work_id,
            'workType',w.work_type,
            'creatorProfileId',w.creator_profile_id,
            'lifecycleState',w.lifecycle_state,
            'visibility',w.visibility,
            'moderationState',w.moderation_state,
            'title',g.title
          )
        end,
        'reports',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'reportId',r.report_id,
              'reasonCode',r.reason_code,
              'detail',r.detail,
              'status',r.status,
              'createdAt',r.created_at,
              'updatedAt',r.updated_at
            )
            order by r.created_at,r.report_id
          )
          from public.moderation_case_reports mcr
          join public.reports r on r.report_id=mcr.report_id
          where mcr.case_id=c.case_id
        ),'[]'::jsonb),
        'actions',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'actionId',a.action_id,
              'actionType',a.action_type,
              'reason',a.reason,
              'priorState',a.prior_state,
              'resultingState',a.resulting_state,
              'createdAt',a.created_at
            )
            order by a.created_at,a.action_id
          )
          from public.moderation_actions a
          where a.case_id=c.case_id
        ),'[]'::jsonb)
      )
      order by
        case c.status when 'open' then 0 when 'reviewing' then 1 else 2 end,
        c.updated_at desc,c.case_id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.moderation_cases
    where p_state is null or status=p_state
    order by
      case status when 'open' then 0 when 'reviewing' then 1 else 2 end,
      updated_at desc,case_id
    limit p_limit
  ) c
  left join public.community_entities e on e.entity_id=c.target_entity_id
  left join public.community_works w on w.work_id=c.target_entity_id
  left join public.gallery_work_revisions g
    on g.revision_id=w.current_published_revision_id;

  return v_result;
end;
$$;

create or replace function public.community_moderate_work_v2(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_case_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_staff_account_id uuid;
  v_result jsonb;
  v_reports_closed integer:=0;
begin
  v_staff_account_id:=private.require_recent_moderation_staff(
    p_auth_subject,p_session_id,p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>1000 then
    raise exception 'Moderation reason must be 8-1000 characters';
  end if;

  v_result:=public.community_moderate_work(
    p_auth_subject,p_case_id,p_action,btrim(p_reason)
  );

  update public.reports r
  set status='closed',
      updated_at=now()
  where r.report_id in (
    select mcr.report_id
    from public.moderation_case_reports mcr
    where mcr.case_id=p_case_id
  )
    and r.status in ('open','triaged');

  get diagnostics v_reports_closed=row_count;

  return v_result || jsonb_build_object(
    'reportsClosed',v_reports_closed,
    'staffAccountId',v_staff_account_id
  );
end;
$$;

create or replace function public.community_get_security_policy_summary(
  p_admin_auth_subject uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_account_delete integer;
  v_support_admin integer;
  v_moderation_staff integer;
begin
  v_admin_account_id:=private.resolve_active_account(p_admin_auth_subject);

  if not exists(
    select 1 from public.account_roles
    where account_id=v_admin_account_id
      and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  select integer_value into v_account_delete
  from private.community_security_config
  where policy_key='account_delete_recent_auth_seconds';

  select integer_value into v_support_admin
  from private.community_security_config
  where policy_key='support_admin_recent_auth_seconds';

  select integer_value into v_moderation_staff
  from private.community_security_config
  where policy_key='moderation_staff_recent_auth_seconds';

  if v_account_delete is null
     or v_support_admin is null
     or v_moderation_staff is null then
    raise exception 'Recent-auth launch policy is incomplete';
  end if;

  return jsonb_build_object(
    'accountDeleteRecentAuthSeconds',v_account_delete,
    'supportAdminRecentAuthSeconds',v_support_admin,
    'moderationStaffRecentAuthSeconds',v_moderation_staff,
    'sessionBound',true,
    'source','auth.sessions.created_at'
  );
end;
$$;

revoke execute on function private.require_recent_moderation_staff(uuid,uuid,bigint)
from public,anon,authenticated,service_role;

revoke execute on function public.community_get_moderation_cases(uuid,text,integer)
from public,anon,authenticated;

revoke execute on function public.community_moderate_work_v2(
  uuid,uuid,bigint,uuid,text,text
) from public,anon,authenticated;

grant execute on function public.community_get_moderation_cases(uuid,text,integer)
to service_role;

grant execute on function public.community_moderate_work_v2(
  uuid,uuid,bigint,uuid,text,text
) to service_role;
