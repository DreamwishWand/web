
create table if not exists public.qa_question_redirects (
  question_id uuid primary key references public.community_works(work_id) on delete cascade,
  target_question_id uuid not null references public.community_works(work_id) on delete cascade,
  redirect_kind text not null default 'duplicate' check (redirect_kind='duplicate'),
  created_at timestamptz not null default now(),
  check (question_id<>target_question_id)
);
alter table public.qa_question_redirects enable row level security;
revoke all on public.qa_question_redirects from public,anon,authenticated;
grant select,insert,update,delete on public.qa_question_redirects to service_role;

create or replace function public.community_ask_question_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_title text,
  p_body text,
  p_context_tags text[],
  p_platform text default null,
  p_game_version text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work_id uuid;
  v_revision_id uuid;
  v_work public.community_works%rowtype;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Question title must be 1-240 characters';
  end if;
  if coalesce(char_length(btrim(p_body)),0) not between 1 and 20000 then
    raise exception 'Question body must be 1-20000 characters';
  end if;
  if p_context_tags is null or cardinality(p_context_tags) not between 1 and 20 then
    raise exception 'Question requires 1-20 structured Context Tags';
  end if;
  if exists(select 1 from unnest(p_context_tags) t where t is null or btrim(t)='') then
    raise exception 'Context Tags cannot be empty';
  end if;
  if (select count(*) from unnest(p_context_tags) t)
     <> (select count(distinct t) from unnest(p_context_tags) t) then
    raise exception 'Context Tags must be unique';
  end if;
  if p_platform is not null and char_length(btrim(p_platform))>80 then
    raise exception 'Platform value exceeds 80 characters';
  end if;
  if p_game_version is not null and char_length(btrim(p_game_version))>80 then
    raise exception 'Game version value exceeds 80 characters';
  end if;
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
      and c.moderation_state='clear'
  ) then raise exception 'CreatorProfile is not owned by actor or is unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','ask_question_v1',p_creator_profile_id::text,btrim(p_title),btrim(p_body),
      array_to_string(p_context_tags,','),coalesce(p_platform,''),coalesce(p_game_version,'')
    ),'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'ask_question_v1',v_request_hash);

  v_work_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values(v_work_id,'community_work');
  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
  ) values(v_work_id,v_account_id,p_creator_profile_id,'question','draft','public');
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_work_id,private.community_origin_kind_for_account(v_account_id));

  v_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata,sealed_at
  ) values(
    v_revision_id,v_work_id,1,v_account_id,
    jsonb_build_object('origin','qa-golden-v1'),now()
  );
  insert into public.qa_question_revisions(
    revision_id,title,body,context_tags,platform,game_version
  ) values(
    v_revision_id,btrim(p_title),btrim(p_body),p_context_tags,
    nullif(btrim(coalesce(p_platform,'')),''),
    nullif(btrim(coalesce(p_game_version,'')),'')
  );
  insert into public.qa_question_state(work_id) values(v_work_id);

  update public.community_works
  set lifecycle_state='published',
      current_published_revision_id=v_revision_id,
      published_at=now(),updated_at=now()
  where work_id=v_work_id returning * into v_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_work_id,v_work_id,'question',p_creator_profile_id,btrim(p_title),btrim(p_body),p_context_tags,
    jsonb_strip_nulls(jsonb_build_object(
      'freshness','current','resolutionState','unresolved',
      'platform',nullif(btrim(coalesce(p_platform,'')),''),
      'gameVersion',nullif(btrim(coalesce(p_game_version,'')),'')
    )),
    v_work.published_at,now()
  );

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_work_id,'question.published',
    jsonb_build_object('questionId',v_work_id,'revisionId',v_revision_id,'contextTags',to_jsonb(p_context_tags)),
    'question.published:' || v_revision_id::text
  );

  v_response:=jsonb_build_object(
    'questionId',v_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_add_answer_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_question_id uuid,
  p_body text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_answer_id uuid;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_body)),0) not between 1 and 20000 then
    raise exception 'Answer body must be 1-20000 characters';
  end if;
  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id and c.owner_account_id=v_account_id
  ) then raise exception 'CreatorProfile is not owned by actor'; end if;
  if not exists(
    select 1
    from public.community_works w
    join public.qa_question_state qs on qs.work_id=w.work_id
    where w.work_id=p_question_id
      and w.work_type='question'
      and w.lifecycle_state='published'
      and w.visibility='public'
      and w.moderation_state='clear'
      and qs.freshness='current'
  ) then raise exception 'Question is not current and available for answers'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','add_answer_v1',p_creator_profile_id::text,p_question_id::text,btrim(p_body)),
    'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'add_answer_v1',v_request_hash);

  v_answer_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values(v_answer_id,'comment');
  insert into public.comments(
    comment_id,target_entity_id,author_account_id,creator_profile_id,parent_comment_id,body
  ) values(
    v_answer_id,p_question_id,v_account_id,p_creator_profile_id,null,btrim(p_body)
  );
  insert into public.qa_answers(answer_id,question_id)
  values(v_answer_id,p_question_id);
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_answer_id,private.community_origin_kind_for_account(v_account_id));

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'comment',v_answer_id,'answer.created',
    jsonb_build_object('answerId',v_answer_id,'questionId',p_question_id,'actorAccountId',v_account_id),
    'answer.created:' || v_answer_id::text
  );

  v_response:=jsonb_build_object('answerId',v_answer_id,'questionId',p_question_id);
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_set_same_here_v1(
  p_auth_subject uuid,
  p_question_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_count integer;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if p_active then
    if not exists(
      select 1 from public.community_works w
      join public.qa_question_state qs on qs.work_id=w.work_id
      where w.work_id=p_question_id
        and w.work_type='question'
        and w.lifecycle_state='published'
        and w.visibility='public'
        and w.moderation_state='clear'
        and qs.resolution_state='unresolved'
        and qs.freshness='current'
    ) then raise exception 'Same Here requires a CURRENT + UNRESOLVED Question'; end if;
    insert into public.qa_same_here(account_id,question_id)
    values(v_account_id,p_question_id)
    on conflict do nothing;
  else
    delete from public.qa_same_here
    where account_id=v_account_id and question_id=p_question_id;
  end if;

  select count(*)::integer into v_count
  from public.qa_same_here where question_id=p_question_id;

  return jsonb_build_object(
    'questionId',p_question_id,'sameHere',p_active,'sameHereCount',v_count
  );
end
$$;

create or replace function public.community_set_answer_utility_v1(
  p_auth_subject uuid,
  p_answer_id uuid,
  p_utility_kind text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_account_id uuid;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_entity(p_answer_id,v_account_id) then
    raise exception 'Answer is not accessible';
  end if;
  if not exists(
    select 1 from public.qa_answers a
    join public.comments c on c.comment_id=a.answer_id
    where a.answer_id=p_answer_id and c.lifecycle_state<>'deleted' and c.moderation_state='clear'
  ) then raise exception 'Answer is unavailable'; end if;

  if p_utility_kind is null then
    delete from public.qa_answer_utility
    where account_id=v_account_id and answer_id=p_answer_id;
  else
    if p_utility_kind not in ('helpful','worked_for_me','doesnt_work_for_me') then
      raise exception 'Unsupported Answer utility state';
    end if;
    insert into public.qa_answer_utility(account_id,answer_id,utility_kind,updated_at)
    values(v_account_id,p_answer_id,p_utility_kind,now())
    on conflict(account_id,answer_id) do update
    set utility_kind=excluded.utility_kind,updated_at=now();
  end if;

  return jsonb_build_object('answerId',p_answer_id,'utility',p_utility_kind);
end
$$;

create or replace function public.community_resolve_question_v1(
  p_auth_subject uuid,
  p_question_id uuid,
  p_accepted_answer_id uuid default null,
  p_solution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_note text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not exists(
    select 1 from public.community_works w
    join public.qa_question_state qs on qs.work_id=w.work_id
    where w.work_id=p_question_id
      and w.work_type='question'
      and w.owner_account_id=v_account_id
      and w.lifecycle_state='published'
      and qs.freshness='current'
  ) then raise exception 'Actor does not own a CURRENT Question'; end if;

  v_note:=nullif(btrim(coalesce(p_solution_note,'')),'');
  if p_accepted_answer_id is null and v_note is null then
    raise exception 'Solved Question requires Accepted Answer or Solution Note';
  end if;
  if v_note is not null and char_length(v_note)>10000 then
    raise exception 'Solution Note exceeds 10000 characters';
  end if;

  if p_accepted_answer_id is not null and not exists(
    select 1
    from public.qa_answers a
    join public.comments c on c.comment_id=a.answer_id
    where a.answer_id=p_accepted_answer_id
      and a.question_id=p_question_id
      and a.freshness='current'
      and c.lifecycle_state<>'deleted'
      and c.moderation_state='clear'
  ) then raise exception 'Accepted Answer is not a CURRENT Answer on this Question'; end if;

  update public.qa_question_state
  set resolution_state='solved',
      accepted_answer_id=p_accepted_answer_id,
      solution_note=v_note,
      updated_at=now()
  where work_id=p_question_id;

  update public.search_documents
  set facets=facets || jsonb_build_object('resolutionState','solved'),updated_at=now()
  where work_id=p_question_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',p_question_id,'question.solved',
    jsonb_build_object(
      'questionId',p_question_id,'acceptedAnswerId',p_accepted_answer_id,
      'hasSolutionNote',v_note is not null
    ),
    'question.solved:' || p_question_id::text || ':' ||
      extract(epoch from clock_timestamp())::bigint::text
  );

  return jsonb_build_object(
    'questionId',p_question_id,'resolutionState','solved',
    'acceptedAnswerId',p_accepted_answer_id,'solutionNote',v_note
  );
end
$$;

create or replace function public.community_create_tip_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_title text,
  p_body text,
  p_context_tags text[] default null,
  p_platform text default null,
  p_game_version text default null,
  p_source_question_id uuid default null,
  p_source_answer_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work_id uuid;
  v_revision_id uuid;
  v_work public.community_works%rowtype;
  v_tags text[];
  v_platform text;
  v_game_version text;
  v_source_question uuid;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_title)),0) not between 1 and 240 then
    raise exception 'Tip title must be 1-240 characters';
  end if;
  if coalesce(char_length(btrim(p_body)),0) not between 1 and 20000 then
    raise exception 'Tip body must be 1-20000 characters';
  end if;
  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id and c.owner_account_id=v_account_id
  ) then raise exception 'CreatorProfile is not owned by actor'; end if;

  v_tags:=p_context_tags;
  v_platform:=nullif(btrim(coalesce(p_platform,'')),'');
  v_game_version:=nullif(btrim(coalesce(p_game_version,'')),'');
  v_source_question:=p_source_question_id;

  if p_source_answer_id is not null then
    select a.question_id,qr.context_tags,qr.platform,qr.game_version
    into v_source_question,v_tags,v_platform,v_game_version
    from public.qa_answers a
    join public.comments c on c.comment_id=a.answer_id
    join public.community_works qw on qw.work_id=a.question_id
    join public.qa_question_revisions qr on qr.revision_id=qw.current_published_revision_id
    where a.answer_id=p_source_answer_id
      and c.author_account_id=v_account_id
      and c.lifecycle_state<>'deleted';
    if v_source_question is null then
      raise exception 'Only the Answer author may Create Tip from this Answer';
    end if;
    if p_source_question_id is not null and p_source_question_id<>v_source_question then
      raise exception 'Source Question does not match Answer';
    end if;
  end if;

  if v_tags is null or cardinality(v_tags) not between 1 and 20 then
    raise exception 'Tip requires 1-20 structured Context Tags';
  end if;
  if exists(select 1 from unnest(v_tags) t where t is null or btrim(t)='') then
    raise exception 'Context Tags cannot be empty';
  end if;
  if (select count(*) from unnest(v_tags) t)
     <> (select count(distinct t) from unnest(v_tags) t) then
    raise exception 'Context Tags must be unique';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(
    concat_ws('|','create_tip_v1',p_creator_profile_id::text,btrim(p_title),btrim(p_body),
      array_to_string(v_tags,','),coalesce(v_platform,''),coalesce(v_game_version,''),
      coalesce(v_source_question::text,''),coalesce(p_source_answer_id::text,'')
    ),'sha256'
  ),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'create_tip_v1',v_request_hash);

  v_work_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type) values(v_work_id,'community_work');
  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
  ) values(v_work_id,v_account_id,p_creator_profile_id,'tip','draft','public');
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_work_id,private.community_origin_kind_for_account(v_account_id));

  v_revision_id:=gen_random_uuid();
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata,sealed_at
  ) values(
    v_revision_id,v_work_id,1,v_account_id,jsonb_build_object('origin','qa-golden-v1'),now()
  );
  insert into public.qa_tip_revisions(
    revision_id,title,body,context_tags,platform,game_version,source_question_id,source_answer_id
  ) values(
    v_revision_id,btrim(p_title),btrim(p_body),v_tags,v_platform,v_game_version,
    v_source_question,p_source_answer_id
  );
  insert into public.qa_tip_state(work_id) values(v_work_id);

  update public.community_works
  set lifecycle_state='published',current_published_revision_id=v_revision_id,
      published_at=now(),updated_at=now()
  where work_id=v_work_id returning * into v_work;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_work_id,v_work_id,'tip',p_creator_profile_id,btrim(p_title),btrim(p_body),v_tags,
    jsonb_strip_nulls(jsonb_build_object(
      'freshness','current','platform',v_platform,'gameVersion',v_game_version,
      'sourceQuestionId',v_source_question,'sourceAnswerId',p_source_answer_id
    )),v_work.published_at,now()
  );

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values(
    'community_work',v_work_id,'tip.published',
    jsonb_build_object(
      'tipId',v_work_id,'revisionId',v_revision_id,
      'sourceQuestionId',v_source_question,'sourceAnswerId',p_source_answer_id
    ),
    'tip.published:' || v_revision_id::text
  );

  v_response:=jsonb_build_object('tipId',v_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version);
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_set_qa_freshness_v1(
  p_auth_subject uuid,
  p_target_entity_id uuid,
  p_freshness text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_comment public.comments%rowtype;
  v_title text;
  v_body text;
  v_tags text[];
  v_platform text;
  v_game_version text;
  v_state text;
begin
  if p_freshness not in ('current','needs_recheck') then
    raise exception 'Unsupported freshness state';
  end if;
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select * into v_work from public.community_works where work_id=p_target_entity_id;
  if v_work.work_id is not null and v_work.work_type in ('question','tip') then
    if v_work.owner_account_id<>v_account_id and not private.is_staff(v_account_id) then
      raise exception 'Actor does not own Q&A Work';
    end if;
    if v_work.work_type='question' then
      update public.qa_question_state
      set freshness=p_freshness,updated_at=now()
      where work_id=v_work.work_id;
      if p_freshness='current'
         and v_work.lifecycle_state='published' and v_work.visibility='public' and v_work.moderation_state='clear' then
        select qr.title,qr.body,qr.context_tags,qr.platform,qr.game_version,qs.resolution_state
        into v_title,v_body,v_tags,v_platform,v_game_version,v_state
        from public.qa_question_revisions qr
        join public.qa_question_state qs on qs.work_id=v_work.work_id
        where qr.revision_id=v_work.current_published_revision_id;
        insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(
          v_work.work_id,v_work.work_id,'question',v_work.creator_profile_id,v_title,v_body,v_tags,
          jsonb_strip_nulls(jsonb_build_object(
            'freshness','current','resolutionState',v_state,'platform',v_platform,'gameVersion',v_game_version
          )),v_work.published_at,now()
        ) on conflict(entity_id) do update set
          title=excluded.title,text_content=excluded.text_content,tags=excluded.tags,
          facets=excluded.facets,published_at=excluded.published_at,updated_at=now();
      else
        delete from public.search_documents where entity_id=v_work.work_id;
      end if;
    else
      update public.qa_tip_state set freshness=p_freshness,updated_at=now()
      where work_id=v_work.work_id;
      if p_freshness='current'
         and v_work.lifecycle_state='published' and v_work.visibility='public' and v_work.moderation_state='clear' then
        select tr.title,tr.body,tr.context_tags,tr.platform,tr.game_version
        into v_title,v_body,v_tags,v_platform,v_game_version
        from public.qa_tip_revisions tr
        where tr.revision_id=v_work.current_published_revision_id;
        insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(
          v_work.work_id,v_work.work_id,'tip',v_work.creator_profile_id,v_title,v_body,v_tags,
          jsonb_strip_nulls(jsonb_build_object(
            'freshness','current','platform',v_platform,'gameVersion',v_game_version
          )),v_work.published_at,now()
        ) on conflict(entity_id) do update set
          title=excluded.title,text_content=excluded.text_content,tags=excluded.tags,
          facets=excluded.facets,published_at=excluded.published_at,updated_at=now();
      else
        delete from public.search_documents where entity_id=v_work.work_id;
      end if;
    end if;
    return jsonb_build_object('targetEntityId',p_target_entity_id,'freshness',p_freshness);
  end if;

  select * into v_comment from public.comments where comment_id=p_target_entity_id;
  if v_comment.comment_id is null or not exists(
    select 1 from public.qa_answers where answer_id=p_target_entity_id
  ) then raise exception 'Q&A target not found'; end if;
  if v_comment.author_account_id<>v_account_id and not private.is_staff(v_account_id) then
    raise exception 'Actor does not own Answer';
  end if;
  update public.qa_answers set freshness=p_freshness,updated_at=now()
  where answer_id=p_target_entity_id;
  return jsonb_build_object('targetEntityId',p_target_entity_id,'freshness',p_freshness);
end
$$;

create or replace function public.community_remove_outdated_qa_v1(
  p_auth_subject uuid,
  p_target_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_comment public.comments%rowtype;
  v_question_id uuid;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select * into v_work from public.community_works where work_id=p_target_entity_id;
  if v_work.work_id is not null and v_work.work_type in ('question','tip') then
    if v_work.owner_account_id<>v_account_id and not private.is_staff(v_account_id) then
      raise exception 'Actor does not own Q&A Work';
    end if;
    update public.community_works
    set lifecycle_state='deleted',updated_at=now()
    where work_id=v_work.work_id;
    update public.community_entities
    set deleted_at=coalesce(deleted_at,now())
    where entity_id=v_work.work_id;
    delete from public.search_documents where entity_id=v_work.work_id;

    if v_work.work_type='question' then
      update public.comments
      set lifecycle_state='deleted',updated_at=now(),row_version=row_version+1
      where target_entity_id=v_work.work_id and lifecycle_state<>'deleted';
      update public.community_entities e
      set deleted_at=coalesce(e.deleted_at,now())
      where e.entity_id in (
        select answer_id from public.qa_answers where question_id=v_work.work_id
      );
    end if;

    insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
    values(v_account_id,'qa.outdated_removed',v_work.work_id,jsonb_build_object('workType',v_work.work_type));
    return jsonb_build_object('targetEntityId',v_work.work_id,'removed',true,'workType',v_work.work_type);
  end if;

  select * into v_comment from public.comments where comment_id=p_target_entity_id;
  select question_id into v_question_id from public.qa_answers where answer_id=p_target_entity_id;
  if v_comment.comment_id is null or v_question_id is null then raise exception 'Q&A target not found'; end if;
  if v_comment.author_account_id<>v_account_id and not private.is_staff(v_account_id) then
    raise exception 'Actor does not own Answer';
  end if;

  update public.comments
  set lifecycle_state='deleted',updated_at=now(),row_version=row_version+1
  where comment_id=p_target_entity_id;
  update public.community_entities
  set deleted_at=coalesce(deleted_at,now())
  where entity_id=p_target_entity_id;
  delete from public.qa_answer_utility where answer_id=p_target_entity_id;

  update public.qa_question_state
  set accepted_answer_id=case when accepted_answer_id=p_target_entity_id then null else accepted_answer_id end,
      resolution_state=case
        when accepted_answer_id=p_target_entity_id and solution_note is null then 'unresolved'
        else resolution_state
      end,
      updated_at=now()
  where work_id=v_question_id;

  update public.search_documents d
  set facets=d.facets || jsonb_build_object(
    'resolutionState',(select resolution_state from public.qa_question_state where work_id=v_question_id)
  ),updated_at=now()
  where d.work_id=v_question_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(v_account_id,'qa.outdated_answer_removed',p_target_entity_id,jsonb_build_object('questionId',v_question_id));
  return jsonb_build_object(
    'targetEntityId',p_target_entity_id,'removed',true,'kind','answer','questionId',v_question_id
  );
end
$$;

create or replace function public.community_withdraw_duplicate_question_v1(
  p_auth_subject uuid,
  p_question_id uuid,
  p_target_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_account_id uuid;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if p_question_id=p_target_question_id then raise exception 'Question cannot redirect to itself'; end if;
  if not exists(
    select 1 from public.community_works w
    join public.qa_question_state qs on qs.work_id=w.work_id
    where w.work_id=p_question_id and w.work_type='question'
      and w.owner_account_id=v_account_id and qs.resolution_state='unresolved'
  ) then raise exception 'Only the author may withdraw an unresolved Question'; end if;
  if not exists(
    select 1 from public.community_works w
    join public.qa_question_state qs on qs.work_id=w.work_id
    where w.work_id=p_target_question_id and w.work_type='question'
      and w.lifecycle_state='published' and w.visibility='public'
      and w.moderation_state='clear' and qs.freshness='current'
  ) then raise exception 'Duplicate target Question is not current and public'; end if;

  insert into public.qa_question_redirects(question_id,target_question_id)
  values(p_question_id,p_target_question_id)
  on conflict(question_id) do update set target_question_id=excluded.target_question_id,created_at=now();

  update public.community_works set lifecycle_state='deleted',updated_at=now()
  where work_id=p_question_id;
  update public.community_entities set deleted_at=coalesce(deleted_at,now())
  where entity_id=p_question_id;
  delete from public.search_documents where entity_id=p_question_id;

  return jsonb_build_object(
    'questionId',p_question_id,'withdrawn',true,'redirectQuestionId',p_target_question_id
  );
end
$$;

create or replace function public.community_get_question_redirect_public_v1(p_question_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select case when r.question_id is null then null else jsonb_build_object(
    'questionId',r.question_id,'redirectKind',r.redirect_kind,'targetQuestionId',r.target_question_id
  ) end
  from (select p_question_id question_id) x
  left join public.qa_question_redirects r on r.question_id=x.question_id
  where r.question_id is null or private.is_discoverable_work(r.target_question_id)
$$;

create or replace function public.community_get_question_public_v1(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_result jsonb;
begin
  if not private.is_discoverable_work(p_question_id) then
    raise exception 'Question is not publicly accessible';
  end if;
  select * into v_work from public.community_works
  where work_id=p_question_id and work_type='question';
  if v_work.work_id is null then raise exception 'Question not found'; end if;

  select jsonb_build_object(
    'questionId',v_work.work_id,
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',qr.title,
    'body',qr.body,
    'contextTags',to_jsonb(qr.context_tags),
    'platform',qr.platform,
    'gameVersion',qr.game_version,
    'resolutionState',qs.resolution_state,
    'freshness',qs.freshness,
    'acceptedAnswerId',qs.accepted_answer_id,
    'solutionNote',qs.solution_note,
    'publishedAt',v_work.published_at,
    'sameHereCount',(select count(*)::integer from public.qa_same_here sh where sh.question_id=v_work.work_id),
    'answers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'answerId',a.answer_id,
        'creatorProfileId',c.creator_profile_id,
        'creatorDisplayName',cp.display_name,
        'body',c.body,
        'freshness',a.freshness,
        'accepted',a.answer_id=qs.accepted_answer_id,
        'createdAt',c.created_at
      ) order by (a.answer_id=qs.accepted_answer_id) desc,c.created_at,c.comment_id)
      from public.qa_answers a
      join public.comments c on c.comment_id=a.answer_id
      join public.creator_profiles cp on cp.creator_profile_id=c.creator_profile_id
      where a.question_id=v_work.work_id
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
        and cp.moderation_state='clear'
    ),'[]'::jsonb)
  ) into v_result
  from public.qa_question_revisions qr
  join public.qa_question_state qs on qs.work_id=v_work.work_id
  where qr.revision_id=v_work.current_published_revision_id;

  return v_result;
end
$$;

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
  v_result jsonb;
  v_same_here boolean;
  v_utility jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_work(p_question_id,v_account_id) then
    raise exception 'Question is not accessible';
  end if;
  v_result:=public.community_get_question_public_v1(p_question_id);
  select exists(
    select 1 from public.qa_same_here
    where account_id=v_account_id and question_id=p_question_id
  ) into v_same_here;
  select coalesce(jsonb_object_agg(u.answer_id::text,u.utility_kind),'{}'::jsonb)
  into v_utility
  from public.qa_answer_utility u
  join public.qa_answers a on a.answer_id=u.answer_id
  where u.account_id=v_account_id and a.question_id=p_question_id;

  return v_result || jsonb_build_object(
    'viewerSameHere',v_same_here,
    'viewerAnswerUtility',v_utility
  );
end
$$;

create or replace function public.community_get_tip_public_v1(p_tip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_work public.community_works%rowtype; v_result jsonb;
begin
  if not private.is_discoverable_work(p_tip_id) then
    raise exception 'Tip is not publicly accessible';
  end if;
  select * into v_work from public.community_works where work_id=p_tip_id and work_type='tip';
  if v_work.work_id is null then raise exception 'Tip not found'; end if;
  select jsonb_build_object(
    'tipId',v_work.work_id,
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',tr.title,'body',tr.body,'contextTags',to_jsonb(tr.context_tags),
    'platform',tr.platform,'gameVersion',tr.game_version,
    'freshness',ts.freshness,
    'sourceQuestionId',tr.source_question_id,'sourceAnswerId',tr.source_answer_id,
    'publishedAt',v_work.published_at
  ) into v_result
  from public.qa_tip_revisions tr
  join public.qa_tip_state ts on ts.work_id=v_work.work_id
  where tr.revision_id=v_work.current_published_revision_id;
  return v_result;
end
$$;

create or replace function public.community_search_questions_v1(
  p_query text default null,
  p_context_tags text[] default null,
  p_unanswered_only boolean default false,
  p_limit integer default 20
)
returns table(
  question_id uuid,
  creator_profile_id uuid,
  title text,
  text_content text,
  context_tags text[],
  platform text,
  game_version text,
  resolution_state text,
  freshness text,
  answer_count integer,
  same_here_count integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_query text; v_pattern text; v_limit integer;
begin
  v_query:=nullif(btrim(p_query),'');
  if v_query is not null and char_length(v_query)>100 then
    raise exception 'Search query must be at most 100 characters';
  end if;
  if p_context_tags is not null and cardinality(p_context_tags)>20 then
    raise exception 'Search supports at most 20 Context Tags';
  end if;
  v_limit:=least(greatest(coalesce(p_limit,20),1),50);
  if v_query is not null then
    v_pattern:='%' ||
      replace(replace(replace(lower(v_query),'\','\\'),'%','\%'),'_','\_') || '%';
  end if;

  return query
  select
    d.work_id,
    d.creator_profile_id,
    d.title,
    d.text_content,
    d.tags,
    qr.platform,
    qr.game_version,
    qs.resolution_state,
    qs.freshness,
    (
      select count(*)::integer
      from public.qa_answers a
      join public.comments c on c.comment_id=a.answer_id
      where a.question_id=d.work_id
        and a.freshness='current'
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
    ),
    (select count(*)::integer from public.qa_same_here sh where sh.question_id=d.work_id),
    d.published_at
  from public.search_documents d
  join public.community_works w on w.work_id=d.work_id
  join public.qa_question_state qs on qs.work_id=d.work_id
  join public.qa_question_revisions qr on qr.revision_id=w.current_published_revision_id
  where d.work_type='question'
    and qs.freshness='current'
    and (v_query is null
      or lower(d.title) ilike v_pattern escape '\'
      or lower(d.text_content) ilike v_pattern escape '\')
    and (p_context_tags is null or d.tags @> p_context_tags)
    and (
      not coalesce(p_unanswered_only,false)
      or not exists(
        select 1
        from public.qa_answers a
        join public.comments c on c.comment_id=a.answer_id
        where a.question_id=d.work_id
          and a.freshness='current'
          and c.lifecycle_state<>'deleted'
          and c.moderation_state='clear'
      )
    )
  order by d.published_at desc,d.work_id desc
  limit v_limit;
end
$$;

create or replace function public.community_get_my_qa_activity_v1(
  p_auth_subject uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_contributions jsonb;
  v_same_here jsonb;
  v_utility jsonb;
begin
  if p_limit not between 1 and 200 then raise exception 'p_limit must be between 1 and 200'; end if;
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb)
  into v_contributions
  from (
    select coalesce(w.published_at,w.created_at) sort_at,
      jsonb_build_object(
        'kind',w.work_type,'entityId',w.work_id,'state',w.lifecycle_state,
        'title',coalesce(qr.title,tr.title),'freshness',coalesce(qs.freshness,ts.freshness),
        'resolutionState',qs.resolution_state,'createdAt',w.created_at
      ) payload
    from public.community_works w
    left join public.qa_question_state qs on qs.work_id=w.work_id
    left join public.qa_question_revisions qr on qr.revision_id=w.current_published_revision_id
    left join public.qa_tip_state ts on ts.work_id=w.work_id
    left join public.qa_tip_revisions tr on tr.revision_id=w.current_published_revision_id
    where w.owner_account_id=v_account_id and w.work_type in ('question','tip')
    union all
    select c.created_at,
      jsonb_build_object(
        'kind','answer','entityId',a.answer_id,'questionId',a.question_id,
        'body',c.body,'freshness',a.freshness,'createdAt',c.created_at
      )
    from public.qa_answers a
    join public.comments c on c.comment_id=a.answer_id
    where c.author_account_id=v_account_id
  ) x
  limit p_limit;

  select coalesce(jsonb_agg(jsonb_build_object(
    'questionId',question_id,'createdAt',created_at
  ) order by created_at desc),'[]'::jsonb)
  into v_same_here
  from public.qa_same_here where account_id=v_account_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'answerId',answer_id,'utility',utility_kind,'updatedAt',updated_at
  ) order by updated_at desc),'[]'::jsonb)
  into v_utility
  from public.qa_answer_utility where account_id=v_account_id;

  return jsonb_build_object(
    'contributions',v_contributions,
    'sameHere',v_same_here,
    'answerUtility',v_utility
  );
end
$$;

create or replace function public.community_moderate_work_v3(
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
  v_result jsonb;
  v_work_id uuid;
  v_work public.community_works%rowtype;
  v_title text;
  v_body text;
  v_tags text[];
  v_platform text;
  v_game_version text;
  v_resolution text;
  v_freshness text;
begin
  v_result:=public.community_moderate_work_v2(
    p_auth_subject,p_session_id,p_issued_at_epoch,p_case_id,p_action,p_reason
  );
  v_work_id:=(v_result->>'workId')::uuid;

  if p_action='restore' then
    select * into v_work from public.community_works where work_id=v_work_id;
    if v_work.work_type='question' then
      select qr.title,qr.body,qr.context_tags,qr.platform,qr.game_version,
             qs.resolution_state,qs.freshness
      into v_title,v_body,v_tags,v_platform,v_game_version,v_resolution,v_freshness
      from public.qa_question_revisions qr
      join public.qa_question_state qs on qs.work_id=v_work.work_id
      where qr.revision_id=v_work.current_published_revision_id;
      if v_freshness='current' then
        insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(
          v_work_id,v_work_id,'question',v_work.creator_profile_id,v_title,v_body,v_tags,
          jsonb_strip_nulls(jsonb_build_object(
            'freshness',v_freshness,'resolutionState',v_resolution,
            'platform',v_platform,'gameVersion',v_game_version
          )),v_work.published_at,now()
        ) on conflict(entity_id) do update set
          title=excluded.title,text_content=excluded.text_content,tags=excluded.tags,
          facets=excluded.facets,published_at=excluded.published_at,updated_at=now();
      else
        delete from public.search_documents where entity_id=v_work_id;
      end if;
    elsif v_work.work_type='tip' then
      select tr.title,tr.body,tr.context_tags,tr.platform,tr.game_version,ts.freshness
      into v_title,v_body,v_tags,v_platform,v_game_version,v_freshness
      from public.qa_tip_revisions tr
      join public.qa_tip_state ts on ts.work_id=v_work.work_id
      where tr.revision_id=v_work.current_published_revision_id;
      if v_freshness='current' then
        insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(
          v_work_id,v_work_id,'tip',v_work.creator_profile_id,v_title,v_body,v_tags,
          jsonb_strip_nulls(jsonb_build_object(
            'freshness',v_freshness,'platform',v_platform,'gameVersion',v_game_version
          )),v_work.published_at,now()
        ) on conflict(entity_id) do update set
          title=excluded.title,text_content=excluded.text_content,tags=excluded.tags,
          facets=excluded.facets,published_at=excluded.published_at,updated_at=now();
      else
        delete from public.search_documents where entity_id=v_work_id;
      end if;
    end if;
  end if;

  return v_result;
end
$$;

revoke execute on function public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)
from public,anon,authenticated;
revoke execute on function public.community_add_answer_v1(uuid,uuid,uuid,text,text)
from public,anon,authenticated;
revoke execute on function public.community_set_same_here_v1(uuid,uuid,boolean)
from public,anon,authenticated;
revoke execute on function public.community_set_answer_utility_v1(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_resolve_question_v1(uuid,uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_set_qa_freshness_v1(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_remove_outdated_qa_v1(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_withdraw_duplicate_question_v1(uuid,uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_get_question_v1(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_get_my_qa_activity_v1(uuid,integer)
from public,anon,authenticated;
revoke execute on function public.community_moderate_work_v3(uuid,uuid,bigint,uuid,text,text)
from public,anon,authenticated;

grant execute on function public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text) to service_role;
grant execute on function public.community_add_answer_v1(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.community_set_same_here_v1(uuid,uuid,boolean) to service_role;
grant execute on function public.community_set_answer_utility_v1(uuid,uuid,text) to service_role;
grant execute on function public.community_resolve_question_v1(uuid,uuid,uuid,text) to service_role;
grant execute on function public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text) to service_role;
grant execute on function public.community_set_qa_freshness_v1(uuid,uuid,text) to service_role;
grant execute on function public.community_remove_outdated_qa_v1(uuid,uuid) to service_role;
grant execute on function public.community_withdraw_duplicate_question_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.community_get_question_v1(uuid,uuid) to service_role;
grant execute on function public.community_get_my_qa_activity_v1(uuid,integer) to service_role;
grant execute on function public.community_moderate_work_v3(uuid,uuid,bigint,uuid,text,text) to service_role;

revoke execute on function public.community_get_question_redirect_public_v1(uuid) from public;
revoke execute on function public.community_get_question_public_v1(uuid) from public;
revoke execute on function public.community_get_tip_public_v1(uuid) from public;
revoke execute on function public.community_search_questions_v1(text,text[],boolean,integer) from public;
grant execute on function public.community_get_question_redirect_public_v1(uuid) to anon,authenticated,service_role;
grant execute on function public.community_get_question_public_v1(uuid) to anon,authenticated,service_role;
grant execute on function public.community_get_tip_public_v1(uuid) to anon,authenticated,service_role;
grant execute on function public.community_search_questions_v1(text,text[],boolean,integer) to anon,authenticated,service_role;
