-- 03 COMM R14 Issue #119. Additive Owner Source runtime enrollment, not the
-- 09 INT validation-only Python wrapper and NOT global all-writer acceptance.
-- Existing v4 signature, no new Edge RPC or public positive authority.
-- Scope: Gallery no-Preset publication, or a single linked SCENE preset;
-- every unenumerated preset kind/source fails closed.
create or replace function private.gallery_v4_scoped_graph_r14(
  p_gallery_work_id uuid,p_requested_revisions uuid[]
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $graph$
declare
  v_artifacts uuid[]:=array[]::uuid[];
  v_preset_works uuid[]:=array[]::uuid[];
  v_galleries uuid[]:=array[]::uuid[];
  v_allworks uuid[]:=array[]::uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(distinct artifact_id order by artifact_id),array[]::uuid[])
    into v_artifacts from (
      select pr.preset_artifact_id artifact_id
      from public.preset_revisions pr
      where pr.preset_revision_id=any(p_requested_revisions)
      union
      select pa.preset_artifact_id artifact_id
      from public.preset_artifacts pa
      where pa.associated_gallery_work_id=p_gallery_work_id
      union
      select pr.preset_artifact_id artifact_id
      from public.gallery_revision_presets gp
      join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
      join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id
      where r.work_id=p_gallery_work_id
    ) paths where artifact_id is not null;

  if (select count(distinct r.preset_revision_id)
      from public.preset_revisions r
      where r.preset_revision_id=any(p_requested_revisions))
      <> cardinality(p_requested_revisions) then
    raise exception 'R14_PRESET_REVISION_UNRESOLVED';
  end if;

  select coalesce(array_agg(distinct community_work_id order by community_work_id),array[]::uuid[])
  into v_preset_works
  from public.preset_artifacts
  where preset_artifact_id=any(v_artifacts) and community_work_id is not null;

  select coalesce(array_agg(distinct gallery_work_id order by gallery_work_id),array[]::uuid[])
  into v_galleries
  from (
    select p_gallery_work_id gallery_work_id
    union select pa.associated_gallery_work_id
      from public.preset_artifacts pa
      where pa.preset_artifact_id=any(v_artifacts)
    union select gr.work_id
      from public.gallery_revision_presets gp
      join public.community_work_revisions gr on gr.revision_id=gp.gallery_revision_id
      join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
      where pr.preset_artifact_id=any(v_artifacts)
  ) refs where gallery_work_id is not null;

  select coalesce(array_agg(distinct id order by id),array[]::uuid[])
    into v_allworks
  from (
    select unnest(v_preset_works) as id
    union select unnest(v_galleries) as id
  ) ids;

  v_result:=jsonb_build_object(
    'registry','gallery-scene-scoped@r14',
    'artifactIds',to_jsonb(v_artifacts),
    'presetWorkIds',to_jsonb(v_preset_works),
    'galleryWorkIds',to_jsonb(v_galleries),
    'artifacts',coalesce((select jsonb_agg(to_jsonb(pa) order by pa.preset_artifact_id)
       from public.preset_artifacts pa where pa.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'presetRevisions',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.preset_revision_id)
       from public.preset_revisions pr where pr.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'presetPublications',coalesce((select jsonb_agg(to_jsonb(pp) order by pp.work_revision_id)
       from public.preset_revision_publications pp
       join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
       where pr.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'historicalPresetLinks',coalesce((select jsonb_agg(to_jsonb(gp)
       order by gp.gallery_revision_id,gp.preset_revision_id)
       from public.gallery_revision_presets gp
       join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
       where pr.preset_artifact_id=any(v_artifacts)),'[]'::jsonb),
    'works',coalesce((select jsonb_agg(to_jsonb(w) order by w.work_id)
       from public.community_works w where w.work_id=any(v_allworks)),'[]'::jsonb),
    'workRevisions',coalesce((select jsonb_agg(to_jsonb(r) order by r.revision_id)
       from public.community_work_revisions r where r.work_id=any(v_allworks)),'[]'::jsonb),
    'mediaReferences',coalesce((select jsonb_agg(to_jsonb(rm)
       order by rm.work_revision_id,rm.ordinal)
       from public.work_revision_media rm
       join public.community_work_revisions wr on wr.revision_id=rm.work_revision_id
       where wr.work_id=any(v_galleries)),'[]'::jsonb),
    'coverReferences',coalesce((select jsonb_agg(to_jsonb(cf)
       order by cf.revision_id)
       from public.gallery_photo_revision_fields cf
       join public.community_work_revisions wr on wr.revision_id=cf.revision_id
       where wr.work_id=any(v_galleries)),'[]'::jsonb)
  );
  return v_result;
end;
$graph$;
revoke all on function private.gallery_v4_scoped_graph_r14(uuid,uuid[])
  from public,anon,authenticated,service_role;

