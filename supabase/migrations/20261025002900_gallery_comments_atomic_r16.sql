create or replace function public.community_set_gallery_comments_enabled_atomic_r16(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
  p_expected_current_revision_id uuid,
  p_enabled boolean,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,extensions,public,private
as $r16$
declare
  v_account uuid;
  v_account_seen uuid;
  v_work public.community_works%rowtype;
  v_prior_hash text;
  v_request_hash text;
  v_prior_response jsonb;
  v_response jsonb;
begin
  v_account:=private.resolve_active_account(p_auth_subject);
  if v_account is null then raise exception 'R16_ACTOR_NOT_ACTIVE';end if;
  if p_enabled is null or p_expected_version is null or p_expected_current_revision_id is null
    or coalesce(length(btrim(p_idempotency_key)),0) not between 1 and 160
  then raise exception 'R16_METADATA_PIN_REQUIRED';end if;
  select account_id into v_account_seen from public.wand_accounts
    where account_id=v_account and status='active' and deleted_at is null
    for share;
  if v_account_seen is null or private.resolve_active_account(p_auth_subject) is distinct from v_account
  then raise exception 'R16_ACTOR_OR_PRIVACY_STALE';end if;
  v_request_hash:=encode(digest(concat_ws('|',
    'gallery_comments_r16',p_work_id::text,p_expected_version::text,
    p_expected_current_revision_id::text,p_enabled::text
  ),'sha256'),'hex');
  select request_hash,response into v_prior_hash,v_prior_response
    from public.idempotency_keys
    where account_id=v_account and idempotency_key=p_idempotency_key;
  if v_prior_hash is not null then
    if v_prior_hash<>v_request_hash or v_prior_response is null
      then raise exception 'R16_IDEMPOTENCY_CONFLICT';end if;
    return v_prior_response;
  end if;
  select * into v_work from public.community_works
    where work_id=p_work_id and owner_account_id=v_account and work_type='gallery'
    for update nowait;
  if v_work.work_id is null then raise exception 'R16_GALLERY_OWNER_INVALID';end if;
  if v_work.row_version is distinct from p_expected_version
     or v_work.current_published_revision_id is distinct from p_expected_current_revision_id
  then raise exception 'R16_STALE_WORK_TERMINAL';end if;
  if v_work.moderation_state<>'clear' or v_work.lifecycle_state<>'published'
     or v_work.visibility<>'public'
  then raise exception 'R16_WORK_NOT_PUBLIC_CLEAR';end if;
  if exists(select 1 from public.gallery_photo_subjects
      where work_id=p_work_id)
    or exists(select 1 from public.preset_artifacts
      where associated_gallery_work_id=p_work_id)
    or exists(select 1 from public.gallery_revision_presets gp
      join public.community_work_revisions gr on gr.revision_id=gp.gallery_revision_id
      where gr.work_id=p_work_id)
  then raise exception 'R16_DEPENDENT_GALLERY_METADATA_NOT_ENROLLED';end if;
  if not pg_try_advisory_xact_lock(hashtextextended(v_account::text||':'||p_idempotency_key,0))
  then raise exception using message='R16_IDEMPOTENCY_LOCK_BUSY',errcode='55P03';end if;
  select request_hash,response into v_prior_hash,v_prior_response
    from public.idempotency_keys
    where account_id=v_account and idempotency_key=p_idempotency_key;
  if v_prior_hash is not null then
    if v_prior_hash<>v_request_hash or v_prior_response is null
      then raise exception 'R16_IDEMPOTENCY_CONFLICT';end if;
    return v_prior_response;
  end if;
  if private.resolve_active_account(p_auth_subject) is distinct from v_account
  then raise exception 'R16_ACTOR_OR_PRIVACY_STALE';end if;
  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
    values(v_account,p_idempotency_key,'gallery_comments_r16',v_request_hash);
  insert into public.gallery_work_settings(work_id,comments_enabled,updated_at)
    values(p_work_id,p_enabled,now())
    on conflict(work_id) do update
      set comments_enabled=excluded.comments_enabled,updated_at=now();
  update public.search_documents
    set facets=facets || jsonb_build_object('commentsEnabled',p_enabled),updated_at=now()
    where work_id=p_work_id;
  update public.community_works set updated_at=clock_timestamp()
    where work_id=p_work_id returning * into v_work;
  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
    values(v_account,'gallery.comments_enabled',p_work_id,jsonb_build_object('enabled',p_enabled,'contract','gallery-metadata@r16'));
  v_response:=jsonb_build_object('workId',p_work_id,'commentsEnabled',p_enabled,
    'rowVersion',v_work.row_version,'currentRevisionId',v_work.current_published_revision_id,
    'registryVersion','gallery-metadata@r16');
  update public.idempotency_keys set response=v_response,completed_at=now()
    where account_id=v_account and idempotency_key=p_idempotency_key;
  return v_response;
end;
$r16$;
