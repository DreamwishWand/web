-- 03 COMM X05 / wand.dreamsnaps.public-work-detail-metadata@1
-- This is an unrouted metadata-only candidate. It neither grants PUBLIC/anon
-- access nor authorizes PostEvent publishing, Storage keys, image URLs or signers.
-- Source141..146 remain unchanged; official DDV numbers remain NULL even ON.
--
-- The existing Gallery Publication/Entry tables are competition-only. A
-- PostEvent Work gets its own WorkID and NEVER a synthetic EntryID.
create table private.dreamsnap_post_event_staged_v1 (
  work_id uuid primary key references public.dreamsnap_works(work_id) on delete cascade,
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id),
  creator_profile_id uuid not null references public.creator_profiles(creator_profile_id),
  immutable_photo_revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  media_id uuid not null references public.media_assets(media_id),
  concept_revision_id uuid not null references public.community_work_revisions(revision_id),
  official_voting_authority text not null default 'unknown'
    check (official_voting_authority = 'unknown'),
  wand_voting_authority text not null default 'unknown'
    check (wand_voting_authority = 'unknown'),
  rights_provenance text not null default 'unknown'
    check (rights_provenance = 'unknown'),
  publication_state text not null default 'staged'
    check (publication_state = 'staged'),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint x05_no_competition_entry_in_staging
    check (publication_state <> 'published')
);
create index x05_post_event_staged_challenge_idx
  on private.dreamsnap_post_event_staged_v1(challenge_id,work_id);
-- This trigger validates the structural reference tuple before even staging.
-- It cannot establish official DDV phase/rights; those stay hard UNKNOWN.
create or replace function private.dreamsnap_post_event_stage_validate_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $guard$
begin
  if not exists (
    select 1
    from public.community_works w
    join public.dreamsnap_works dw on dw.work_id=w.work_id
    join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
       and cp.owner_account_id=w.owner_account_id
    join public.dreamsnap_challenges c on c.challenge_id=dw.challenge_id
    join public.community_work_revisions image_revision
       on image_revision.revision_id=new.immutable_photo_revision_id
       and image_revision.work_id=w.work_id
    join public.dreamsnap_work_revisions dr
       on dr.revision_id=image_revision.revision_id
       and dr.challenge_id=c.challenge_id
       and dr.integrity_state='eligible'
    join public.work_revision_media wrm
       on wrm.work_revision_id=image_revision.revision_id
       and wrm.media_id=new.media_id
       and wrm.role='dreamsnap' and wrm.ordinal=0
    join public.media_assets m on m.media_id=wrm.media_id
       and m.owner_account_id=w.owner_account_id
       and m.processing_state='ready'
       and m.moderation_state='clear' and m.purged_at is null
    join public.community_work_revisions concept_revision
       on concept_revision.revision_id=new.concept_revision_id
       and concept_revision.work_id=w.work_id
    where w.work_id=new.work_id
      and w.work_type='dreamsnap'
      and w.creator_profile_id=new.creator_profile_id
      and dw.challenge_id=new.challenge_id
      and dw.managed_under13=false
      and w.visibility='private'
      and w.lifecycle_state in ('draft','published')
      and w.current_published_revision_id=new.concept_revision_id
      and c.is_synthetic=false
      and c.lifecycle_state in ('results','closed')
      and not exists (select 1 from public.dreamsnap_entries e
        where e.work_id=w.work_id)
      and not exists (select 1 from public.dreamsnap_gallery_publications gp
        where gp.work_id=w.work_id)
  ) then raise exception 'X05_POST_EVENT_STAGING_PROVENANCE_UNVERIFIED'; end if;
  return new;
end
$guard$;
revoke all on function private.dreamsnap_post_event_stage_validate_v1()
  from public,anon,authenticated,service_role;
create trigger x05_post_event_stage_guard before insert or update
on private.dreamsnap_post_event_staged_v1
for each row execute function private.dreamsnap_post_event_stage_validate_v1();
revoke all on private.dreamsnap_post_event_staged_v1
  from public,anon,authenticated,service_role;
