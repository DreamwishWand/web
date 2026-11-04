// 05 QR independent new-only PR374 pure UI preview tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {previewNextOccurrenceUiOnly,W1_UI_WRITER_ENABLED,W1_UI_ENCODE_COPY_ENABLED}
 from '../src/lib/timing/w1-nextoccurrence-preview.mjs';
const BID='9A239D3DB569756D',OLD='2126-08-20T00:00:00Z';
const identity=()=>({sourceSha256:'a'.repeat(64),registrySha256:'b'.repeat(64),
 externalBid:BID,sourceSchema:626,sourceRevision:0});
const row=()=>({mapKey:'155',savedIndex:155,eventId:2010000021,oneof:'ItemSpawning',
 sourcePointer:'/World/RecurringEvents/155/ItemSpawning/NextOccurrence',
 nextOccurrence:OLD,ambiguous:false,registryKnown:true,policy:'W1'});
const preview=(r=row(),utc='2028-02-29T23:59:59Z',id=identity())=>
 previewNextOccurrenceUiOnly(r,utc,id);
test('no product commit authority: UI proposal is exactly one W1 path and flags OFF',()=>{
 const p=preview();
 assert.deepEqual(p.exactDiff,[{pointer:row().sourcePointer,oldUtc:OLD,
  newUtc:'2028-02-29T23:59:59Z'}]);
 assert.equal(p.previewOnly,true);
 for(const key of ['sourceOwnedCoreCasAccepted','fullReferenceClosureAccepted',
  'nativeSemanticsAccepted','atomicStageCommitted','encodeCopyAuthorized',
  'originalOverwriteAuthorized']) assert.equal(p[key],false,key);
 assert.equal(p.proposedRevision,1);
 assert.equal(p.sourceRevision,0);
 assert.equal(W1_UI_WRITER_ENABLED,false);
 assert.equal(W1_UI_ENCODE_COPY_ENABLED,false);
 // Format-only 64-hex witness is not a trusted Core attestation:
 assert.equal(preview(row(),'2026-11-04T01:02:03Z',{...identity(),sourceSha256:'0'.repeat(64)}).previewOnly,true);
});
test('wrong build, schema, registry/source witness, Revision and spoofed row never preview',()=>{
 for(const bad of [
  {sourceSha256:'bad'},{registrySha256:'x'},{externalBid:'0000000000000000'},
  {sourceSchema:624},{sourceRevision:1}
 ]) assert.throws(()=>preview(row(),'2026-11-04T00:00:00Z',{...identity(),...bad}),
  /W1_PREVIEW_SOURCE_IDENTITY_UNPROVEN/);
 for(const bad of [
  {mapKey:'156'},{savedIndex:156},{eventId:2010500008},{oneof:'FlowerSpawningInVillage'},
  {policy:'W2'},{ambiguous:true},{registryKnown:false},
  {sourcePointer:'/World/RecurringEvents/156/ItemSpawning/NextOccurrence'},
  {nextOccurrence:null}
 ]){
  assert.throws(()=>preview({...row(),...bad}),/W1_PREVIEW_(OPERATION_NOT_YET_SUPPORTED|UTC_FORMAT_REQUIRED)/);
 }
});
test('calendar invalid, no-op and intentional 2126 preservation',()=>{
 for(const next of ['','2026-02-29T00:00:00Z','2026-04-31T00:00:00Z',
 '2026-11-04T24:00:00Z','2026-11-04T00:60:00Z','2026-11-04T00:00:61Z',
 '2026-11-04T00:00:00+09:00','2126-08-20T00:00:00Zextra']){
  assert.throws(()=>preview(row(),next),/W1_PREVIEW_UTC_/);
 }
 assert.throws(()=>preview(row(),OLD),/W1_PREVIEW_NOOP_DENIED/);
 assert.equal(preview().exactDiff[0].oldUtc,OLD);
});
