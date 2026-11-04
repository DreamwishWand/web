import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  describeItemPersonalOverlay,ITEM_OVERLAY_SOURCE_TARGETS,
  ITEM_OVERLAY_TYPED_READ_PLAN,ITEM_OVERLAY_PRODUCT_ENABLED,
  ITEM_OVERLAY_WRITER_ENABLED
} from '../src/lib/ddv/core/items/local-item-overlay-read-contract.mjs';

const index=JSON.parse(readFileSync('static/ddv/collection/v1.25/index.json','utf8'));
const session=Object.freeze({
  contract:'wand.local.save-session.read@1',
  platform:'switch',fullVersion:'1.25.3',buildKind:'switch-bid',
  buildId:'9A239D3DB569756D',schema:626,
  sourceIdentity:'externally-attested-switch-bid',
  sourceSha256:'a'.repeat(64),sessionId:'b'.repeat(32),
  revision:0,indexGeneration:1,writerAuthorized:false
});
const caps=Object.freeze({
  contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
  readInventory:false,readOwnership:false,
  canCommit:false,canEncodeEditedCopy:false,canApply:false,canReplaceOriginal:false
});
const bridge=(receipt=session,capabilities=caps)=>({
  getSession:()=>receipt,getCapabilities:()=>capabilities
});
const check=r=>{
  assert.equal(r.canShowPersonalState,false);
  assert.equal(r.canShowPercentage,false);
  assert.equal(r.canQueryItemFromExistingWorker,false);
  assert.equal(r.canWriteSave,false);
  assert.equal(r.itemState.owned,'UNKNOWN');
  assert.equal(r.itemState.discovered,'UNKNOWN');
  assert.equal(r.itemState.missing,'UNKNOWN');
  assert.equal(r.itemState.quantity,null);
  assert.equal(r.itemState.entryDenominator,null);
  assert.equal(r.itemState.uniqueDenominator,null);
  assert.equal(r.itemState.progressRatio,null);
};
test('01D Overlay never joins 1.25.0 reference to 1.25.3 worker Save even with a plausible session',()=>{
  const r=describeItemPersonalOverlay({referenceIndex:index,sessionBridge:bridge()});
  assert.equal(r.reason,'CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH');
  assert.equal(r.catalog.buildId,'52BD625D9B4E0053');
  assert.equal(r.saveTarget.buildId,'9A239D3DB569756D');
  check(r);
});
test('Missing or unopened 01A Single Session has Reference-only state',()=>{
  check(describeItemPersonalOverlay({referenceIndex:index}));
  assert.equal(describeItemPersonalOverlay({referenceIndex:index,sessionBridge:bridge(null)}).reason,'NO_ACTIVE_LOCAL_SAVE');
  assert.equal(describeItemPersonalOverlay({referenceIndex:index}).reason,'NO_01A_SINGLE_SESSION');
});
test('Reject spoofed session BID, schema, source SHA, stale receipt and external platform',()=>{
  const variants=[
    {...session,buildId:ITEM_OVERLAY_SOURCE_TARGETS.catalog1250.buildId},
    {...session,schema:624},{...session,platform:'steam-windows'},
    {...session,revision:1},{...session,indexGeneration:0},
    {...session,sourceSha256:'notsha'}, {...session,writerAuthorized:true},
    {...session,sourceIdentity:'derived-from-profile'}
  ];
  for (const x of variants){
    const r=describeItemPersonalOverlay({referenceIndex:index,sessionBridge:bridge(x)});
    assert.equal(r.status,'BLOCKED');check(r);
  }
});
test('Malformed/forged catalogue source metadata cannot manufacture an overlay',()=>{
  for(const wrong of [
    null,{...index,t:{...index.t,buildID:'9A239D3DB569756D'}},
    {...index,t:{...index.t,gameVersion:'1.25.3'}},
    {...index,n:12553},
    {...index,shards:[]}
  ]) {
    const r=describeItemPersonalOverlay({referenceIndex:wrong,sessionBridge:bridge()});
    assert.equal(r.reason,'REFERENCE_INDEX_INVALID');check(r);
  }
});
test('Session caller capability and source assertions cannot authorize any positive ownership',()=>{
  const upgraded={...caps,readInventory:true,readOwnership:true};
  const r=describeItemPersonalOverlay({referenceIndex:index,sessionBridge:bridge(session,upgraded)});
  assert.equal(r.reason,'CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH');check(r);
  assert.equal(ITEM_OVERLAY_TYPED_READ_PLAN.length,2);
  assert.ok(ITEM_OVERLAY_TYPED_READ_PLAN.every(x=>x.apiAvailableOnPR383===false));
  assert.equal(ITEM_OVERLAY_PRODUCT_ENABLED,false);
  assert.equal(ITEM_OVERLAY_WRITER_ENABLED,false);
});
