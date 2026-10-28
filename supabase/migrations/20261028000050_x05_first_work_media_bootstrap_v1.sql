-- 03 COMM X05 Source152: first Work/Media binding, NOT a new media upload pipeline.
-- Forward-only after Source151; unprivileged JWT user bearer required.
-- No public publisher/media signer or official DDV Challenge issuer is inferred.
create or replace function public.community_dreamsnap_x05_register_initial_work_v1(
 p_kind text,p_challenge_id uuid,p_media_id uuid,p_caption text,
 p_idempotency_key text,p_explicit_wand_entry boolean default false
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,auth,extensions,public,private as $register$
declare
 v_subject uuid;
 v_account uuid;
 v_creator uuid;
 v_challenge public.dreamsnap_challenges%rowtype;
 v_media public.media_assets%rowtype;
 v_work uuid;
 v_revision uuid;
 v_entry uuid;
 v_response jsonb;
 v_registered jsonb;
 v_join jsonb;
 v_request_hash text;
 v_previous record;
 v_origin text;
begin
 v_subject:=private.dreamsnap_x05_verified_db_subject_v1();
 v_account:=private.resolve_active_account(v_subject);
 if p_kind not in ('OriginalCompetition','PostEventCreation')
   or p_challenge_id is null or p_media_id is null
   or p_idempotency_key is null
   or char_length(p_idempotency_key) not between 16 and 120
   or p_idempotency_key !~ '^[a-zA-Z0-9:_-]+$'
   or (p_caption is not null and char_length(p_caption)>2000)
 then raise exception 'X05_REGISTER_INVALID_INPUT'; end if;
 -- The Creator is resolved FROM the validated Account, not supplied by HTTP.
 select cp.creator_profile_id into v_creator
 from public.creator_profiles cp
 join public.community_entities ce on ce.entity_id=cp.creator_profile_id
 where cp.owner_account_id=v_account and cp.moderation_state='clear'
   and ce.deleted_at is null;
 if v_creator is null then raise exception 'X05_REGISTER_CREATOR_UNAVAILABLE'; end if;
 select * into v_media from public.media_assets m where m.media_id=p_media_id;
 if v_media.media_id is null
   or v_media.owner_account_id is distinct from v_account
   or v_media.processing_state<>'ready'
   or v_media.moderation_state<>'clear' or v_media.purged_at is not null
 then raise exception 'X05_REGISTER_MEDIA_UNAVAILABLE'; end if;
 select * into v_challenge from public.dreamsnap_challenges
   where challenge_id=p_challenge_id for share;
 if v_challenge.challenge_id is null or v_challenge.is_synthetic
 then raise exception 'X05_REGISTER_CHALLENGE_NOT_PROVEN'; end if;
 if p_kind='OriginalCompetition' then
   if v_challenge.lifecycle_state<>'submission_open'
      or p_explicit_wand_entry is distinct from true
   then raise exception 'X05_ORIGINAL_ENTRY_NOT_EXPLICIT_OR_OPEN'; end if;
 else
   if v_challenge.lifecycle_state not in ('results','closed')
      or p_explicit_wand_entry is distinct from false
   then raise exception 'X05_POST_EVENT_NOT_STAGED_PHASE'; end if;
 end if;

 -- Same account, same media/challenge/kind never produces multiple Works,
 -- even with different request IDs / concurrent connections.
 perform pg_advisory_xact_lock(
   hashtextextended(v_account::text||':x05media:'||p_media_id::text||':'||
     p_challenge_id::text||':'||p_kind,0));
 perform pg_advisory_xact_lock(
   hashtextextended(v_account::text||':x05request:'||p_idempotency_key,0));
 v_request_hash:=encode(extensions.digest(concat_ws('|',
   'x05_initial_register_v1',p_kind,p_challenge_id::text,p_media_id::text,
   coalesce(p_caption,''),p_explicit_wand_entry::text),'sha256'),'hex');
 select request_hash,response into v_previous
 from public.idempotency_keys
 where account_id=v_account and idempotency_key='x05:'||p_idempotency_key;
 if found then
   if v_previous.request_hash is distinct from v_request_hash
   then raise exception 'X05_IDEMPOTENCY_KEY_REUSED'; end if;
   return v_previous.response;
 end if;
 if exists(
   select 1 from public.work_revision_media wrm
   join public.community_work_revisions cr on cr.revision_id=wrm.work_revision_id
   join public.community_works w on w.work_id=cr.work_id
   join public.dreamsnap_works dw on dw.work_id=w.work_id
   where wrm.media_id=p_media_id and dw.challenge_id=p_challenge_id
     and w.owner_account_id=v_account and w.work_type='dreamsnap'
     and w.lifecycle_state<>'deleted'
 )
 then raise exception 'X05_DUPLICATE_MEDIA_WORK'; end if;

 -- Original: REUSE the existing fully idempotent native Work+Entry writers.
 -- Wand competition Entry is explicitly requested, not official DDV submission.
 if p_kind='OriginalCompetition' then
   v_registered:=public.community_register_dreamsnap_work_v1(
     v_subject,v_creator,p_challenge_id,null,p_media_id,p_caption,true,true,
     'x05-origin:'||p_idempotency_key);
   v_work:=(v_registered->>'workId')::uuid;
   v_revision:=(v_registered->>'revisionId')::uuid;
   v_join:=public.community_dreamsnap_join_event_v1(
     v_subject,v_work,'x05-entry:'||p_idempotency_key);
   v_entry:=(v_join->>'entryId')::uuid;
   if v_entry is null or not exists(
     select 1 from public.dreamsnap_entries e
       where e.entry_id=v_entry and e.work_id=v_work
       and e.account_id=v_account and e.entry_revision_id=v_revision
       and e.entry_state='entered' and e.eligibility_state='eligible'
       and not e.managed_under13)
   then raise exception 'X05_ORIGINAL_ENTRY_NOT_FROZEN'; end if;
 else
   -- PostEvent: build through existing entity/work/revision/media models,
   -- and the independently accepted Source148 immutable STAGED trigger.
   -- No fabricated Entry, Challenge vote authority, or public gallery.
   v_work:=gen_random_uuid();
   insert into public.community_entities(entity_id,entity_type)
     values(v_work,'community_work');
   insert into public.community_works(
     work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
     values(v_work,v_account,v_creator,'dreamsnap','draft','private');
   insert into public.dreamsnap_works(
     work_id,challenge_id,workspace_relationship_kind,managed_under13)
     values(v_work,p_challenge_id,'self',false);
   v_revision:=private.dreamsnap_create_revision(
     v_account,v_work,p_challenge_id,p_media_id,p_caption,true,true);
   update public.community_works
     set current_published_revision_id=v_revision,lifecycle_state='published',
       visibility='private',published_at=clock_timestamp(),
       updated_at=clock_timestamp()
     where work_id=v_work;
   insert into private.dreamsnap_post_event_staged_v1(
      work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,
      media_id,concept_revision_id)
     values(v_work,p_challenge_id,v_creator,v_revision,p_media_id,v_revision);
   v_origin:=private.community_origin_kind_for_account(v_account);
   insert into public.community_entity_origins(entity_id,origin_kind)
     values(v_work,v_origin);
   insert into public.outbox_events(
     aggregate_type,aggregate_id,event_type,payload,dedupe_key)
     values('community_work',v_work,'dreamsnap.work_registered',
       jsonb_build_object('workId',v_work,'challengeId',p_challenge_id,
         'revisionId',v_revision,'kind','PostEventCreation',
         'publicActivationAllowed',false),
       'dreamsnap.work_registered:'||v_work::text);
 end if;
 -- PostEvent remains source-staged. Original Entry is Wand competition Entry
 -- and does not prove the actual official DDV contest phase or entitlement.
 v_response:=jsonb_build_object(
   'workId',v_work,'kind',p_kind,
   'challengeId',p_challenge_id,'photoRevisionId',v_revision,
   'photoMediaId',p_media_id,'entryId',v_entry,
   'publicActivationAllowed',false,
   'officialChallengePhaseVerified',false,
   'storageValidatedBySource152',false,
   'requiresPolicyGrant',true,
   'nextOperation','pregrant');
 insert into public.idempotency_keys(
   account_id,idempotency_key,command_name,request_hash,response,completed_at)
   values(v_account,'x05:'||p_idempotency_key,
     'x05_initial_register_v1',v_request_hash,v_response,clock_timestamp());
 return jsonb_strip_nulls(v_response);
end
$register$;
revoke all on function public.community_dreamsnap_x05_register_initial_work_v1(
 text,uuid,uuid,text,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.community_dreamsnap_x05_register_initial_work_v1(
 text,uuid,uuid,text,text,boolean) to authenticated;
comment on function public.community_dreamsnap_x05_register_initial_work_v1(
 text,uuid,uuid,text,text,boolean) is
 'Actor-pinned Source152 Work registration against pre-registered verified READY Media; Original Wand Entry explicit, PostEvent only STAGED. Not a Storage upload or public publisher.';
