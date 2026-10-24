import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSceneRevisionGalleryConsumer, parseScenePublicCurrent, parseSceneOwnerReadiness,
  SCENE_PUBLIC_CURRENT_RPC, SCENE_REVISION_WRITE_BLOCKERS
} from '../src/lib/wep/scene-revision-gallery-consumer.ts';

const ID = {
  work: '11111111-1111-4111-8111-111111111111',
  revision: '22222222-2222-4222-8222-222222222222',
  preset: '33333333-3333-4333-8333-333333333333',
  presetRevision: '44444444-4444-4444-8444-444444444444',
  creator: '55555555-5555-4555-8555-555555555555',
  gallery: '66666666-6666-4666-8666-666666666666',
  galleryRevision: '77777777-7777-4777-8777-777777777777',
  cover: '88888888-8888-4888-8888-888888888888',
  image: '99999999-9999-4999-8999-999999999999'
};
const current = {
  workId: ID.work, workRevisionId: ID.revision, presetArtifactId: ID.preset,
  presetRevisionId: ID.presetRevision, presetRevisionNumber: 4, presetType: 'scene',
  creatorProfileId: ID.creator, title: 'Test Scene', description: null,
  galleryWorkId: ID.gallery, galleryWorkRevisionId: ID.galleryRevision,
  mediaIds: [ID.cover,ID.image], coverMediaId: ID.cover,
  checksumSha256: 'f'.repeat(64), byteSize: 7123, schemaVersion: 1,
  publishedAt: '2026-10-01T00:00:00Z', storageKey: 'private-should-never-leak'
};
const owner = {
  contract:'ddv.scene-revision-readiness@1',presetArtifactId:ID.preset,presetWorkId:ID.work,
  presetType:'scene',ownerEligible:true,workRowVersion:6,lifecycleState:'published',
  visibility:'public',currentPresetRevisionId:ID.presetRevision,revisionCount:4,
  latestRevisionNumber:4,currentArtifactAvailable:true,hasAssociatedGallery:true,
  knownHistoricalGalleryCount:2,knownGalleryReferenceCount:3,
  crossOwnerOrUnresolvedGalleryCount:0,
  dependencyFingerprintSha256:'e'.repeat(64),
  dependencyFingerprintIsAtomicFence:false,graphComplete:false,
  saveRevisionAuthorized:false,pairedGalleryPublishAuthorized:false,
  unpublishAuthorized:false,deleteAuthorized:false,restoreAuthorized:false,
  blockedReasons:[...SCENE_REVISION_WRITE_BLOCKERS]
};
function harness(override={}) {
  const calls=[];
  const consumer=createSceneRevisionGalleryConsumer({
    async publicQuery(rpc,payload){ calls.push(['read',rpc,payload]);return override.public ?? current; },
    async ownerReadiness(id){calls.push(['owner',id]);return override.owner ?? owner;},
    async publicMedia(id){calls.push(['cover',id]);return override.media ?? {
      signedUrl:'https://storage.example.invalid/signed-current-cover', mimeType:'image/png'
    };}
  });
  return {consumer,calls};
}
test('Current public Scene projects only latest immutable identity; no private storage key or historical URLs',async()=>{
  const {consumer,calls}=harness();
  const result=await consumer.readCurrent(ID.work);
  assert.deepEqual(calls,[['read',SCENE_PUBLIC_CURRENT_RPC,{p_work_id:ID.work}]]);
  assert.equal(result.currentOnly,true);
  assert.equal(result.saveRevisionAuthorized,false);
  assert.equal(result.historicalMediaAvailable,false);
  assert.equal('storageKey' in result,false);
  assert.equal(result.coverMediaId,ID.cover);
  const cover=await consumer.resolveCurrentCover(result);
  assert.deepEqual(cover,{mediaId:ID.cover,signedUrl:'https://storage.example.invalid/signed-current-cover'});
  assert.deepEqual(calls[1],['cover',ID.cover]);
});
test('Scene with no Gallery relation is valid metadata-only but never signs cover',async()=>{
  const {consumer}=harness({public:{...current,galleryWorkId:null,galleryWorkRevisionId:null,mediaIds:[],coverMediaId:null}});
  const read=await consumer.readCurrent(ID.work);
  await assert.rejects(consumer.resolveCurrentCover(read),/WEP_SCENE_CURRENT_COVER_UNAVAILABLE/);
});
test('Owner readiness preserves authenticated owner scope and blocks all writers',async()=>{
  const {consumer,calls}=harness();
  const state=await consumer.readOwner(ID.preset);
  assert.deepEqual(calls,[['owner',ID.preset]]);
  assert.equal(state.graphComplete,false);
  assert.equal(state.dependencyFingerprintIsAtomicFence,false);
  await assert.rejects(consumer.saveRevision(),/WEP_SCENE_REVISION_ATOMIC_WRITER_NOT_AUTHORIZED/);
  assert.equal(state.knownGalleryReferenceCount,3);
});
test('Revision preview uses required descendants and exact current/preset identity, but Save always disabled',async()=>{
  const {consumer}=harness();
  const currentRead=await consumer.readCurrent(ID.work);
  const ready=await consumer.readOwner(ID.preset);
  const preview=consumer.previewExistingRevision(currentRead,ready,{
    validation:{ok:true,presetType:'scene'},selectionIds:['o1','o2'],
    hasRequiredSubGridDescendants:true,includeRoads:true,includeFences:false
  });
  assert.equal(preview.mode,'EXISTING_SCENE_REVISION');
  assert.equal(preview.proposedRevisionNumber,5);
  assert.equal(preview.capture.roads,true);
  assert.equal(preview.capture.fences,false);
  assert.equal(preview.coverSelection,'NOT_AUTHORIZED');
  assert.equal(preview.saveRevisionAuthorized,false);
  assert.throws(()=>consumer.previewExistingRevision(currentRead,ready,{
    validation:{ok:true,presetType:'scene'},selectionIds:['o1'],
    hasRequiredSubGridDescendants:false
  }),/WEP_SCENE_REVISION_CAPTURE_NOT_VALIDATED/);
  assert.throws(()=>consumer.previewExistingRevision({...currentRead,presetRevisionId:ID.revision},ready,{
    validation:{ok:true,presetType:'scene'},selectionIds:['o1'],
    hasRequiredSubGridDescendants:true
  }),/WEP_SCENE_REVISION_STALE_OR_MISMATCHED_IDENTITY/);
});
test('Public identity/cover/media negative matrix refuses tampering and stale cover',()=>{
  const changes=[
    {workId:ID.gallery},{presetType:'biome'}, {presetRevisionId:'unverified'},
    {checksumSha256:'bad'}, {byteSize:0}, {mediaIds:[ID.cover,ID.cover]},
    {mediaIds:[ID.image]}, {coverMediaId:ID.work},
    {galleryWorkId:null}, {galleryWorkRevisionId:null},
    {coverMediaId:null}, {mediaIds:[...current.mediaIds,'bad']},
    {schemaVersion:0}
  ];
  for(const change of changes)assert.throws(()=>parseScenePublicCurrent({...current,...change},ID.work),/WEP_SCENE_PUBLIC_CURRENT_/);
  assert.throws(()=>parseScenePublicCurrent(current,'bad'),/WEP_SCENE_WORK_ID_INVALID/);
});
test('Owner readiness negative matrix refuses optimistic flags, missing blockers and foreign identity',()=>{
  const changes=[
    {presetArtifactId:ID.gallery},{presetType:'biome'},{ownerEligible:false},
    {graphComplete:true},{saveRevisionAuthorized:true},{pairedGalleryPublishAuthorized:true},
    {dependencyFingerprintIsAtomicFence:true},{deleteAuthorized:true},{unpublishAuthorized:true},
    {restoreAuthorized:true},{blockedReasons:[]},{revisionCount:-1},
    {currentPresetRevisionId:'bad'}
  ];
  for(const change of changes)assert.throws(()=>parseSceneOwnerReadiness({...owner,...change},ID.preset),/WEP_SCENE_OWNER_READINESS_/);
});
test('Only HTTPS image signed URL is accepted; expired/invalid media remains retryable error',async()=>{
  for(const media of [
    {signedUrl:'http://untrusted.invalid',mimeType:'image/png'},
    {signedUrl:'https://example.invalid/',mimeType:'text/html'},
    {signedUrl:'',mimeType:'image/png'}
  ]) {
    const {consumer}=harness({media});
    await assert.rejects(consumer.resolveCurrentCover(await consumer.readCurrent(ID.work)),
      /WEP_SCENE_CURRENT_COVER_INVALID_OR_EXPIRED/);
  }
});
test('Source version gates: no v1.25.3 DDV writer inferred from Scene revision UI',()=>{
  const preview=createSceneRevisionGalleryConsumer({
    publicQuery:async()=>current,ownerReadiness:async()=>owner,publicMedia:async()=>({signedUrl:'',mimeType:null})
  }).previewNewScene({ok:true,presetType:'scene'},{selectionIds:['x'],includeRoads:true});
  assert.equal(preview.mode,'NEW_SCENE');
  assert.equal(preview.saveRevisionAuthorized,false);
  assert.equal(preview.pairedGalleryPublishAuthorized,false);
});
