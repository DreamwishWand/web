import test from 'node:test';
import assert from 'node:assert/strict';
import {parseR15ServerGalleryGraph} from '../src/lib/wep/r15-server-gallery-graph-readonly.ts';
const I={
  gallery:'11111111-1111-4111-8111-111111111111',
  artifact:'22222222-2222-4222-8222-222222222222',
  presetWork:'33333333-3333-4333-8333-333333333333',
  creator:'44444444-4444-4444-8444-444444444444',
  presetRev:'55555555-5555-4555-8555-555555555555',
  galleryRev:'66666666-6666-4666-8666-666666666666',
  presetWorkRev:'77777777-7777-4777-8777-777777777777',
  account:'88888888-8888-4888-8888-888888888888',
  auth:'99999999-9999-4999-8999-999999999999',
  media:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
};
const expected={galleryWorkId:I.gallery,presetArtifactId:I.artifact,
 presetWorkId:I.presetWork,creatorProfileId:I.creator,currentPresetRevisionId:I.presetRev,
 currentGalleryRevisionId:I.galleryRev,requestedPresetRevisionIds:[I.presetRev],
 accountId:I.account,authSubject:I.auth};
function server(){
 const works=[
  {work_id:I.presetWork,work_type:'preset',owner_account_id:I.account,
   creator_profile_id:I.creator,row_version:7,current_published_revision_id:I.presetWorkRev},
  {work_id:I.gallery,work_type:'gallery',owner_account_id:I.account,
   creator_profile_id:I.creator,row_version:11,current_published_revision_id:I.galleryRev}
 ];
 const graph={
  registry:'gallery-scene-scoped@r14',artifactIds:[I.artifact],
  presetWorkIds:[I.presetWork],galleryWorkIds:[I.gallery],
  artifacts:[{preset_artifact_id:I.artifact,preset_type:'scene',
    community_work_id:I.presetWork,owner_account_id:I.account,creator_profile_id:I.creator}],
  works,
  workRevisions:[{revision_id:I.presetWorkRev,work_id:I.presetWork},
    {revision_id:I.galleryRev,work_id:I.gallery}],
  presetRevisions:[{preset_revision_id:I.presetRev,preset_artifact_id:I.artifact}],
  presetPublications:[{work_revision_id:I.presetWorkRev,preset_revision_id:I.presetRev}],
  historicalPresetLinks:[{gallery_revision_id:I.galleryRev,preset_revision_id:I.presetRev}],
  mediaReferences:[{work_revision_id:I.galleryRev,media_id:I.media,ordinal:0,role:'gallery'}],
  coverReferences:[{revision_id:I.galleryRev,cover_media_id:I.media}]
 };
 return {
  schemaVersion:1,registryVersion:'gallery-scene-scoped@r15',
  expectedGraphSha256:'a'.repeat(64),expectedGraph:{
    registryVersion:'gallery-scene-scoped@r15',accountId:I.account,authSubject:I.auth,
    ownerActive:true,identityActive:true,galleryWorkId:I.gallery,
    requestedPresetRevisionIds:[I.presetRev],graph},
  expectedWorkStates:structuredClone(works),
  expectedArtifactIds:[I.artifact],expectedPresetWorkIds:[I.presetWork],
  expectedGalleryWorkIds:[I.gallery],
  historicalPresetLinks:structuredClone(graph.historicalPresetLinks),
  mediaReferences:structuredClone(graph.mediaReferences),
  coverReferences:structuredClone(graph.coverReferences),
  authoritative:true,graphComplete:false
 };
}
const parse=(s,e=expected)=>parseR15ServerGalleryGraph(s,e);
test('Source124 server scoped SHA preserved exactly; only owner summary returned, writer stays OFF',()=>{
 const raw=server(), before=JSON.stringify(raw);
 const observation=parse(raw);
 assert.equal(observation.expectedGraphSha256,'a'.repeat(64));
 assert.equal(observation.registryVersion,'gallery-scene-scoped@r15');
 assert.equal(observation.observedGalleryRowVersion,11);
 assert.equal(observation.observedPresetRowVersion,7);
 assert.equal(observation.observedGalleryCurrentRevisionId,I.galleryRev);
 assert.equal(observation.observedPresetCurrentRevisionId,I.presetWorkRev);
 assert.equal(observation.historicalPresetLinkCount,1);
 assert.equal(observation.mediaReferenceCount,1);
 assert.equal(observation.coverReferenceCount,1);
 assert.equal(observation.authoritative,true);
 assert.equal(observation.graphComplete,false);
 assert.equal(observation.globalGraphAuthorized,false);
 assert.equal(observation.saveRevisionAuthorized,false);
 assert.equal(observation.productApplyAuthorized,false);
 assert.ok(observation.blockedReasons.includes('R15_GALLERY_SCOPED_GRAPH_NOT_GLOBAL'));
 assert.equal('expectedGraph' in observation,false);
 assert.equal('observedAccountId' in observation,false);
 assert.equal('observedAuthSubject' in observation,false);
 assert.equal('storageKey' in observation,false);
 assert.equal(JSON.stringify(raw),before);
});
test('Unknown registry/schema and optimistic global authority fail closed',()=>{
 for(const patch of [{schemaVersion:2},{registryVersion:'gallery-scene-scoped@r16'},
  {authoritative:false},{graphComplete:true},{expectedGraphSha256:'bad'},
  {expectedGraphSha256:'A'.repeat(64)},{expectedGraph:null}]){
   assert.throws(()=>parse({...server(),...patch}),/WEP_R15_/);
 }
});
test('Mismatch owner, Creator, account, subject and requested immutable revision fail closed',()=>{
 for(const mutate of [
  x=>x.expectedGraph.accountId=I.gallery,
  x=>x.expectedGraph.authSubject=I.gallery,
  x=>x.expectedGraph.graph.works[0].owner_account_id=I.gallery,
  x=>x.expectedGraph.graph.works[1].creator_profile_id=I.gallery,
  x=>x.expectedGraph.graph.artifacts[0].creator_profile_id=I.gallery,
  x=>x.expectedGraph.requestedPresetRevisionIds=[],
  x=>x.expectedGraph.galleryWorkId=I.presetWork
 ]){
  const s=server();mutate(s);
  assert.throws(()=>parse(s),/WEP_R15_/);
 }
});
test('Unknown facet/multi-artifact/missing WorkState/foreign Work block',()=>{
 for(const change of [
   s=>s.expectedGraph.graph.artifacts[0].preset_type='biome',
   s=>s.expectedGraph.graph.artifactIds.push(I.gallery),
   s=>s.expectedWorkStates.pop(),
   s=>s.expectedGraph.graph.works[0].row_version=99,
   s=>s.expectedWorkStates[0].row_version=-1,
   s=>s.expectedGalleryWorkIds=[I.presetWork]
 ]){
  let s=server();change(s);assert.throws(()=>parse(s),/WEP_R15_/);
 }
});
test('Current/historical revision and Media/Cover mirror must agree and missing reference fails closed',()=>{
 for(const change of [
   s=>s.expectedGraph.graph.works[1].current_published_revision_id=I.presetRev,
   s=>s.expectedGraph.graph.presetPublications=[],
   s=>s.expectedGraph.graph.historicalPresetLinks=[],
   s=>s.historicalPresetLinks[0].gallery_revision_id=I.presetWork,
   s=>s.mediaReferences[0].media_id=I.presetWork,
   s=>s.coverReferences[0].cover_media_id=I.presetRev,
   s=>delete s.coverReferences,
   s=>s.expectedGraph.graph.workRevisions=[],
   s=>s.expectedGraph.graph.presetRevisions=[],
   s=>s.mediaReferences[0].work_revision_id=I.presetWorkRev,
   s=>s.coverReferences[0].cover_media_id=I.presetWorkRev,
   s=>{s.coverReferences=[];s.expectedGraph.graph.coverReferences=[]},
   s=>{s.mediaReferences=[];s.expectedGraph.graph.mediaReferences=[]}
 ]){
  const s=server();change(s);assert.throws(()=>parse(s),/WEP_R15_/);
 }
});
test('Wrong session account/subject, stale public current context refused independently',()=>{
 assert.throws(()=>parse(server(),{...expected,accountId:I.gallery}),/WEP_R15_OWNER_SESSION_MISMATCH/);
 assert.throws(()=>parse(server(),{...expected,authSubject:I.gallery}),/WEP_R15_OWNER_SESSION_MISMATCH/);
 assert.throws(()=>parse(server(),{...expected,currentGalleryRevisionId:I.presetRev}),/WEP_R15_CURRENT_GALLERY_REVISION_STALE/);
 assert.throws(()=>parse(server(),{...expected,currentPresetRevisionId:I.gallery}),/WEP_R15_/);
 const summary=parse(server(),{...expected,accountId:undefined,authSubject:undefined});
 assert.ok(summary.blockedReasons.includes('R15_CLIENT_SESSION_CROSS_ATTESTATION_UNAVAILABLE'));
});
export {server,expected,I};
