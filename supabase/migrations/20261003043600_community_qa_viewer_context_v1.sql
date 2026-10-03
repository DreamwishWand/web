create or replace function public.community_get_question_v1(
  p_auth_subject uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_result jsonb;
  v_same_here boolean;
  v_same_here_count integer;
  v_utility jsonb;
  v_owned_answers jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_work(p_question_id,v_account_id) then
    raise exception 'Question is not accessible';
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_question_id and work_type='question';
  if v_work.work_id is null then raise exception 'Question not found'; end if;

  v_result:=public.community_get_question_public_v1(p_question_id);

  select exists(
    select 1 from public.qa_same_here
    where account_id=v_account_id and question_id=p_question_id
  ) into v_same_here;

  select count(*)::integer into v_same_here_count
  from public.qa_same_here where question_id=p_question_id;

  select coalesce(jsonb_object_agg(u.answer_id::text,u.utility_kind),'{}'::jsonb)
  into v_utility
  from public.qa_answer_utility u
  join public.qa_answers a on a.answer_id=u.answer_id
  where u.account_id=v_account_id and a.question_id=p_question_id;

  select coalesce(jsonb_agg(a.answer_id order by a.created_at),'[]'::jsonb)
  into v_owned_answers
  from public.qa_answers a
  join public.comments c on c.comment_id=a.answer_id
  where a.question_id=p_question_id
    and c.author_account_id=v_account_id
    and c.lifecycle_state<>'deleted';

  return v_result || jsonb_build_object(
    'isOwner',v_work.owner_account_id=v_account_id,
    'sameHereCount',v_same_here_count,
    'viewerSameHere',v_same_here,
    'viewerAnswerUtility',v_utility,
    'viewerOwnedAnswerIds',v_owned_answers
  );
end
$$;

revoke execute on function public.community_get_question_v1(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.community_get_question_v1(uuid,uuid)
to service_role;
