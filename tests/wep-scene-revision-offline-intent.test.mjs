import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  parseScenePublicCurrent, parseSceneOwnerReadiness,
  SCENE_REVISION_WRITE_BLOCKERS
} from '../src/lib/wep/scene-revision-gallery-consumer.ts';
import { prepareSceneRevisionOfflineIntent } from '../src/lib/wep/scene-revision-offline-intent.ts';
import { buildPublishEnvelope } from '../src/lib/wep/scene-preset-runtime.ts';

const U = {
  work:'11111111-1111-4111-8111-111111111111',
  wr:'22222222-2222-4222-8222-222222222222',
  pa:'33333333-3333-4333-8333-333333333333',
  rev:'44444444-4444-4444-8444-444444444444',
  creator:'55555555-5555-4555-8555-555555555555',
  gallery:'66666666-6666-4666-8666-666666666666',
  gr:'77777777-7777-4777-8777-777777777777',
  media:'88888888-8888-4888-8888-888888888888'
};
const rawCurrent={
  workId:U.work, workRevisionId:U.wr, presetArtifactId:U.pa,
  presetRevisionId:U.rev, presetRevisionNumber:2, presetType:'scene',
  creatorProfileId:U.creator, title:'Current Scene', description:null,
  galleryWorkId:U.gallery, galleryWorkRevisionId:U.gr,
  mediaIds:[U.media],coverMediaId:U.media,
  checksumSha256:'1'.repeat(64),byteSize:1290,schemaVersion:1,
  publishedAt:'2026-10-24T00:00:00Z'
};
const rawOwner={
  contract:'ddv.scene-revision-readiness@1',presetArtifactId:U.pa,
  presetWorkId:U.work,presetType:'scene',ownerEligible:true,workRowVersion:8,
  lifecycleState:'published',visibility:'public',currentPresetRevisionId:U.rev,
  revisionCount:2,latestRevisionNumber:2,currentArtifactAvailable:true,
  hasAssociatedGallery:true,knownHistoricalGalleryCount:1,knownGalleryReferenceCount:1,
  crossOwnerOrUnresolvedGalleryCount:0,dependencyFingerprintSha256:'a'.repeat(64),
  dependencyFingerprintIsAtomicFence:false,graphComplete:false,
  saveRevisionAuthorized:false,pairedGalleryPublishAuthorized:false,
  unpublishAuthorized:false,deleteAuthorized:false,restoreAuthorized:false,
  blockedReasons:[...SCENE_REVISION_WRITE_BLOCKERS]
};
const current=parseScenePublicCurrent(rawCurrent,U.work);
const readiness=parseSceneOwnerReadiness(rawOwner,U.pa);
const artifact={
  schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',title:'New Design',
  source:{gameVersion:'1.25.0',platform:'switch',areaKey:'Village01'},
  bounds:{w:2,h:2},originPolicy:'capture-region-top-left',
  objects:[{artifactObjectId:'o0',itemId:1001,localX:0,localY:0,orientation:0,
    footprint:[{x:0,y:0}],portableState:null,dependencyIds:[]}],
  networks:{roads:null,fences:null},
  requirements:{itemQuantities:{1001:1},roadTopology:false,fenceTopology:false},
  normalization:{sourceGridIdsRemoved:true,sourceGridObjectIdsRemoved:true,dependencyClosureIncluded:true}
};
const source={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624,sourceExternallyVerified:true};
const capture={selectionIds:['o0'],includeRoads:false,includeFences:false,hasRequiredSubGridDescendants:true};
const args={current,readiness,source,artifact,capture};
test('v1.25.0 Scene artifact proof hashes exact WEP JSON bytes without upload or mutation',async()=>{
  const before=JSON.stringify(artifact);
  const proof=await prepareSceneRevisionOfflineIntent(args);
  assert.equal(proof.contract,'ddv.wep.scene-revision-offline-intent@1');
  assert.equal(proof.source.buildId,'52BD625D9B4E0053');
  assert.equal(proof.identity.expectedPresetWorkRowVersion,8);
  assert.equal(proof.identity.currentPresetRevisionId,U.rev);
  assert.equal(proof.identity.currentGalleryWorkRevisionId,U.gr);
  const envelope=buildPublishEnvelope(artifact).envelope;
  assert.ok(envelope);
  assert.equal(proof.artifact.byteSize,Buffer.byteLength(envelope.json));
  assert.equal(proof.artifact.checksumSha256,createHash('sha256').update(envelope.json).digest('hex'));
  assert.equal(JSON.stringify(artifact),before);
  assert.equal('json' in proof.artifact,false);
  assert.equal('storageKey' in proof.artifact,false);
  assert.deepEqual(proof.proposedMediaIds,[]);
  assert.equal(proof.proposedCoverMediaId,null);
  for (const key of ['mediaManifestAuthorized','artifactBlobRegistered',
    'atomicRevisionWriterAuthorized','pairedGalleryPublishAuthorized',
    'saveRevisionAuthorized','productApplyAuthorized']) assert.equal(proof[key],false,key);
  assert.equal(proof.identity.dependencyFingerprintIsAtomicFence,false);
});
test('platform/build/schema provenance refuses 626 and Steam or nonverified v1.25.0',async()=>{
  const badSources=[
    {...source,gameVersion:'1.25.3',profileSchema:626,buildId:'9A239D3DB569756D'},
    {...source,platform:'steam'},{...source,buildId:'0000000000000000'},
    {...source,profileSchema:626},{...source,sourceExternallyVerified:false},
    {...source,gameVersion:'1.25.3'}
  ];
  for(const invalidSource of badSources){
    await assert.rejects(
      prepareSceneRevisionOfflineIntent({...args,source:invalidSource}),
      /WEP_SCENE_REVISION_SOURCE_NOT_APPROVED_V125/
    );
  }
});
test('stale work/preset identity or optimistic readiness never emits revision intent',async()=>{
  for(const changes of [
    {current:{...current,presetRevisionId:U.wr}},
    {current:{...current,workId:U.gallery}},
    {readiness:{...readiness,graphComplete:true}},
    {readiness:{...readiness,saveRevisionAuthorized:true}},
    {readiness:{...readiness,ownerEligible:false}},
    {readiness:{...readiness,currentArtifactAvailable:false}}
  ]){
    await assert.rejects(
      prepareSceneRevisionOfflineIntent({...args,...changes}),
      /WEP_SCENE_REVISION_OWNER_IDENTITY_STALE/
    );
  }
});
test('selection, required SubGrid descendants, network scope, and portable source fail closed',async()=>{
  const invalid=[
    {...args,capture:{...capture,selectionIds:[]}},
    {...args,capture:{...capture,selectionIds:['o0','o0']}},
    {...args,capture:{...capture,hasRequiredSubGridDescendants:false}},
    {...args,capture:{...capture,includeRoads:true}},
    {...args,artifact:{...artifact,source:{...artifact.source,gameVersion:'1.25.3'}}},
    {...args,artifact:{...artifact,normalization:{...artifact.normalization,dependencyClosureIncluded:false}}},
    {...args,artifact:{...artifact,objects:[]}}
  ];
  for(const proposal of invalid){
    await assert.rejects(prepareSceneRevisionOfflineIntent(proposal),/WEP_SCENE_REVISION_(CAPTURE_SCOPE_INVALID|ARTIFACT_NETWORK_SCOPE_MISMATCH|ARTIFACT_SOURCE_OR_CLOSURE_UNVERIFIED|ARTIFACT_VALIDATION_BLOCKED)/);
  }
});
test('No server, network transport, Storage signed upload or writer can run from offline intent',async()=>{
  const result=await prepareSceneRevisionOfflineIntent(args);
  assert.ok(result.blockedReasons.includes('SCENE_BACKEND_ALL_WRITER_R7_NOT_ACCEPTED'));
  assert.ok(result.blockedReasons.includes('SCENE_SIGNED_STAGING_E2E_NOT_ACCEPTED'));
  assert.ok(result.blockedReasons.includes('SCENE_OWNER_READY_MEDIA_MANIFEST_NOT_VERIFIED'));
});
