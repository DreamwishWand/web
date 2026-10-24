-- CONDITIONAL 09 INT test. Requires a TRUE separate PostgreSQL connection.
-- Execute in Session A first, then in Session B while A sleeps.
-- Do NOT execute as a single sequential SQL editor batch.
-- Real existing Gallery/Scene association; NO DML and rollback.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $session_a$
DECLARE v_gallery uuid;
BEGIN
  SELECT pa.associated_gallery_work_id INTO v_gallery
    FROM public.preset_artifacts pa
    JOIN public.community_works w ON w.work_id=pa.associated_gallery_work_id
    WHERE pa.associated_gallery_work_id IS NOT NULL AND w.work_type='gallery'
    ORDER BY pa.preset_artifact_id LIMIT 1;
  IF v_gallery IS NULL THEN RAISE EXCEPTION 'GALLERY_TWO_SESSION_FIXTURE_MISSING'; END IF;
  PERFORM 1 FROM public.community_works WHERE work_id=v_gallery FOR UPDATE;
  RAISE NOTICE 'SESSION_A_WORK_ROW_LOCK_HELD (start Session B now)';
  PERFORM pg_sleep(15);
END
$session_a$;
ROLLBACK;
SELECT 'SESSION_A_ROLLBACK' AS result;
