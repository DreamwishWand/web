-- 09 INT Issue #119 / Gallery known-relationship writer fence v1
-- Version applicability of verified subjects: Switch DDV v1.25.0
-- BID 52BD625D9B4E0053, schema 624. This DB lock is independent of
-- native save writing and is not an authorization to retire public Gallery.
--
-- Additive, minimal participation for THREE deployed reverse-link writers:
-- gallery_revision_presets INSERT, preset_artifacts associated Gallery binding,
-- and preset_revision_publications INSERT where an existing related Gallery
-- can be identified. No new model, public RPC, API or positive retirement.
--
-- LOCK ORDER for this guard: gather distinct Gallery work UUIDs, sort ascending,
-- then SELECT community_works FOR UPDATE. Other writer-held locks are NOT
-- comprehensively ordered; no global all-writer deadlock/race claim.
--
-- This DOES NOT fence public preset Work visibility/current-revision changes,
-- Search/Documents, future Biome/ToM/Native listing registries, or storage.
-- All Gallery Delete/Unpublish/Cloud/physical removal remains hard-blocked.

create or replace function private.gallery_known_reference_writer_fence_v1()
returns trigger
language plpgsql
set search_path=pg_catalog,public,private
as $fence$
declare
  v_gallery_ids uuid[] := array[]::uuid[];
  v_id uuid;
  v_seen uuid;
begin
  if tg_table_schema<>'public' then
    raise exception 'GALLERY_REFERENCE_FENCE_SCHEMA_INVALID';
  end if;

  if tg_table_name='gallery_revision_presets' and tg_op='INSERT' then
    select coalesce(array_agg(distinct r.work_id order by r.work_id),array[]::uuid[])
      into v_gallery_ids
    from public.community_work_revisions r
    where r.revision_id=new.gallery_revision_id;

    if cardinality(v_gallery_ids)<>1 then
      raise exception 'GALLERY_REFERENCE_FENCE_GALLERY_REVISION_UNRESOLVED';
    end if;

  elsif tg_table_name='preset_artifacts' and tg_op in ('INSERT','UPDATE') then
    -- Lock BOTH old and new Gallery Works when changing the reference.
    -- On UPDATE, NEW-associated and OLD-associated may differ.
    if tg_op='INSERT' then
      select coalesce(array_agg(distinct id order by id),array[]::uuid[])
        into v_gallery_ids from (
          select new.associated_gallery_work_id as id
        ) refs where refs.id is not null;
    else
      select coalesce(array_agg(distinct id order by id),array[]::uuid[])
        into v_gallery_ids from (
          select new.associated_gallery_work_id as id
          union all
          select old.associated_gallery_work_id as id
        ) refs where refs.id is not null;
    end if;

  elsif tg_table_name='preset_revision_publications' and tg_op='INSERT' then
    -- A Preset publication can make an earlier GalleryRevision->PresetRevision
    -- reference publicly eligible; capture both direct and associated links.
    select coalesce(array_agg(distinct x.gallery_work_id order by x.gallery_work_id),array[]::uuid[])
      into v_gallery_ids
    from (
      select pa.associated_gallery_work_id as gallery_work_id
      from public.preset_revisions pr
      join public.preset_artifacts pa on pa.preset_artifact_id=pr.preset_artifact_id
      where pr.preset_revision_id=new.preset_revision_id
      union all
      select gr.work_id as gallery_work_id
      from public.gallery_revision_presets gp
      join public.community_work_revisions gr on gr.revision_id=gp.gallery_revision_id
      where gp.preset_revision_id=new.preset_revision_id
    ) x where x.gallery_work_id is not null;

  else
    raise exception 'GALLERY_REFERENCE_FENCE_TRIGGER_CONTEXT_UNSUPPORTED';
  end if;

  foreach v_id in array v_gallery_ids loop
    select w.work_id into v_seen
    from public.community_works w
    where w.work_id=v_id and w.work_type='gallery'
    for update;
    if v_seen is null then
      raise exception 'GALLERY_REFERENCE_FENCE_TARGET_INVALID';
    end if;
    v_seen:=null;
  end loop;

  return new;
end
$fence$;

revoke all on function private.gallery_known_reference_writer_fence_v1()
  from public,anon,authenticated,service_role;

drop trigger if exists gallery_revision_presets_known_reference_fence
  on public.gallery_revision_presets;
create trigger gallery_revision_presets_known_reference_fence
  before insert on public.gallery_revision_presets
  for each row execute function private.gallery_known_reference_writer_fence_v1();

drop trigger if exists preset_artifacts_known_gallery_reference_fence
  on public.preset_artifacts;
create trigger preset_artifacts_known_gallery_reference_fence
  before insert or update of associated_gallery_work_id on public.preset_artifacts
  for each row execute function private.gallery_known_reference_writer_fence_v1();

drop trigger if exists preset_revision_publications_known_gallery_reference_fence
  on public.preset_revision_publications;
create trigger preset_revision_publications_known_gallery_reference_fence
  before insert on public.preset_revision_publications
  for each row execute function private.gallery_known_reference_writer_fence_v1();
