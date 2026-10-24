import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyGalleryPhysicalCleanupGate as classify} from '../supabase/functions/_shared/gallery-physical-cleanup-gate.mjs';

const disabled={
  physicalDeleteAuthorized:false,
  reason:'GALLERY_PHYSICAL_STORAGE_DELETE_E2E_NOT_ACCEPTED',
  conditional72hEnabled:false,
  signedActorPhysicalAbsenceProven:false,
  externalStorageRaceCertified:false,
  cloudDependencyGraphComplete:false
};
test('live Staging SQL gate shape stays disabled; 72h lifecycle flag remains independent',()=>{
  assert.equal(classify(disabled),'disabled');
  assert.equal(classify({...disabled,conditional72hEnabled:true}),'disabled');
});

test('one prematurely enabled bit never authorizes physical Storage.remove',()=>{
  assert.equal(classify({...disabled,physicalDeleteAuthorized:true}),'invalid');
  for(const key of ['signedActorPhysicalAbsenceProven','externalStorageRaceCertified','cloudDependencyGraphComplete']){
    assert.equal(classify({...disabled,physicalDeleteAuthorized:true,...Object.fromEntries(
      ['signedActorPhysicalAbsenceProven','externalStorageRaceCertified','cloudDependencyGraphComplete']
        .filter(x=>x!==key).map(x=>[x,true]))}),'invalid',key);
  }
  assert.equal(classify({...disabled,physicalDeleteAuthorized:true,
    signedActorPhysicalAbsenceProven:true,externalStorageRaceCertified:true,
    cloudDependencyGraphComplete:true}),'authorized');
});

test('missing/falsey/coerced shape fails invalid, never positive',()=>{
  for(const value of [null,{},[],false,'authorized',
    {...disabled,physicalDeleteAuthorized:'true'},
    {...disabled,externalStorageRaceCertified:1},
    {...disabled,conditional72hEnabled:undefined},
    {...disabled,physicalDeleteAuthorized:null},
    {...disabled,signedActorPhysicalAbsenceProven:null}]){
    assert.equal(classify(value),'invalid');
  }
});

test('existing retention worker checks typed gate before claim, lease or physical remove',()=>{
  const worker=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
  assert.match(worker,/import \{ classifyGalleryPhysicalCleanupGate \} from '\.\.\/_shared\/gallery-physical-cleanup-gate\.mjs';/);
  const call=worker.indexOf('classifyGalleryPhysicalCleanupGate(cleanupGate)');
  const unknown=worker.indexOf("if(galleryPhysicalCleanupGateState==='invalid')",call);
  const deny=worker.indexOf("else if(galleryPhysicalCleanupGateState!=='authorized')",unknown);
  const claim=worker.indexOf("'community_claim_gallery_media_orphans_v1'",deny);
  const physicalRemove=worker.indexOf('.remove([key])',claim);
  assert.ok(call>0&&unknown>call&&deny>unknown&&claim>deny&&physicalRemove>claim);
  assert.ok(worker.includes("galleryOrphans.workerFailure='GALLERY_PHYSICAL_CLEANUP_GATE_INVALID'"));
  assert.ok(worker.includes("galleryOrphans.cleanupBlocked='GALLERY_PHYSICAL_STORAGE_DELETE_E2E_NOT_ACCEPTED'"));
});
