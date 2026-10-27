-- 03 COMM / Issue #219 / independent QR217 F08 F09 CONDITIONAL SOURCE RED.
-- Additive after D06 Source143, historic 20261003044500 is never edited.
-- Existing public signatures / service-only RPC ACL retained.
-- This migration DOES NOT enable native Positive Publisher or old signed URL revocation.
-- Shared public Wand-competition Work eligibility. Consent to PUBLIC official
-- DDV numeric results is independent and NOT consulted here.
create or replace function private.dreamsnap_public_work_accessible_r20(p_work_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,private
as $dreamsnap_public_work$
  select exists(
    select 1
    from public.community_works w
    join public.wand_accounts a on a.account_id=w.owner_account_id
    join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
      and cp.owner_account_id=w.owner_account_id
    join public.community_entities ce on ce.entity_id=cp.creator_profile_id
    where w.work_id=p_work_id
      and w.work_type='dreamsnap'
      and w.lifecycle_state='published'
      and w.visibility='public'
      and w.moderation_state='clear'
      and a.status='active'
      and a.deleted_at is null
      and cp.profile_visibility='public'
      and cp.moderation_state='clear'
      and ce.deleted_at is null
      and private.is_discoverable_work(w.work_id)
      and exists (
        select 1 from public.auth_identities ai
        where ai.account_id=w.owner_account_id
          and ai.provider='supabase'
          and ai.identity_state='active'
      )
  )
$dreamsnap_public_work$;
revoke all on function private.dreamsnap_public_work_accessible_r20(uuid)
from public,anon,authenticated,service_role;
comment on function private.dreamsnap_public_work_accessible_r20(uuid) is
  'F08/F09 exact public Work liveness: active owner/identity, public Creator, active public Work + revision, no entity deletion or Privacy suppression. Independent of OFF-by-default official numeric Results disclosure.';

-- F09: WAND result list needs active PUBLIC Work + frozen submitted revision
-- and READY owned competition media; parent Challenge already results/closed.
create or replace function public.community_get_dreamsnap_results_public_v1(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v public.dreamsnap_challenges%rowtype;
  v_wand jsonb;
  v_official jsonb;
begin
  select * into v
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id
    and is_synthetic=false
    and lifecycle_state in ('results','closed');
  if v.challenge_id is null then raise exception 'DreamSnaps Results are not publicly accessible'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'entryId',r.entry_id,
    'entryRevisionId',r.entry_revision_id,
    'placement',r.placement,
    'formalScore',r.formal_score,
    'mediaId',wrm.media_id,
    'creatorProfileId',w.creator_profile_id,
    'creator',public.community_get_creator_public_v1(w.creator_profile_id)
  ) order by r.placement,r.entry_id),'[]'::jsonb)
  into v_wand
  from public.dreamsnap_wand_results r
  join public.dreamsnap_entries e on e.entry_id=r.entry_id
  join public.community_works w on w.work_id=e.work_id
  join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
  join public.work_revision_media wrm
    on wrm.work_revision_id=r.entry_revision_id
   and wrm.ordinal=0
   and wrm.role='dreamsnap'
  join public.community_work_revisions cr
    on cr.revision_id=wrm.work_revision_id
   and cr.work_id=w.work_id
  join public.dreamsnap_work_revisions dr
    on dr.revision_id=r.entry_revision_id
   and dr.integrity_state='eligible'
  join public.media_assets m
    on m.media_id=wrm.media_id
   and m.owner_account_id=w.owner_account_id
   and m.processing_state='ready'
   and m.moderation_state='clear'
   and m.purged_at is null
  where r.challenge_id=p_challenge_id
    and e.entry_state='entered'
    and e.eligibility_state='eligible'
    and w.moderation_state='clear'
    and e.account_id=w.owner_account_id
    and e.managed_under13=false
    and r.entry_revision_id=e.entry_revision_id
    and private.dreamsnap_public_work_accessible_r20(w.work_id)
    and cp.profile_visibility='public'
    and cp.moderation_state='clear';

  select coalesce(jsonb_agg(jsonb_build_object(
    'entryId',e.entry_id,
    'creatorProfileId',w.creator_profile_id,
    'creator',public.community_get_creator_public_v1(w.creator_profile_id),
    'officialResult',private.dreamsnap_public_official_result(e.entry_id)
  ) order by e.entry_id),'[]'::jsonb)
  into v_official
  from public.dreamsnap_entries e
  join public.community_works w on w.work_id=e.work_id
  join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
  where e.challenge_id=p_challenge_id
    and e.entry_state='entered'
    and e.eligibility_state='eligible'
    and w.moderation_state='clear'
    and e.account_id=w.owner_account_id
    and e.managed_under13=false
    and private.dreamsnap_public_work_accessible_r20(w.work_id)
    and cp.profile_visibility='public'
    and cp.moderation_state='clear'
    and private.dreamsnap_public_official_result(e.entry_id) is not null;

  return jsonb_build_object(
    'challenge',jsonb_build_object(
      'challengeId',v.challenge_id,'challengeKey',v.challenge_key,
      'title',v.title,'description',v.description,'state',v.lifecycle_state,
      'resultsAt',v.results_at,'closesAt',v.closes_at
    ),
    'wandResults',v_wand,
    'inGameResults',v_official
  );
