-- 09 INT #119: source-verified atomic retirement NEGATIVE-only transaction probe.
-- Run through Staging SQL BEGIN/ROLLBACK, never as an operation or live remove.
-- Acquiring locks on the Work and its existing immutable revisions DOES NOT
-- lock the whole graph: all edge writers must participate in a shared fence.
BEGIN;
DO $probe$
DECLARE
  target uuid;
  record public.community_works%ROWTYPE;
  before_snapshot jsonb;
  locked_snapshot jsonb;
  required_incomplete int;
  edge_fk_present boolean;
  shared_preset_publisher boolean;
  native_listing_count int;
BEGIN
  select work_id into target from public.community_works
    where work_type='gallery' order by work_id limit 1;
  if target is null then raise exception 'GALLERY_SOURCE_FIXTURE_REQUIRED'; end if;
  before_snapshot:=private.gallery_photo_dependency_snapshot_v1(target);
  -- A serializable future mutation would acquire the same canonical lock
  -- before snapshot, and every direct/indirect reference writer must cooperate.
  select * into record from public.community_works where work_id=target for update;
  perform 1 from public.community_work_revisions
    where work_id=target order by revision_id for update;
  perform 1 from public.gallery_work_revisions gr
    join public.community_work_revisions cr on cr.revision_id=gr.revision_id
    where cr.work_id=target for update of gr;
  locked_snapshot:=private.gallery_photo_dependency_snapshot_v1(target);
  if before_snapshot->>'graphFingerprintSha256' is distinct from
     locked_snapshot->>'graphFingerprintSha256'
    or before_snapshot->>'galleryRowVersion' is distinct from
     locked_snapshot->>'galleryRowVersion'
    then raise exception 'GALLERY_GRAPH_PIN_CHANGED_AFTER_LOCK'; end if;
  select exists (
    select 1 from pg_constraint c
    where c.conrelid='public.gallery_revision_presets'::regclass
      and c.contype='f' and c.confrelid='public.gallery_work_revisions'::regclass)
    into edge_fk_present;
  select exists(select 1 from pg_proc
    where oid='public.community_publish_preset_envelope(uuid,uuid,text,text,text,text,text,integer,text,bigint,text,jsonb,text)'::regprocedure)
    into shared_preset_publisher;
  if not edge_fk_present or not shared_preset_publisher then
    raise exception 'GALLERY_ATOMIC_SOURCE_AUTHORITY_MISSING'; end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='preset_artifacts'
      and column_name='associated_gallery_work_id')
    then raise exception 'GALLERY_ASSOCIATION_SOURCE_MISSING'; end if;
  if not exists (select 1 from information_schema.tables
    where table_schema='public' and table_name='preset_revision_publications')
    then raise exception 'GALLERY_PUBLICATION_SOURCE_MISSING'; end if;
  if locked_snapshot->>'graphComplete' <> 'false' or
      locked_snapshot->>'retirementAuthorized' <> 'false' then
    raise exception 'GALLERY_ATOMIC_POSITIVE_AUTHORIZATION_LEAK'; end if;
  select count(*) into required_incomplete
   from jsonb_each_text(locked_snapshot->'coverageClassification') x
   where x.value not in ('VERIFIED','VERIFIED_EMPTY');
  if required_incomplete<1 then
    raise exception 'GALLERY_INCOMPLETE_DEPENDENCY_REGISTRY_NOT_REPORTED'; end if;
  if locked_snapshot->'coverageClassification'->>'native_listing'
       <> 'REGISTRY_MISSING' then
    raise exception 'GALLERY_NATIVE_LISTING_REGISTRY_FALSIFIED'; end if;
  -- Even work and revision locks + fingerprint do NOT prove protection from
  -- future insert/update through all Preset/ToM/native listing writers.
  raise notice 'GALLERY_ATOMIC_RETIREMENT_NOT_AUTHORIZED: graph incomplete; held work/revision locks are insufficient';
END
$probe$;
ROLLBACK;
