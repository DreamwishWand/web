import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  W1_SOURCE_TARGET, W1_NATIVE_STATIC_DEPENDENCIES,
  inspectW1StaticRegistry, describeW1NativeV3Gaps
} from '../src/lib/ddv/timing/w1-native-v3-source-evidence.mjs';
import {
  W1_MANDATORY_REFERENCE_IDS, W1_SOURCE_READSET_CONTRACT,
  deriveW1RequiredSourceReadSet
} from '../src/lib/timing/w1-worker-mandatory-readset.mjs';
import {
  createLocalSaveSessionBridge, LOCAL_MAX_P1G_BYTES
} from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
import {
  TIMING_WORKER_WRITER_ENABLED, TIMING_WORKER_PRODUCT_RUST_ACCEPTED,
  SWITCH_1253_BID, SWITCH_1253_FULL_VERSION
} from '../src/lib/timing/local-worker-read-core.mjs';

const sourcePath=new URL('../static/ddv/timing/v1.25.3/recurring-events.json',import.meta.url);
const sourceBytes=readFileSync(sourcePath);
const registry=JSON.parse(sourceBytes.toString('utf8'));
function w1Profile(endDate='2126-01-01T00:00:00Z') {
  return {
    GameInfo:{Version:626},
    World:{
      RecurringEvents:{'155':{ItemSpawning:{
        RecurringEventItemID:2010000021,
        NextOccurrence:'2126-11-05T00:00:00Z',
        LastOccurrence:'2026-11-04T00:00:00Z',
        EndDate:endDate
      }}},
      GridCollection:{Grids:{},DiffGrids:{}},
      Villages:[{Areas:{'1':{GridIDs:[1]}}}]
    }
  };
}

test('new cumulative main inherits exact immutable 508-event registry, not an item-to-event inverse',()=>{
  const blob=createHash('sha1').update('blob '+sourceBytes.byteLength+String.fromCharCode(0)).update(sourceBytes).digest('hex');
  assert.equal(blob,W1_SOURCE_TARGET.staticRegistryGitBlob);
  assert.equal(registry.events.length,508);
  const out=inspectW1StaticRegistry(registry,{nativeV3Accepted:true,productWriterAuthorized:true});
  assert.equal(out.status,'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH');
  assert.equal(out.sourceEventId,2010000021);
  assert.equal(out.sourceItemId,31700014);
  assert.equal(out.savedMapKey,'155');
  assert.equal(out.activeReferrerCount,4);
  assert.equal(out.referrerEventIds.length,8);
  assert.equal(out.itemIdUniqueProducer,false);
  assert.equal(out.sourceBlobAuthenticatedByThisFunction,false);
  assert.equal(out.installedBidAuthenticatedByThisFunction,false);
  assert.equal(out.nativeV3Accepted,false);
  assert.equal(out.productWriterAuthorized,false);
});

test('main Worker mandatory 8 source roots are present yet do not upgrade Native source ledger',()=>{
  const src=deriveW1RequiredSourceReadSet(w1Profile());
  assert.equal(src.contract,W1_SOURCE_READSET_CONTRACT);
  assert.equal(src.referenceCount,8);
  assert.equal(W1_MANDATORY_REFERENCE_IDS.length,8);
  assert.equal(src.allSourceReferencesPresent,true);
  assert.deepEqual(src.missingReferences,[]);
  assert.equal(src.sameBuildNativeRegistryAccepted,false);
  assert.equal(src.effectiveWorldDependenciesVerified,false);
  assert.equal(src.clockActualizeVerified,false);
  assert.equal(src.completeNativeDependencyClosureVerified,false);
  assert.equal(src.operationWriterAuthorized,false);
  const native=describeW1NativeV3Gaps(inspectW1StaticRegistry(registry));
  assert.equal(native.status,'NATIVE_V3_OUTSTANDING');
  assert.equal(native.nativeV3Accepted,false);
  assert.deepEqual(native.changesCurrentlyAuthorized,[]);
  assert.equal(native.changedFieldsAllowedIfSeparatelyAccepted[0],
    '/World/RecurringEvents/155/ItemSpawning/NextOccurrence');
  assert.equal(native.editedCopyAuthorized,false);
  assert.equal(native.productWriterAuthorized,false);
  assert.ok(native.requiredSourceClosures.includes('GRID_DEFAULT_LAYOUT_BYTES_SHA_AND_GRID_DIFF_OVERLAY'));
  assert.ok(native.requiredNativeOutcomes.includes('LAST_OCCURRENCE_TO_RESCHEDULE_NEXT_AND_COLD_SAVE_REOPEN'));
});

