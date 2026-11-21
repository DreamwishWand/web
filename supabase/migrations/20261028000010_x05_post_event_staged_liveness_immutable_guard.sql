-- 03 COMM X05 / independent QR239 five full-schema LOCAL RED repairs.
-- Forward-only follow-up to Source147. Source141-147 bytes and all Reader,
-- Edge, Signer, Incident/Privacy helper implementations stay unchanged.
-- The only function replaced is the new private Source147 STAGED validator.
-- No public grants, no new publication/writer/cleanup paths.
create or replace function private.dreamsnap_post_event_stage_validate_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $guard$
begin
  -- Preserve the original snapshot even when the proposed replacement is a
  -- separately valid READY/eligible photograph of the SAME Work.
  if tg_op='UPDATE' and (
       new.immutable_photo_revision_id is distinct from old.immutable_photo_revision_id
    or new.media_id is distinct from old.media_id
  ) then
    raise exception 'X05_POST_EVENT_IMMUTABLE_PHOTO_MEDIA_REBIND';
  end if;

  if not exists (
    select 1
    from public.community_works w
    join public.wand_accounts a on a.account_id=w.owner_account_id
    join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
      and cp.owner_account_id=w.owner_account_id
    join public.community_entities ce on ce.entity_id=cp.creator_profile_id
    join public.dreamsnap_works dw on dw.work_id=w.work_id
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
      and w.moderation_state='clear'
      and a.status='active'
      and a.deleted_at is null
      and ce.deleted_at is null
      and cp.moderation_state='clear'
      and not private.is_account_privacy_suppressed(w.owner_account_id)
      and exists (
        select 1 from public.auth_identities ai
        where ai.account_id=w.owner_account_id
          and ai.provider='supabase'
          and ai.identity_state='active'
      )
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

-- Restrict explicit invocation as well as the unchanged STAGED table DML.
revoke all on function private.dreamsnap_post_event_stage_validate_v1()
  from public,anon,authenticated,service_role;
comment on function private.dreamsnap_post_event_stage_validate_v1() is
  'X05 Source148 repaired private STAGED-only validator: active live owner/auth/Creator and no privacy suppression, private Work, eligible same-owner ready photo+revision; old photograph and MediaID immutable across UPDATE. Publication hard STAGED; no signers or public routes.';
