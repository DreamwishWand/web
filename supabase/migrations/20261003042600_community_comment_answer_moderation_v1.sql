create or replace function public.community_moderate_entity_v4(
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
  v_target uuid;
  v_entity_type public.community_entity_type;
  v_comment public.comments%rowtype;
  v_prior public.moderation_state;
  v_next public.moderation_state;
  v_action_id uuid;
  v_reports_closed integer:=0;
  v_question_id uuid;
  v_work_result jsonb;
begin
  if coalesce(length(btrim(p_reason)),0)<8 or length(btrim(p_reason))>1000 then
    raise exception 'Moderation reason must be 8-1000 characters';
  end if;

  select mc.target_entity_id,e.entity_type
  into v_target,v_entity_type
  from public.moderation_cases mc
  join public.community_entities e on e.entity_id=mc.target_entity_id
  where mc.case_id=p_case_id
  for update of mc;

  if v_target is null then raise exception 'Moderation case not found'; end if;

  if v_entity_type='community_work' then
    return public.community_moderate_work_v3(
      p_auth_subject,p_session_id,p_issued_at_epoch,p_case_id,p_action,btrim(p_reason)
    );
  end if;

  if v_entity_type<>'comment' then
    raise exception 'Moderation target type is not supported';
  end if;

  v_staff_account_id:=private.require_recent_moderation_staff(
    p_auth_subject,p_session_id,p_issued_at_epoch
  );

  select * into v_comment
  from public.comments
  where comment_id=v_target
  for update;
  if v_comment.comment_id is null then raise exception 'Comment target not found'; end if;

  v_prior:=v_comment.moderation_state;
  if p_action='restrict' then v_next:='restricted';
  elsif p_action='remove' then v_next:='removed';
  elsif p_action='restore' then v_next:='clear';
  else raise exception 'Unsupported moderation action'; end if;

  update public.comments
  set moderation_state=v_next,
      updated_at=now(),
      row_version=row_version+1
  where comment_id=v_target
  returning * into v_comment;

  insert into public.moderation_actions(
    case_id,actor_account_id,action_type,reason,prior_state,resulting_state
  ) values(
    p_case_id,v_staff_account_id,p_action,btrim(p_reason),
    jsonb_build_object('moderationState',v_prior),
    jsonb_build_object('moderationState',v_next)
  ) returning action_id into v_action_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_staff_account_id,'moderation.' || p_action,v_target,
    jsonb_build_object('caseId',p_case_id,'actionId',v_action_id,'entityType','comment')
  );

  select a.question_id into v_question_id
  from public.qa_answers a
  where a.answer_id=v_target;

  if v_question_id is not null and v_next<>'clear' then
    update public.qa_question_state
    set accepted_answer_id=case when accepted_answer_id=v_target then null else accepted_answer_id end,
        resolution_state=case
          when accepted_answer_id=v_target and solution_note is null then 'unresolved'
          else resolution_state
        end,
        updated_at=now()
    where work_id=v_question_id;

    update public.search_documents d
    set facets=d.facets || jsonb_build_object(
      'resolutionState',(
        select resolution_state
        from public.qa_question_state
        where work_id=v_question_id
      )
    ),
    updated_at=now()
    where d.work_id=v_question_id;
  end if;

  update public.reports r
  set status='closed',updated_at=now()
  where r.report_id in (
    select mcr.report_id
    from public.moderation_case_reports mcr
    where mcr.case_id=p_case_id
  )
    and r.status in ('open','triaged');
  get diagnostics v_reports_closed=row_count;

  update public.moderation_cases
  set status='resolved',updated_at=now()
  where case_id=p_case_id;

  insert into public.outbox_events(
    aggregate_type,aggregate_id,event_type,payload,dedupe_key
  ) values(
    'comment',v_target,'moderation.' || p_action,
    jsonb_build_object(
      'commentId',v_target,'caseId',p_case_id,'actionId',v_action_id,
      'questionId',v_question_id
    ),
    'moderation:' || v_action_id::text
  );

  return jsonb_build_object(
    'targetEntityId',v_target,
    'entityType','comment',
    'actionId',v_action_id,
    'moderationState',v_next,
    'reportsClosed',v_reports_closed,
    'staffAccountId',v_staff_account_id
  );
end
$$;

revoke execute on function public.community_moderate_entity_v4(uuid,uuid,bigint,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.community_moderate_entity_v4(uuid,uuid,bigint,uuid,text,text)
to service_role;