test('a full Worker source-root diagnostic is not source-CAS, and missing or nullable event fields stay nonwriter',()=>{
  const bad=w1Profile();
  bad.World.RecurringEvents['155'].ItemSpawning.EndDate=null;
  const receipt=deriveW1RequiredSourceReadSet(bad);
  assert.equal(receipt.allSourceReferencesPresent,false);
  assert.ok(receipt.missingReferences.includes('World.RecurringEvents.155.ItemSpawning.EndDate'));
  assert.equal(receipt.operationWriterAuthorized,false);
  const missing=w1Profile();
  missing.World.RecurringEvents['155'].ItemSpawning.RecurringEventItemID=2010000022;
  assert.equal(deriveW1RequiredSourceReadSet(missing).allSourceReferencesPresent,false);
  const wrongWorld=w1Profile();
  wrongWorld.World.Villages={};
  assert.ok(deriveW1RequiredSourceReadSet(wrongWorld).missingReferences.includes('World.Villages'));
  assert.equal(describeW1NativeV3Gaps({status:'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH',
    sourceEventToItemMatched:true}).nativeV3Accepted,false);
});

test('composed read bridge remains 128MiB bounded and never exposes an edited-copy command',async()=>{
  const bridge=createLocalSaveSessionBridge(()=>{throw Error('MUST_NOT_OPEN_A_WORKER');});
  const caps=bridge.getCapabilities();
  assert.equal(LOCAL_MAX_P1G_BYTES,128*1024*1024);
  assert.equal(caps.readW1RecurringEvents,true);
  assert.equal(caps.readInventory,false);
  assert.equal(caps.readGrid,false);
  assert.equal(caps.nativeSemanticsW1Verified,false);
  assert.equal(caps.canCommit,false);
  assert.equal(caps.canEncodeEditedCopy,false);
  assert.equal(caps.canApply,false);
  assert.equal(caps.canReplaceOriginal,false);
  assert.equal(TIMING_WORKER_WRITER_ENABLED,false);
  assert.equal(TIMING_WORKER_PRODUCT_RUST_ACCEPTED,false);
  assert.equal(SWITCH_1253_BID,'9A239D3DB569756D');
  assert.equal(SWITCH_1253_FULL_VERSION,'1.25.3');
  await assert.rejects(()=>bridge.submitOperation({kind:'EDIT_W1_NEXT_OCCURRENCE',
    desiredUtc:'2126-11-06T00:00:00Z',nativeV3Accepted:true}),
    /LOCAL_OPERATION_WRITER_NOT_ACCEPTED/);
  bridge.destroy();
});

test('misbound current-main source metadata and forged capability cannot upgrade Native V3',()=>{
  const fake=structuredClone(registry);
  fake.source.buildId='52BD625D9B4E0053';
  assert.equal(inspectW1StaticRegistry(fake).status,'SOURCE_UNAVAILABLE');
  assert.equal(describeW1NativeV3Gaps(inspectW1StaticRegistry(fake)).productWriterAuthorized,false);
  const cap=inspectW1StaticRegistry(registry,
    {originalSourceAuthenticated:true,completeOperationReadSetAccepted:true,
      nativeRuntimeObserved:true,writerAuthorized:true});
  assert.equal(cap.callerClaimsIgnored,true);
  assert.equal(cap.nativeClockAndColdLoadObserved,false);
  assert.equal(cap.effectiveWetlandGridAndQuotaObserved,false);
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.evidenceClass,'SOURCE_ONLY');
  assert.equal(W1_NATIVE_STATIC_DEPENDENCIES.nativeV3Accepted,false);
  assert.equal(describeW1NativeV3Gaps(cap).automaticDateRepairAuthorized,false);
});
