import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const r=read('supabase/migrations/20261025002890_community_writer_registry_r16.sql');
const writer=read('supabase/migrations/20261025002900_gallery_comments_atomic_r16.sql');
const acl=read('supabase/migrations/20261025002910_gallery_comments_atomic_r16_acl.sql');
const edge=read('supabase/functions/community-command/index.ts');
const work=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');
test('R16 registry enumerates cross-product known and explicitly unknown references without promoting all writers',()=>{
 for(const s of ['ddv.writer-reference@r16','HISTORICAL','SOURCE_PRESENT_UNENROLLED','SAFETY_INDEPENDENT','UNKNOWN','FAIL_CLOSED',
 'gallery-revision-presets','gallery-photo-cover','gallery-media-intent','native-in-game-preset','deferred-erasure','preset-revision-blob',
 'biome-preset-native','floating-island-native','tom-furniture-native','tom-clothing-native','account-privacy-phase1'])assert.ok(r.includes(s),s);
 assert.match(r,/create table if not exists private\.community_writer_reference_registry_r16/);
 assert.match(r,/create table if not exists private\.community_writer_routes_r16/);
 assert.match(r,/enable row level security/);
 assert.match(r,/revoke all on private\.community_writer_routes_r16 from public,anon,authenticated,service_role/);
 assert.match(r,/grant select on private\.community_writer_routes_r16 to service_role/);
 assert.doesNotMatch(r,/graphComplete',true|retirementAuthorized',true/);
});
test('R16 incremental Writer is metadata-only, account-first and no optimistic stale repin',()=>{
 const root=writer.indexOf('from public.wand_accounts');
 const workLock=writer.indexOf('from public.community_works\n    where work_id=p_work_id');
 const advisory=writer.indexOf('pg_try_advisory_xact_lock');
 const mutate=writer.indexOf('insert into public.gallery_work_settings(');
 assert.ok(root>=0&&workLock>root&&advisory>workLock&&mutate>advisory);
 assert.match(writer,/for share/);
 assert.match(writer,/for update nowait/);
 assert.match(writer,/p_expected_version bigint/);
 assert.match(writer,/p_expected_current_revision_id uuid/);
 assert.match(writer,/R16_STALE_WORK_TERMINAL/);
 assert.match(writer,/R16_DEPENDENT_GALLERY_METADATA_NOT_ENROLLED/);
 assert.match(writer,/R16_IDEMPOTENCY_CONFLICT/);
 assert.match(writer,/insert into public\.idempotency_keys/);
 assert.match(writer,/update public\.search_documents/);
 assert.match(writer,/insert into public\.audit_events/);
 assert.doesNotMatch(writer,/insert into public\.gallery_revision_presets|insert into public\.media_assets|delete from/);
 assert.match(acl,/revoke all on function public\.community_set_gallery_comments_enabled_atomic_r16/);
 assert.match(acl,/grant execute on function public\.community_set_gallery_comments_enabled_atomic_r16.*to service_role/s);
});
test('R16 Edge uses fresh Session retries with same pinned revision/version and R15 unaffected',()=>{
 assert.match(edge,/setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_r16'/);
 assert.match(edge,/params\.p_expected_current_revision_id = payload.expectedCurrentRevisionId/);
 assert.match(edge,/params\.p_expected_version = payload.expectedVersion/);
 assert.match(edge,/command === 'setGalleryCommentsAtomicR16'\) \? 3 : 1/);
 assert.match(edge,/R16_STALE_WORK_TERMINAL/);
 assert.match(edge,/publishGallery: 'community_publish_gallery_pinned_r15'/);
 assert.match(edge,/\['40P01','55P03','40001'\]/);
});
test('R16 exact local source runner checks registry/ACL and true two-backend lock, CAS and replay',()=>{
 assert.match(work,/assert len\(fs\)==135/);
 assert.match(work,/MIGRATION_LEDGER_NOT_135/);
 assert.match(work,/R16_REGISTRY_COUNT_MISMATCH/);
 assert.match(work,/R16_REGISTRY_ACL_EXPOSED/);
 assert.match(work,/comm-r16-gallery-metadata-two-session\.py/);
 const t=read('tests/comm-r16-gallery-metadata-two-session.py');
 assert.match(t,/R16_HELD_/);
 assert.match(t,/R16_STALE_VERSION_ACCEPTED/);
 assert.match(t,/R16_IDEMPOTENCY_CHANGED_INTENT_ACCEPTED/);
 assert.match(t,/03COMM_R16_GALLERY_METADATA_TWO_BACKEND_SOURCE_PASS/);
});
