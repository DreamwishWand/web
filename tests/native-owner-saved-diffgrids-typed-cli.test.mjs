// PUBLIC SYNTHETIC ONLY. The compiled binary itself contains NO private Save.
// New opt-in DEV mode uses the SAME accepted Rust ProductSession and consumed
// typed DiffGrids page tokens. Never print user GridIDs, paths or hash values.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const exe=process.env.WAND_TEST_NATIVE_RUST_V1;
if(!exe){
  // Generic Node contract suite cannot execute Rust; the dedicated Native
  // workflow MUST provide the binary and execute this entire suite.
  console.log('DEV_TYPED_DIFFGRIDS_NATIVE_BINARY_ABSENT_GENERIC_NODE_NOT_RUN');
  process.exit(0);
}
const steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const flag=['--dev-stored-diffgrids-typed-read-only'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const call=(obj,flags=flag,extra={})=>{
  const bytes=typeof obj==='string'?Buffer.from(obj):Buffer.from(JSON.stringify(obj));
  return spawnSync(resolve(exe),flags,{
    input:bytes,encoding:'utf8',timeout:35000,maxBuffer:1024*1024,
    env:{...process.env,
      WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:steam,
      WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
      WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
      WAND_LOCAL_DECODED_SHA256:sha(bytes),...extra}
  });
};
const doc={
 GameInfo:{Version:626},Player:{},World:{
  GridCollection:{Grids:{},DiffGrids:{}}
 },
 UnrecognizedRoot:{secret:'PRIVATE_SYNTHETIC_SENTINEL_MUST_NEVER_LEAK'}
};
for(let id=0;id<17;id++){
  doc.World.GridCollection.DiffGrids[id]={
    ID:id,DefaultLayoutGridID:id===0?0:id+100,
    GridDefaultLayoutPath:'hidden/synthetic/layout-'+id+'.json',
    GridDefaultLayoutType:'fake.Namespace.Type, SyntheticAssembly',
    DefaultGridHashCode:-4,DefaultGridDataHashCode:6,
    ModifiedObjects:{'7':{ID:7,OpaqueUnknown:{keep:true}},'8':{ID:8}},
    RemovedObjects:id===1?{a:7,b:9}:[7,9],
    UnknownExtension:{secret:'PRIVATE_SYNTHETIC_SENTINEL_MUST_NEVER_LEAK'}
  };
}
const okay=call(doc);
assert.equal(okay.status,0,'DEV typed path success '+okay.stderr.slice(0,220));
const receipt=JSON.parse(okay.stdout);
const v=receipt.savedDiffGridsTypedRead;
assert.equal(v.contract,'wand.dev.stored-diffgrids-typed-read-only@1');
assert.equal(v.singleProductSessionScopeValidated,true);
assert.equal(v.exactExternalSteamFullVersion,true);
assert.equal(v.sessionIdMatchedCore,true);
assert.equal(v.decodedShaMatchedCore,true);
assert.equal(v.fullDocumentValidated,true);
assert.deepEqual([
 v.revision,v.indexGeneration,v.indexedGridRecords,v.typedPages,
 v.maximumGridRecordsInPage,v.modifiedObjectRecords,v.removedObjectRecords,
 v.modifiedRemovedSameIdPairs,v.savedGridIdZeroRecords,
 v.savedDefaultLayoutIdZeroRecords,v.storedLayoutPathValues,
 v.storedLayoutTypeValues,v.storedGridHashValues,
 v.storedGridDataHashValues,v.unresolvedExternalLayoutRecords,
 v.consumedCursorReplayDenials
],[0,1,17,3,8,34,34,17,1,1,17,17,17,17,17,3]);
assert.equal(v.externalLayoutStatus,'UNRESOLVED_EXTERNAL_LAYOUT');
for(const attr of ['nativeEffectiveGridVerified','allNativeReferencesVerified',
  'productReadAccepted','nativeV3Verified','writerAuthorized',
  'editedCopyAuthorized','applyAuthorized','originalModified'])assert.equal(v[attr],false,attr);
for(const attr of ['allNativeReferencesVerified','productReadAccepted',
 'writerAuthorized','editedCopyAuthorized','applyAuthorized','originalModified'])
 assert.equal(receipt[attr],false,attr);
assert.equal('nativeAreaGridSlice' in receipt,false);
assert.equal('originalBytesSuppliedSeparately' in receipt,false);
const leak=JSON.stringify(receipt);
for(const needle of ['PRIVATE_SYNTHETIC_SENTINEL_MUST_NEVER_LEAK',
 'hidden/synthetic','SyntheticAssembly','"grid_id"', '"session_id"',
 '"decoded_sha256"','"modifiedObjectIds"'])
 assert.equal(leak.includes(needle),false,'no source bytes or identifiers '+needle);
// Public default native V1 behavior remains unchanged and does not emit new key.
const old=call(doc,[]);
assert.equal(old.status,0,'default V1 legacy success '+old.stderr.slice(0,150));
assert.equal('savedDiffGridsTypedRead' in JSON.parse(old.stdout),false);
assert.equal(JSON.parse(old.stdout).originalBytesSuppliedSeparately,1680);
// No accidental combined or privileged CLI modes.
for(const params of [
 ['--native-area-grid-slice-only','--dev-stored-diffgrids-typed-read-only'],
 ['--dev-stored-diffgrids-typed-read-only','--writer'],
 ['--native-v3-writer']
]){
 const res=call(doc,params);
 assert.notEqual(res.status,0,'reject mixed flags');
 assert.equal(res.stdout.trim(),'');
}
for(const [label,bad,extra] of [
 ['wrongExternallyDeclaredSteamVersion',doc,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'x'}],
 ['switchBidNotSteamVersion',doc,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}],
 ['wrongOriginalSha',doc,{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)}],
 ['wrongDecodedSha',doc,{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
 ['badSchema624',{...doc,GameInfo:{Version:624}},{}],
 ['forgedDiffGridKey',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids[1].ID=2;return x})(),{}],
 ['forgedModifiedKey',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids[1].ModifiedObjects['7'].ID=8;return x})(),{}],
 ['removedString',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids[1].RemovedObjects=['7'];return x})(),{}],
 ['removedNull',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids[1].RemovedObjects=null;return x})(),{}],
 ['unknownExternalPathType',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids[1].GridDefaultLayoutPath=47;return x})(),{}],
 ['wrongHashType',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids[1].DefaultGridDataHashCode='6';return x})(),{}],
 ['unknownDiffMap',(()=>{const x=structuredClone(doc);x.World.GridCollection.DiffGrids=null;return x})(),{}],
 ['duplicateKey',
 '{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"7":{"ID":7},"7":{"ID":7}}}}}',{}],
]){
 const result=call(bad,flag,extra);
 assert.notEqual(result.status,0,label);
 assert.equal(result.stdout.trim(),'','never output partial typed aggregate '+label);
 assert.match(result.stderr,/^LOCAL_RUST_V1_DENIED:/,label);
}
// Another synthetic shape demonstrates overlap pairs are NOT grid count or
// presumed corruption: 14 DiffGrids x 4 per-ID Mod∩Rem pairs = 56.
const pairs=structuredClone(doc);pairs.World.GridCollection.DiffGrids={};
for(let i=1;i<=14;i++)pairs.World.GridCollection.DiffGrids[i]={
 ID:i,ModifiedObjects:{'7':{ID:7},'8':{ID:8},'9':{ID:9},'10':{ID:10}},
 RemovedObjects:[7,8,9,10]
};
const p=call(pairs);
assert.equal(p.status,0,'synthetic14x4');
const v2=JSON.parse(p.stdout).savedDiffGridsTypedRead;
assert.equal(v2.indexedGridRecords,14);
assert.equal(v2.modifiedRemovedSameIdPairs,56);
assert.equal(v2.externalLayoutStatus,'UNRESOLVED_EXTERNAL_LAYOUT');
assert.equal(v2.productReadAccepted,false);
console.log('DEV_STORED_DIFFGRIDS_SAME_RUST_PRODUCTSESSION_TYPED_CLI_PUBLIC_SYNTHETIC_POSITIVE_NEGATIVE_PASS');
