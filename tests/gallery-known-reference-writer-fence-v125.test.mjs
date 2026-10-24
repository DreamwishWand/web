import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261025002200_gallery_known_reference_writer_fence_v1.sql');
const acceptance=read('supabase/staging/acceptance/gallery-known-reference-writer-fence-negative-v1.sql');
test('one shared Work row lock is acquired for three existing reverse-reference insert/bind paths',()=>{
 assert.match(sql,/create or replace function private\.gallery_known_reference_writer_fence_v1\(\)/);
 for(const table of ['gallery_revision_presets','preset_artifacts','preset_revision_publications'])
   assert.match(sql,new RegExp("tg_table_name='"+table+"'"));
 for(const name of ['gallery_revision_presets_known_reference_fence',
  'preset_artifacts_known_gallery_reference_fence',
  'preset_revision_publications_known_gallery_reference_fence'])
  assert.match(sql,new RegExp("create trigger "+name));
 assert.match(sql,/where w.work_id=v_id and w.work_type='gallery'\s+for update/);
 assert.match(sql,/array_agg\(distinct x.gallery_work_id order by x.gallery_work_id\)/);
 assert.match(sql,/select old.associated_gallery_work_id as id/);
 assert.match(sql,/select new.associated_gallery_work_id as id/);
 assert.match(sql,/gallery_revision_presets gp/);
});
test('only existing relation DB trigger, never launch permission, authoring or public API',()=>{
 assert.doesNotMatch(sql,/create\s+table/i);
 assert.doesNotMatch(sql,/create\s+or\s+replace\s+function\s+public\.community_/i);
 assert.doesNotMatch(sql,/update\s+public\.community_works/i);
 assert.doesNotMatch(sql,/delete\s+from\s+public/i);
 assert.doesNotMatch(sql,/grant execute on function private\.gallery_known_reference_writer_fence_v1\(\)/i);
 assert.match(sql,/revoke all on function private\.gallery_known_reference_writer_fence_v1\(\)\s+from public,anon,authenticated,service_role/);
 assert.match(sql,/This DOES NOT fence public preset Work visibility\/current-revision changes/);
 const negative=read('src/lib/integration/gallery-atomic-retirement-preconditions-v125.ts');
 assert.match(negative,/operationAuthorized:false/);
 assert.match(negative,/graphComplete:false/);
 assert.match(negative,/GALLERY_POSITIVE_RETIREMENT_NOT_IMPLEMENTED/);
});
test('Staging rollback test exercises actual association, revision and publication writes and prevents premature retirement',()=>{
 assert.match(acceptance,/BEGIN\s*;/);
 assert.match(acceptance,/ROLLBACK\s*;/);
 assert.match(acceptance,/UPDATE public.preset_artifacts/);
 assert.match(acceptance,/INSERT INTO public.gallery_revision_presets/);
 assert.match(acceptance,/INSERT INTO public.preset_revision_publications/);
 assert.match(acceptance,/graphFingerprintSha256/);
 assert.match(acceptance,/GALLERY_KNOWN_FENCE_RETIREMENT_BYPASS/);
 assert.match(acceptance,/GALLERY_REFERENCE_FENCE_GALLERY_REVISION_UNRESOLVED/);
});
test('separate-session acceptance fixture is executable but not claimed run by static CI',()=>{
 const a=read('supabase/staging/acceptance/gallery-known-reference-two-session-holder-v1.sql');
 const b=read('supabase/staging/acceptance/gallery-known-reference-two-session-contender-v1.sql');
 assert.match(a,/FOR UPDATE/);assert.match(a,/pg_sleep\(15\)/);
 assert.match(a,/ROLLBACK\s*;/);
 assert.match(b,/lock_timeout='2s'/);
 assert.match(b,/EXCEPTION WHEN lock_not_available/);
 assert.match(b,/GALLERY_TWO_SESSION_LOCK_CONTENTION_NOT_OBSERVED/);
 assert.match(b,/ROLLBACK\s*;/);
});