comment on table private.dreamsnap_post_event_staged_v1 is
  'X05 staging only: no EntryID, no public publisher; official+WAND voting closure, rights and real provenance remain NEED_SOURCE/NEED_RUNTIME. Never infer release from Challenge results/closed alone.';

-- The private projection is intentionally not exposed through the public-query
-- Edge allowlist, REST or a public SQL GRANT. Original is reused from Source145;
-- PostEvent always remains unavailable until independently attested authorities
-- and an ADDITIVE later activation contract are accepted.
create or replace function private.dreamsnap_shared_public_work_metadata_v1(
  p_work_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $x05$
declare
  v_original jsonb;
  v_identity record;
begin
  if p_work_id is null then return null; end if;
  if not coalesce(private.dreamsnap_public_work_accessible_r20(p_work_id),false)
  then return null; end if;

  -- Do not fall back to a competition Entry or fabricate an EntryID.
  if exists(select 1 from private.dreamsnap_post_event_staged_v1
            where work_id=p_work_id)
  then return null; end if;

  -- Restrict the extra shared projection to the proven frozen Entry snapshot.
  -- A future Concept-only update requires a separately accepted revision model.
  select w.creator_profile_id,
         e.entry_id,
         e.entry_revision_id,
         gp.revision_id as published_revision_id,
         c.challenge_id
  into v_identity
  from public.community_works w
  join public.dreamsnap_gallery_publications gp on gp.work_id=w.work_id
  join public.dreamsnap_entries e
    on e.entry_id=gp.entry_id and e.work_id=w.work_id
  join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
  join public.dreamsnap_works dw
    on dw.work_id=w.work_id and dw.challenge_id=c.challenge_id
  where w.work_id=p_work_id
    and w.work_type='dreamsnap'
    and w.lifecycle_state='published'
    and w.visibility='public'
    and gp.publication_state='published'
    and gp.revision_id=e.entry_revision_id
    and w.current_published_revision_id=e.entry_revision_id
    and e.entry_state='entered'
    and e.eligibility_state='eligible'
    and e.managed_under13=false
    and c.is_synthetic=false
    and c.lifecycle_state in ('results','closed')
    and private.dreamsnap_public_work_accessible_r20(w.work_id);
  if not found then return null; end if;

  -- The prior independently accepted Source145 reader is a second full guard.
  -- Its result is NOT a media capability: it is only a metadata source.
  begin
    v_original:=public.community_get_gallery_dreamsnap_public_v1(p_work_id);
  exception when others then
    return null;
  end;
  if v_original is null or v_original->>'mediaId' is null
     or v_original->>'creatorProfileId' is distinct from
        v_identity.creator_profile_id::text
     or v_original->>'challengeId' is distinct from
        v_identity.challenge_id::text
  then return null; end if;

  return jsonb_build_object(
    'contractVersion','wand.dreamsnaps.public-work-detail-metadata@1',
    'kind','OriginalCompetition',
    'workId',p_work_id,
    'creatorProfileId',v_identity.creator_profile_id,
    'challengeId',v_identity.challenge_id,
    'entryId',v_identity.entry_id,
    'entryRevisionId',v_identity.entry_revision_id,
    'publishedRevisionId',v_identity.published_revision_id,
    'mediaId',v_original->'mediaId',
    'caption',v_original->'caption',
    'publishedAt',v_original->'publishedAt',
    'creator',v_original->'creator',
    'commentsEnabled',false,
    'wandRank',null,
    'officialDdvRank',null,
    'capabilities',jsonb_build_object(
      'metadata',true,
      'media',false,
      'social',false,
      'officialResults',false,
      'conceptUpdate',false,
      'delete',false
    )
  );
end
$x05$;
revoke all on function private.dreamsnap_shared_public_work_metadata_v1(uuid)
  from public,anon,authenticated,service_role;
comment on function private.dreamsnap_shared_public_work_metadata_v1(uuid) is
  'X05 private/unrouted metadata only. Original through Source145 and frozen Entry; staged PostEvent denied. No Edge/public/signed media authority; NULL means unavailable.';
