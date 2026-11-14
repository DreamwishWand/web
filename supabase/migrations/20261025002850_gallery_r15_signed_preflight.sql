create or replace function public.community_gallery_graph_preflight_r15(
  p_auth_subject uuid,p_work_id uuid,p_preset_revision_ids uuid[] default array[]::uuid[]
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,extensions
as $r15$
declare v_snapshot jsonb;v_sha text;
begin
  v_snapshot:=private.gallery_r15_canonical_snapshot(p_auth_subject,p_work_id,p_preset_revision_ids);
  v_sha:=encode(digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object(
    'schemaVersion',1,'registryVersion','gallery-scene-scoped@r15',
    'expectedGraphSha256',v_sha,
    'expectedGraph',v_snapshot,
    'expectedWorkStates',v_snapshot#>'{graph,works}',
    'expectedArtifactIds',v_snapshot#>'{graph,artifactIds}',
    'expectedPresetWorkIds',v_snapshot#>'{graph,presetWorkIds}',
    'expectedGalleryWorkIds',v_snapshot#>'{graph,galleryWorkIds}',
    'historicalPresetLinks',v_snapshot#>'{graph,historicalPresetLinks}',
    'mediaReferences',v_snapshot#>'{graph,mediaReferences}',
    'coverReferences',v_snapshot#>'{graph,coverReferences}',
    'authoritative',true,'graphComplete',false);
end;$r15$;
revoke all on function public.community_gallery_graph_preflight_r15(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.community_gallery_graph_preflight_r15(uuid,uuid,uuid[]) to service_role;

