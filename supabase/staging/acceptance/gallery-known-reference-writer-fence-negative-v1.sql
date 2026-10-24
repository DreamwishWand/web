-- 09 INT Issue #119 shared Gallery Work lock participation, LIVE STAGING, rollback only.
-- Requires migration 20261025002400_gallery_known_reference_writer_fence_v1.sql.
-- No positive retirement, permanent Work change, or Storage mutation.
BEGIN;
DO $accept$
DECLARE
  g uuid; preset_id uuid; preset_work uuid; preset_rev uuid; owner_id uuid;
  g_rev uuid:=gen_random_uuid(); p_work_rev uuid:=gen_random_uuid();
  initial_version bigint;
  initial_graph text;
  v_count int;
  v_expected_error boolean:=false;
BEGIN
  SELECT gr.work_id,pa.preset_artifact_id,pa.community_work_id,
    gp.preset_revision_id,gw.owner_account_id,gw.row_version
  INTO g,preset_id,preset_work,preset_rev,owner_id,initial_version
  FROM public.gallery_revision_presets gp
  JOIN public.community_work_revisions gr ON gr.revision_id=gp.gallery_revision_id
  JOIN public.community_works gw ON gw.work_id=gr.work_id
  JOIN public.preset_revisions pr ON pr.preset_revision_id=gp.preset_revision_id
  JOIN public.preset_artifacts pa ON pa.preset_artifact_id=pr.preset_artifact_id
  WHERE gw.work_type='gallery' ORDER BY gp.gallery_revision_id LIMIT 1;
  IF g IS NULL OR preset_work IS NULL OR preset_rev IS NULL THEN
    RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_FIXTURE_MISSING';
  END IF;
  initial_graph:=private.gallery_photo_dependency_snapshot_v1(g)->>'graphFingerprintSha256';

  SELECT count(*) INTO v_count FROM pg_trigger t
  WHERE t.tgenabled='O' AND t.tgname IN (
    'gallery_revision_presets_known_reference_fence',
    'preset_artifacts_known_gallery_reference_fence',
    'preset_revision_publications_known_gallery_reference_fence');
  IF v_count<>3 THEN RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_TRIGGER_COUNT_INVALID'; END IF;

  IF has_function_privilege('anon','private.gallery_known_reference_writer_fence_v1()','EXECUTE')
    OR has_function_privilege('authenticated','private.gallery_known_reference_writer_fence_v1()','EXECUTE')
    OR has_function_privilege('service_role','private.gallery_known_reference_writer_fence_v1()','EXECUTE')
  THEN RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_FUNCTION_EXPOSED'; END IF;

  UPDATE public.preset_artifacts
    SET associated_gallery_work_id=associated_gallery_work_id
    WHERE preset_artifact_id=preset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_ASSOCIATION_PATH_NOT_TESTED'; END IF;

  INSERT INTO public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
  VALUES (g_rev,g,(SELECT coalesce(max(revision_number),0)+1 FROM
    public.community_work_revisions WHERE work_id=g),owner_id,'{}'::jsonb);
  INSERT INTO public.gallery_work_revisions(revision_id,title,description)
  VALUES(g_rev,'09 INT no-commit writer fence test',null);
  INSERT INTO public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
  VALUES(g_rev,preset_rev);

  INSERT INTO public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
  VALUES(p_work_rev,preset_work,(SELECT coalesce(max(revision_number),0)+1 FROM
    public.community_work_revisions WHERE work_id=preset_work),owner_id,'{}'::jsonb);
  INSERT INTO public.preset_revision_publications(work_revision_id,preset_revision_id)
  VALUES(p_work_rev,preset_rev);

  IF private.gallery_photo_dependency_snapshot_v1(g)->>'graphFingerprintSha256'
    IS NOT DISTINCT FROM initial_graph THEN
    RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_INSERT_GRAPH_NOT_DETECTED';
  END IF;
  IF (SELECT row_version FROM public.community_works WHERE work_id=g)
    IS DISTINCT FROM initial_version THEN
    RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_WORK_ROW_VERSION_WRITTEN';
  END IF;
  IF (private.gallery_photo_dependency_snapshot_v1(g)->>'graphComplete')<>'false'
    OR (private.gallery_photo_dependency_snapshot_v1(g)->>'retirementAuthorized')<>'false'
  THEN RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_RETIREMENT_BYPASS'; END IF;

  BEGIN
    INSERT INTO public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
    VALUES(gen_random_uuid(),preset_rev);
  EXCEPTION WHEN OTHERS THEN
    IF position('GALLERY_REFERENCE_FENCE_GALLERY_REVISION_UNRESOLVED' in SQLERRM)>0 THEN
      v_expected_error:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_expected_error THEN
    RAISE EXCEPTION 'GALLERY_KNOWN_FENCE_UNKNOWN_GALLERY_REFERENCE_ACCEPTED';
  END IF;
  RAISE NOTICE 'GALLERY_KNOWN_FENCE_THREE_SOURCE_WRITERS_BEGIN_ROLLBACK_PASS';
END
$accept$;
ROLLBACK;
SELECT 'ROLLBACK_PASS' AS outcome;
