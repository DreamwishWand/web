// 04 QR / PRESET-SCENE acceptance gate, negative-only until R6 writer is reviewed.
// Source/contract assertions are not signed Staging or two-session DB acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bootstrap=read('supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql');
const edge=read('supabase/functions/wep-preset-artifact/index.ts');
const bridge=read('src/lib/wep/preset-community-bridge.ts');
const command=read('supabase/functions/community-command/index.ts');
const gallery=read('supabase/functions/community-public-query/index.ts');
const d=requireText=>(bootstrap.match(new RegExp(requireText,'i'))||[])[0];

test('SCN-01 Create is artifact-scoped only; no Safe Save Existing Revision contract is misrepresented',()=>{
 assert.match(edge,/function validateArtifact\(/);
 assert.match(edge,/rejectSaveLocalIdentity\(artifact\)/);
 assert.match(edge,/PRESET_TYPE_VALIDATOR_NOT_AVAILABLE/);
 assert.match(edge,/ALLOWED_TYPES/);
 assert.match(bridge,/async function publishScene\(/);
 assert.match(bridge,/community\.preset\('prepare'/);
 assert.match(bridge,/community\.preset\('publish'/);
 assert.doesNotMatch(bridge,/\b(?:async\s+function|function)\s+(?:saveSceneRevision|publishSceneRevision|applySceneToWorld)\s*\(/);
 assert.doesNotMatch(edge,/['"](?:saveSceneRevision|publishSceneRevision|applyWorldState)['"]/);
});
test('SCN-02 Existing Scene revision request is read-only; all positive mutating actions remain disabled',()=>{
 const sql=bootstrap.split(/create or replace function public\.community_scene_revision_readiness_v1\s*\(/i)[1];
 assert.ok(sql);
 const fn=sql.split('$scene_readiness$')[1];
 assert.ok(fn);
 assert.match(sql,/stable\s+security definer/i);
 assert.match(sql,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(sql,/owner_account_id=v_owner/);
 for(const [key,status] of [
  ['graphComplete','false'],['saveRevisionAuthorized','false'],
  ['pairedGalleryPublishAuthorized','false'],['unpublishAuthorized','false'],
  ['deleteAuthorized','false'],['restoreAuthorized','false'],
  ['dependencyFingerprintIsAtomicFence','false']
 ]) assert.match(fn,new RegExp("'"+key+"',"+status));
 assert.doesNotMatch(fn,/\b(insert into|delete from public\.|update public\.)/i);
 assert.match(edge,/if \(action === 'revisionReadiness'\)/);
 assert.match(edge,/SCENE_REVISION_READINESS_FORBIDDEN_OR_UNAVAILABLE/);
});
test('SCN-03 Artifact portable identity, SubGrid child and road/fence topology validation exist before publication',()=>{
 for(const key of [
  'editorid','gridid','gridobjectid','subgridid','sourcegridobjectid'
 ])assert.match(edge,new RegExp("'"+key+"'"));
 assert.match(edge,/Scene artifact contains save-local identity/);
 assert.match(edge,/artifactObjectId/);
 assert.match(edge,/subgrid\.serialized-local-child@1/);
 assert.match(edge,/Scene footprint is invalid/);
 assert.match(edge,/Scene Fence edge is invalid/);
 assert.match(edge,/Scene Road cell is invalid/);
 assert.match(edge,/MAX_BYTES = 25 \* 1024 \* 1024/);
});
test('SCN-04 Public Scene current-only projection cannot disclose raw Storage keys or historical body',()=>{
 const section=bootstrap.split(/create or replace function public\.community_get_scene_preset_public_v1\s*\(/i)[1];
 assert.ok(section);
 const fn=section.split('$scene_read$')[1];
 assert.ok(fn);
 assert.match(fn,/current_published_revision_id/i);
 assert.match(fn,/preset_revisions/i);
 assert.match(fn,/lifecycle_state='published'|lifecycle_state\s*<>\s*'published'/i);
 assert.doesNotMatch(fn,/'storageKey'|'signedUrl'|'rawUrl'|'blobId'/i);
 assert.match(gallery,/'community_get_scene_preset_public_v1'/);
 assert.match(gallery,/no-store/);
 assert.match(bootstrap,/revoke all on function public\.community_get_scene_preset_public_v1\(uuid\)[\s\S]*?from public,anon,authenticated/i);
});
test('SCN-05 Owner current+historical revision preflight distinguishes private account scope and gallery dependencies',()=>{
 const section=bootstrap.split(/create or replace function public\.community_scene_revision_readiness_v1\s*\(/i)[1];
 assert.ok(section);
 for(const term of ['preset_revisions','community_work_revisions','associated_gallery_work_id',
  'gallery_revision_presets','historical','dependencyFingerprintIsAtomicFence'
 ])assert.match(section,new RegExp(term,'i'));
 assert.match(section,/owner_account_id=v_owner/);
 assert.match(bootstrap,/revoke all on function public\.community_scene_revision_readiness_v1\(uuid,uuid\)[\s\S]*?from public,anon,authenticated/i);
 assert.match(bootstrap,/grant execute on function public\.community_scene_revision_readiness_v1\(uuid,uuid\)[\s\S]*?to service_role/i);
 assert.match(edge,/community_scene_revision_readiness_v1/);
});
test('SCN-06 Gallery paired cover and all-writer graph remain OFF, no accidental PR134 writer promotion',()=>{
 const combined=[bridge,edge,command,bootstrap].join('\n');
 assert.doesNotMatch(combined,/create\s+or\s+replace\s+function\s+public\.community_save_scene_revision_v1/i);
 assert.doesNotMatch(combined,/['"](?:saveSceneRevision|publishSceneRevision|pairedGalleryScenePublish)['"]/);
 assert.match(bootstrap,/PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED/);
 const actions=['community_change_work_visibility','community_unpublish_work','community_delete_work'];
 for(const action of actions) assert.match(bootstrap,new RegExp('create or replace function public\\.'+action+'\\s*\\(','i'));
 assert.match(bootstrap,/GALLERY_REFERENCE_FENCE|gallery_known_reference/i);
});
test('SCN-07 Concurrency/rollback boundary is fail-closed until real R6 two-session and paired bytes proof',()=>{
 const source=read('docs/community/clean-bootstrap-staging-feature-parity-20261024.md');
 assert.match(source,/113/);
 assert.match(bootstrap,/saveRevisionAuthorized',false/);
 assert.match(bootstrap,/pairedGalleryPublishAuthorized',false/);
 // UI state, source checks, and transactional synthetic SQL must never be logged as live writer PASS.
 const forbiddenWriteActions=['applySceneToWorld','saveSceneRevision','pairedGalleryScenePublish'];
 for(const method of forbiddenWriteActions)assert.equal(edge.includes("action === '"+method+"'"),false);
});
