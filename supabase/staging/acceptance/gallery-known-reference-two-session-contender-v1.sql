-- CONDITIONAL 09 INT test. Must run against SAME Staging DB from a SECOND
-- real connection DURING Session A's 15s row lock, not via serialized runner.
-- Existing PresetAssociation unchanged, rollback even if contention seen.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $session_b$
DECLARE v_preset uuid; v_blocked boolean:=false;
BEGIN
  SELECT pa.preset_artifact_id INTO v_preset
    FROM public.preset_artifacts pa
    JOIN public.community_works w ON w.work_id=pa.associated_gallery_work_id
    WHERE pa.associated_gallery_work_id IS NOT NULL AND w.work_type='gallery'
    ORDER BY pa.preset_artifact_id LIMIT 1;
  IF v_preset IS NULL THEN RAISE EXCEPTION 'GALLERY_TWO_SESSION_FIXTURE_MISSING'; END IF;
  BEGIN
    UPDATE public.preset_artifacts
      SET associated_gallery_work_id=associated_gallery_work_id
      WHERE preset_artifact_id=v_preset;
  EXCEPTION WHEN lock_not_available THEN v_blocked:=true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'GALLERY_TWO_SESSION_LOCK_CONTENTION_NOT_OBSERVED';
  END IF;
  RAISE NOTICE 'SESSION_B_ASSOCIATED_GALLERY_WRITER_BLOCKED_BY_SHARED_WORK_LOCK';
END
$session_b$;
ROLLBACK;
SELECT 'SESSION_B_BLOCKED_AND_ROLLED_BACK' AS result;
