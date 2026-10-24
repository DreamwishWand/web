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
