import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyGalleryOriginIntegrity as classify } from '../supabase/functions/_shared/gallery-origin-integrity.mjs';

const healthy=Object.freeze({
  contract:'ddv.gallery-storage-reconciliation@1',
  bucketChecked:true,
  safeToAutoDelete:false,
  physicalRemovalAccepted:false,
  originObjectCount:2,
  originJournaledObjectCount:0,
  originRegisteredObjectCount:2,
  originUntrackedObjectCount:0,
  originMetadataRecordedBytes:135,
  originMetadataSizeUnknownCount:0,
  untrackedOriginBytes:0,
  journaledUnregisteredObjectCount:0,
  registeredWithoutGalleryIntentCount:2, // historical registered image, not orphan
  registeredOriginSizeMismatchCount:0,
  finalizedReadyMissingOriginCount:0,
  abortedOriginWaitingRemovalCount:0
});

test('healthy reviewed Staging-shaped origin inventory remains normal; legacy registered objects are not orphans',()=>{
  assert.equal(classify(healthy),'normal');
  assert.equal(classify({...healthy,abortedOriginWaitingRemovalCount:1}),'normal');
});

test('actual untracked, registered-size mismatch, or missing READY origin raises critical',()=>{
  for(const [field,extra] of [
    ['originUntrackedObjectCount',{}],
    ['registeredOriginSizeMismatchCount',{}],
    ['finalizedReadyMissingOriginCount',{}]
  ]){
    assert.equal(classify({...healthy,...extra,[field]:1}),'critical',field);
  }
});

test('missing, stale-contract, unverified-bucket or unsafe-delete-shaped payload is UNKNOWN, not normal',()=>{
  for(const input of [
    null,undefined,{},[],0,'ok',
    {...healthy,contract:'ddv.gallery-storage-reconciliation@0'},
    {...healthy,bucketChecked:false},
    {...healthy,safeToAutoDelete:true},
    {...healthy,originUntrackedObjectCount:undefined},
    {...healthy,registeredOriginSizeMismatchCount:null},
    {...healthy,finalizedReadyMissingOriginCount:'0'}
  ]){
    assert.equal(classify(input),'unknown');
  }
});

test('noninteger, negative and inconsistent counters do not silently coerce to zero',()=>{
  for(const input of [
    {...healthy,originObjectCount:NaN},
    {...healthy,originMetadataRecordedBytes:Infinity},
    {...healthy,originUntrackedObjectCount:-1},
    {...healthy,originJournaledObjectCount:0.5},
    {...healthy,originRegisteredObjectCount:3},
    {...healthy,registeredWithoutGalleryIntentCount:3},
    {...healthy,originMetadataSizeUnknownCount:1}
  ]) assert.equal(classify(input),'unknown');
});

test('Retention Edge consumes the exact classifier; malformed RPC telemetry fails closed and is not echoed',()=>{
  const worker=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
  assert.match(worker,/import \{ classifyGalleryOriginIntegrity \} from '\.\.\/_shared\/gallery-origin-integrity\.mjs';/);
  assert.match(worker,/classifyGalleryOriginIntegrity\(galleryOriginError \? null : galleryOriginReconciliation\)/);
  assert.match(worker,/GALLERY_ORIGIN_RECONCILIATION_INVALID/);
  assert.match(worker,/galleryOriginIntegrity==='unknown'\s*\? null : galleryOriginReconciliation/);
  assert.doesNotMatch(worker,/Number\(galleryOriginReconciliation\.originUntrackedObjectCount \?\? 0\)/);
});
