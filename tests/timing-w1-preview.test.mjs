import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 previewNextOccurrenceUiOnly,W1_UI_WRITER_ENABLED,W1_UI_ENCODE_COPY_ENABLED
} from '../src/lib/timing/w1-nextoccurrence-preview.mjs';
const SHA='a'.repeat(64),REG='b'.repeat(64);
const base={sourceSha256:SHA,registrySha256:REG,externalBid:'9A239D3DB569756D',
 sourceSchema:626,sourceRevision:0};
const old='2126-08-20T00:00:00Z';
const row={mapKey:'155',savedIndex:155,eventId:2010000021,oneof:'ItemSpawning',
 sourcePointer:'/World/RecurringEvents/155/ItemSpawning/NextOccurrence',
 nextOccurrence:old,ambiguous:false,registryKnown:true,policy:'W1'};
test('W1 UI preview is exactly one old/new timestamp, preserves intentional 2126',()=>{
 const preview=previewNextOccurrenceUiOnly(row,'2026-11-03T00:00:00Z',base);
 assert.equal(preview.exactDiff.length,1);
 assert.equal(preview.exactDiff[0].oldUtc,old);
 assert.equal(preview.exactDiff[0].newUtc,'2026-11-03T00:00:00Z');
 assert.equal(preview.exactDiff[0].pointer,row.sourcePointer);
 assert.equal(preview.savedMapKey,'155');
 assert.equal(preview.eventId,2010000021);
 assert.equal(preview.sourceSha256,SHA);
 assert.equal(preview.registrySha256,REG);
 assert.equal(preview.originalFirstBackupRequired,true);
 for(const key of ['sourceOwnedCoreCasAccepted','fullReferenceClosureAccepted',
  'nativeSemanticsAccepted','atomicStageCommitted','encodeCopyAuthorized','originalOverwriteAuthorized'])
   assert.equal(preview[key],false,key);
 assert.equal(W1_UI_WRITER_ENABLED,false);
 assert.equal(W1_UI_ENCODE_COPY_ENABLED,false);
});
test('forged EventID, map key, oneof, policy, registry shape and SHA rejected',()=>{
 for(const delta of [
 {eventId:2010500008},{mapKey:'154'},{savedIndex:154},
 {oneof:'FlowerSpawningInVillage'},{sourcePointer:'/World/RecurringEvents/154/ItemSpawning/NextOccurrence'},
 {ambiguous:true},{registryKnown:false},{policy:'W2'}
 ]){
   assert.throws(()=>previewNextOccurrenceUiOnly({...row,...delta},'2026-11-03T00:00:00Z',base),
     /W1_PREVIEW_OPERATION_NOT_YET_SUPPORTED/);
 }
 for(const delta of [
 {externalBid:'0000000000000000'},{sourceSchema:624},{sourceRevision:1},
 {sourceSha256:'0'.repeat(4)},{registrySha256:''}
 ])assert.throws(()=>previewNextOccurrenceUiOnly(row,'2026-11-03T00:00:00Z',{...base,...delta}),
  /W1_PREVIEW_SOURCE_IDENTITY_UNPROVEN/);
});
test('invalid UTC dates and explicit same-value no-op are never repaired automatically',()=>{
 for(const next of ['','2026-02-29T00:00:00Z','2026-13-01T00:00:00Z',
 '2026-01-01T24:00:00Z','2026-01-01T00:61:00Z',
 '2026-01-01','2126-08-20T00:00:00+09:00']){
  assert.throws(()=>previewNextOccurrenceUiOnly(row,next,base),/W1_PREVIEW_UTC_/);
 }
 assert.throws(()=>previewNextOccurrenceUiOnly(row,old,base),/W1_PREVIEW_NOOP_DENIED/);
 assert.equal(previewNextOccurrenceUiOnly(row,'2028-02-29T23:59:59Z',base).previewOnly,true);
});
test('main UI offers original-backup download and disabled edited-copy/export but no mutation',()=>{
 const page=readFileSync(new URL('../src/routes/editor/timing/+page.svelte',import.meta.url),'utf8');
 assert.match(page,/data-w1-original-backup="true"/);
 assert.match(page,/data-w1-preview-select="true"/);
 assert.match(page,/data-w1-preview-build="true"/);
 assert.match(page,/data-w1-export-off="true"/);
 assert.match(page,/<button type="button" disabled data-w1-export-off/);
 assert.match(page,/requestUntouchedOriginalBackup\(/);
 const bridge=readFileSync(new URL('../src/lib/ddv/core/save/local-save-session-bridge.mjs',import.meta.url),'utf8');
 const transport=readFileSync(new URL('../src/lib/ddv/core/save/local-original-backup.mjs',import.meta.url),'utf8');
 assert.match(bridge,/if\(!hasUntouchedOriginalBackupSource\(scope\)\)/);
 assert.match(bridge,/requestOriginalByteBackup\(originalSelectedFile\)/);
 assert.match(transport,/URL\.createObjectURL\(originalSelectedFile\)/);
 assert.match(transport,/persistedVerified:false,writerAuthorized:false/);
 assert.match(transport,/\.original-backup\.p1g/);
 assert.doesNotMatch(page,/createEncodedProfile\(/);
});
