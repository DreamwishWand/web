// 04 QR cross-source acceptance for 03 COMM #134 + 02 WEP #135 QA-only candidate.
// The real Owner/Non-owner Auth and Storage E2E gates are deliberately NOT replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SCENE_PUBLIC_CURRENT_RPC, SCENE_REVISION_WRITE_BLOCKERS,
  parseScenePublicCurrent, parseSceneOwnerReadiness,
  createSceneRevisionGalleryConsumer
} from '../src/lib/wep/scene-revision-gallery-consumer.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql');
const currentFn=sql.split(/create or replace function public\.community_get_scene_preset_public_v1\s*\(/i)[1]?.split('$scene_read$;')[0];
const ownerFn=sql.split(/create or replace function public\.community_scene_revision_readiness_v1\s*\(/i)[1]?.split('$scene_readiness$;')[0];
const privateWriter=sql.split(/create or replace function private\.scene_save_revision_paired_candidate_v1\s*\(/i)[1];
const ids={
 work:'11111111-1111-4111-8111-111111111111',
 workRevision:'22222222-2222-4222-8222-222222222222',
 preset:'33333333-3333-4333-8333-333333333333',
 presetRevision:'44444444-4444-4444-8444-444444444444',
 creator:'55555555-5555-4555-8555-555555555555',
 gallery:'66666666-6666-4666-8666-666666666666',
 galleryRevision:'77777777-7777-4777-8777-777777777777',
 cover:'88888888-8888-4888-8888-888888888888',
 other:'99999999-9999-4999-8999-999999999999'
};
const projection=()=>({
 workId:ids.work,workRevisionId:ids.workRevision,presetArtifactId:ids.preset,
 presetRevisionId:ids.presetRevision,presetRevisionNumber:2,presetType:'scene',
 creatorProfileId:ids.creator,title:'QA Scene',description:null,
 galleryWorkId:ids.gallery,galleryWorkRevisionId:ids.galleryRevision,
 mediaIds:[ids.cover,ids.other],coverMediaId:ids.cover,checksumSha256:'a'.repeat(64),
 byteSize:256,schemaVersion:1,publishedAt:'2026-10-24T00:00:00Z'
});
const readiness=()=>({
 contract:'ddv.scene-revision-readiness@1',presetArtifactId:ids.preset,presetWorkId:ids.work,
 presetType:'scene',ownerEligible:true,workRowVersion:2,lifecycleState:'published',
 visibility:'public',currentPresetRevisionId:ids.presetRevision,revisionCount:2,
 latestRevisionNumber:2,currentArtifactAvailable:true,hasAssociatedGallery:true,
 knownHistoricalGalleryCount:1,knownGalleryReferenceCount:2,crossOwnerOrUnresolvedGalleryCount:0,
 dependencyFingerprintSha256:'b'.repeat(64),dependencyFingerprintIsAtomicFence:false,
 graphComplete:false,saveRevisionAuthorized:false,pairedGalleryPublishAuthorized:false,
 unpublishAuthorized:false,deleteAuthorized:false,restoreAuthorized:false,
 blockedReasons:[...SCENE_REVISION_WRITE_BLOCKERS]
});
function sqlKeys(fn){
 const i=fn.indexOf('return jsonb_build_object(');
 assert.ok(i>=0);
 return new Set([...fn.slice(i).matchAll(/^\s*'([A-Za-z][A-Za-z0-9]*)',/gm)].map(m=>m[1]));
}
test('QR-SCN-INT-01 actual 03 COMM current Scene JSON keys satisfy 02 WEP DTO without Storage URLs',()=>{
 assert.ok(currentFn);
 const keys=sqlKeys(currentFn);
 for(const k of Object.keys(projection()))assert.ok(keys.has(k),k+' absent from SQL');
 assert.match(currentFn,/private\.is_discoverable_work\(p_work_id\)/);
 const parsed=parseScenePublicCurrent({...projection(),storageKey:'private-hidden',signedUrl:'old-bearer-leak'},ids.work);
 assert.equal('storageKey' in parsed,false);assert.equal('signedUrl' in parsed,false);
 assert.equal(parsed.currentOnly,true);assert.equal(parsed.historicalMediaAvailable,false);
 assert.equal(SCENE_PUBLIC_CURRENT_RPC,'community_get_scene_preset_public_v1');
});
test('QR-SCN-INT-02 owner Readiness SQL matches 02 WEP typed gate + required blockers',()=>{
 assert.ok(ownerFn);
 const keys=sqlKeys(ownerFn);
 for(const k of Object.keys(readiness()))assert.ok(keys.has(k),k+' absent from readiness SQL');
 for(const blocker of SCENE_REVISION_WRITE_BLOCKERS)assert.ok(ownerFn.includes("'"+blocker+"'"),blocker);
 assert.match(ownerFn,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(ownerFn,/owner_account_id=v_owner/);
 const parsed=parseSceneOwnerReadiness(readiness(),ids.preset);
 assert.equal(parsed.graphComplete,false);assert.equal(parsed.dependencyFingerprintIsAtomicFence,false);
 assert.equal(parsed.saveRevisionAuthorized,false);
});
test('QR-SCN-INT-03 public cover must be tied to current Gallery revision; stale/mismatched identities denied',()=>{
 for(const edit of [
  v=>{v.galleryWorkRevisionId=null},
  v=>{v.coverMediaId=ids.work},
  v=>{v.galleryWorkId=null},
  v=>{v.mediaIds=[ids.cover,ids.cover]},
  v=>{v.presetRevisionNumber=0},
  v=>{v.checksumSha256='invalid'}
 ]){const v=projection();edit(v);assert.throws(()=>parseScenePublicCurrent(v,ids.work));}
 const current=parseScenePublicCurrent(projection(),ids.work),owner=parseSceneOwnerReadiness(readiness(),ids.preset);
 const requests=[];
 const api=createSceneRevisionGalleryConsumer({
  async publicQuery(rpc,payload){requests.push(['public',rpc,payload]);return projection()},
  async ownerReadiness(id){requests.push(['owner',id]);return readiness()},
  async publicMedia(id){requests.push(['cover',id]);return {signedUrl:'https://cdn.example.invalid/current',mimeType:'image/png'}}
 });
 const preview=api.previewExistingRevision(current,owner,{validation:{ok:true,presetType:'scene'},selectionIds:['one'],hasRequiredSubGridDescendants:true});
 assert.equal(preview.saveRevisionAuthorized,false);
 assert.equal(preview.pairedGalleryPublishAuthorized,false);
 assert.equal(preview.coverSelection,'NOT_AUTHORIZED');
 assert.throws(()=>api.previewExistingRevision({...current,presetRevisionId:ids.other},owner,{validation:{ok:true,presetType:'scene'},selectionIds:['one'],hasRequiredSubGridDescendants:true}),/STALE_OR_MISMATCHED_IDENTITY/);
 assert.equal(requests.length,0);
});
test('QR-SCN-INT-04 forged owner and graph flags fail closed; no accidental optimistic concurrency promise',async()=>{
 for(const edit of [
  v=>{v.ownerEligible=false},
  v=>{v.graphComplete=true},
  v=>{v.saveRevisionAuthorized=true},
  v=>{v.dependencyFingerprintIsAtomicFence=true},
  v=>{v.blockedReasons=[]},
  v=>{v.workRowVersion=-1}
 ]){const v=readiness();edit(v);assert.throws(()=>parseSceneOwnerReadiness(v,ids.preset));}
 const api=createSceneRevisionGalleryConsumer({
  async publicQuery(){throw Error('unexpected public query')},
  async ownerReadiness(){throw Error('unexpected owner query')},
  async publicMedia(){throw Error('unexpected cover query')}
 });
 await assert.rejects(api.saveRevision(),/WEP_SCENE_REVISION_ATOMIC_WRITER_NOT_AUTHORIZED/);
});
test('QR-SCN-INT-05 paired DB transaction candidate has zero executable API grants and fail-closed R7',()=>{
 assert.ok(privateWriter);
 assert.match(sql,/revoke all on function private\.scene_save_revision_paired_candidate_v1\([\s\S]*?\)\s*from public,anon,authenticated,service_role;/i);
 assert.doesNotMatch(sql,/grant\s+execute\s+on\s+function\s+private\.scene_save_revision_paired_candidate_v1/i);
 assert.match(privateWriter,/p_expected_preset_work_version bigint/);
 assert.match(privateWriter,/p_expected_gallery_work_version bigint/);
 assert.match(privateWriter,/p_cover_media_id uuid/);
 assert.match(privateWriter,/p_media_ids uuid\[\]/);
 assert.match(privateWriter,/idempotency/i);
 // This is an owner-only local database candidate, NOT 09 INT R7 proven global writer registry.
 const source=read('src/lib/wep/scene-revision-gallery-consumer.ts');
 assert.match(source,/async function saveRevision\(\): Promise<never>/);
 assert.match(source,/WEP_SCENE_REVISION_ATOMIC_WRITER_NOT_AUTHORIZED/);
});

test('QR-SCN-INT-06 offline proof is not a 03 COMM paired transaction call or ready Media manifest',()=>{
 const intent=read('src/lib/wep/scene-revision-offline-intent.ts');
 assert.match(intent,/prepareSceneRevisionOfflineIntent/);
 assert.match(intent,/sourceExternallyVerified\s*!==\s*true/);
 assert.match(intent,/SWITCH_V125_BID\s*=\s*'52BD625D9B4E0053'/);
 assert.match(intent,/profileSchema\s*!==\s*624/);
 assert.match(intent,/new TextEncoder\(\)\.encode\(proof\.envelope\.json\)/);
 assert.match(intent,/await sha256Hex\(checkedBytes\)/);
 for(const disabled of ['mediaManifestAuthorized','artifactBlobRegistered','atomicRevisionWriterAuthorized',
   'pairedGalleryPublishAuthorized','saveRevisionAuthorized','productApplyAuthorized'])
   assert.match(intent,new RegExp(disabled+': false as const'));
 assert.match(intent,/proposedMediaIds: Object\.freeze\(\[\] as string\[\]\)/);
 assert.match(intent,/proposedCoverMediaId: null/);
 assert.doesNotMatch(intent,/\b(?:fetch\(|supabase\.|\.rpc\(|\.upload\(|\.publish\()/);
 // SQL candidate requires two independently locked rowVersions, committed registered Blob
 // and an actual validated 1..10 READY/CLEAR media manifest. Offline intent supplies
 // diagnostics, NEVER the authoritative transaction or required linked Gallery rowVersion.
 assert.match(privateWriter,/p_expected_preset_work_version bigint/);
 assert.match(privateWriter,/p_expected_gallery_work_version bigint/);
 assert.match(privateWriter,/p_artifact_blob_id uuid/);
 assert.match(privateWriter,/p_media_ids uuid\[\]/);
 assert.match(privateWriter,/p_cover_media_id uuid/);
 assert.match(intent,/expectedPresetWorkRowVersion: readiness\.workRowVersion/);
 assert.match(intent,/expectedGalleryWorkRowVersion: null/);
 assert.match(intent,/expectedHistoricalEdgeSetSha256: null/);
 assert.match(intent,/historicalEdgePinAvailable: false as const/);
 assert.match(intent,/historicalEdgePinIsAtomicFence: false as const/);
});


test('QR-SCN-R11-01 current 03 COMM caller-pinned edge SHA is verified under Artifact/Preset/Gallery locks before writes',()=>{
 const src=read('supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql');
 const fn=src.slice(src.indexOf('create or replace function private.scene_save_revision_paired_candidate_v1('));
 const indexes=[
  fn.indexOf('into v_backlinks_before'),
  fn.indexOf('where preset_artifact_id=p_preset_artifact_id for update;'),
  fn.indexOf('where work_id=v_artifact.community_work_id for update;'),
  fn.indexOf('where work_id=v_assoc for update;'),
  fn.indexOf('into v_backlinks_locked'),
  fn.indexOf("SCENE_REVISION_BACKLINK_SNAPSHOT_CHANGED"),
  fn.indexOf("SCENE_REVISION_CALLER_EDGE_FINGERPRINT_STALE"),
  fn.indexOf('insert into public.preset_revisions')
 ];
 assert.ok(indexes.every(x=>x>=0),indexes.join(','));
 assert.deepEqual([...indexes].sort((a,b)=>a-b),indexes,'graph equality check must precede new revision');
 assert.match(fn,/p_expected_historical_edge_set_sha256 text/);
 assert.match(fn,/'scene-historical-edges-v1\|'/);
 assert.match(fn,/array_to_string\(v_backlinks_locked,'\|'\)/);
 assert.match(fn,/v_preset_work\.row_version is distinct from p_expected_preset_work_version/);
 assert.match(fn,/v_gallery\.row_version is distinct from p_expected_gallery_work_version/);
 // This is still DB-owner only, no release writer.
 assert.match(src,/revoke all on function private\.scene_save_revision_paired_candidate_v1\([\s\S]*?from public,anon,authenticated,service_role/i);
});
test('QR-SCN-R11-02 Owner paired Gallery diagnostic is NOT atomic authority in read-only Source and WEP Intent',()=>{
 const source=read('supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql');
 for(const flag of [
  "'pairedGalleryWorkId',v_owned_gallery.work_id",
  "'pairedGalleryWorkRowVersion',v_owned_gallery.row_version",
  "'pairedGallerySnapshotIsAtomicFence',false",
  "'historicalEdgeSetScope','scene-historical-edges-v1'",
  "'historicalEdgeSetSha256',v_scoped_edge_sha256",
  "'historicalEdgeSetIsAtomicFence',false",
  "'graphComplete',false",
  "'saveRevisionAuthorized',false"
 ])assert.ok(source.includes(flag),flag);
 const intent=read('src/lib/wep/scene-revision-offline-intent.ts');
 assert.match(intent,/expectedGalleryWorkRowVersion: null/);
 assert.match(intent,/expectedHistoricalEdgeSetSha256: null/);
 assert.match(intent,/historicalEdgePinAvailable: false as const/);
 assert.match(intent,/pairedGalleryPublishAuthorized: false as const/);
 assert.match(intent,/productApplyAuthorized: false as const/);
});
test('QR-SCN-R11-03 known reference writers all participate in Gallery lock without global registry claims',()=>{
 const fence=read('supabase/migrations/20261025002400_gallery_known_reference_writer_fence_v1.sql');
 const expected=['gallery_revision_presets','preset_artifacts','preset_revision_publications'];
 for(const relation of expected)assert.match(fence,new RegExp('on public\\.'+relation+'\\b','i'));
 const source=read('supabase/migrations/20261025002350_gallery_known_writer_scene_parent_bootstrap_v1.sql');
 assert.match(source,/'GALLERY_ALL_WRITER_LOCK_PROTOCOL_UNVERIFIED'/);
 const testCode=read('tests/qr-scene-r8-fullschema-graph-counterexample.py');
 for(const code of [
  'R9_CALLER_PIN_HISTORICAL_EDGE_STALE_REJECTED',
  'R11_ACTUAL_PR134_REFERENCE_WRITER_TRIGGER',
  'R11_KNOWN_REFERENCE_TRIGGER_LOCKS_LOCAL_PASS',
  'R8_REAL_03COMM_FULLSOURCE_PAIRED_RPC_CONCURRENT_LOCK',
  'R9_STALE_FAILURE_PARTIAL_MUTATION',
  'R11_BYPASS_GALLERY_WORK_LOCK'
 ])assert.ok(testCode.includes(code),code);
});