end
$$;

-- F08: all DreamSnaps Media signer EXISTS branches need effective PUBLIC Work
-- state, including the orphan-prone eligible Entry branch; separate Gallery
-- OR still honors its own preexisting private.is_discoverable_work gate.
create or replace function public.community_get_public_media_storage_v2(
  p_media_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'mediaId',m.media_id,
    'storageKey',m.storage_key,
    'mimeType',m.mime_type,
    'byteSize',m.byte_size,
    'width',m.width,
    'height',m.height,
    'checksumSha256',m.checksum_sha256
  )
  into v_result
  from public.media_assets m
  where m.media_id=p_media_id
    and m.processing_state='ready'
    and m.moderation_state='clear'
    and m.purged_at is null
    and (
      exists(
        select 1
        from public.work_revision_media wrm
        join public.community_work_revisions r on r.revision_id=wrm.work_revision_id
        join public.community_works w
          on w.work_id=r.work_id
         and w.current_published_revision_id=r.revision_id
        where wrm.media_id=m.media_id
          and w.work_type='gallery'
          and private.is_discoverable_work(w.work_id)
      )
      or exists(
        select 1
        from public.work_revision_media wrm
        join public.dreamsnap_gallery_publications gp on gp.revision_id=wrm.work_revision_id
        join public.dreamsnap_entries e on e.entry_id=gp.entry_id
        join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
        join public.community_works w on w.work_id=gp.work_id
        join public.community_work_revisions cr
          on cr.revision_id=wrm.work_revision_id and cr.work_id=w.work_id
        join public.dreamsnap_work_revisions dr
          on dr.revision_id=gp.revision_id and dr.integrity_state='eligible'
        where wrm.media_id=m.media_id
          and wrm.role='dreamsnap' and wrm.ordinal=0
          and gp.work_id=e.work_id
          and m.owner_account_id=w.owner_account_id
          and gp.publication_state='published'
          and c.is_synthetic=false
          and c.lifecycle_state in ('results','closed')
          and e.entry_state='entered'
          and e.eligibility_state='eligible'
          and w.lifecycle_state='published'
          and w.visibility='public'
          and w.moderation_state='clear'
          and e.account_id=w.owner_account_id
          and e.managed_under13=false
          and private.dreamsnap_public_work_accessible_r20(w.work_id)
      )
      or exists(
        select 1
        from public.work_revision_media wrm
        join public.dreamsnap_entries e on e.entry_revision_id=wrm.work_revision_id
        join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
        join public.community_works w on w.work_id=e.work_id
        join public.community_work_revisions cr
          on cr.revision_id=wrm.work_revision_id and cr.work_id=w.work_id
        join public.dreamsnap_work_revisions dr
          on dr.revision_id=e.entry_revision_id and dr.integrity_state='eligible'
        where wrm.media_id=m.media_id
          and wrm.role='dreamsnap' and wrm.ordinal=0
          and m.owner_account_id=w.owner_account_id
          and c.is_synthetic=false
          and c.lifecycle_state in ('results','closed')
          and e.entry_state='entered'
          and e.eligibility_state='eligible'
          and e.account_id=w.owner_account_id
          and e.managed_under13=false
          and w.lifecycle_state='published'
          and w.visibility='public'
          and w.moderation_state='clear'
          and private.dreamsnap_public_work_accessible_r20(w.work_id)
      )
    );

  if v_result is null then raise exception 'Public media is not accessible'; end if;
  return v_result;
end
$$;
