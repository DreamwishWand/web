// 05 QR-C PR852 independent *synthetic only* Rust CLI negative and leak review.
// No original P1G, private SHA/SessionID/IDs or real decoded JSON in public CI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const native=process.env.WAND_TEST_NATIVE_RUST_V1;
if(!native){
  if(process.env.QA05QRC852_REQUIRE_NATIVE==='1')
    throw Error('Focused QA requires built real Rust binary; no silent SKIP');
  // Generic Node contract CI does not build the Rust executable. Explicit NOT_RUN,
  // never an independently attested native CLI PASS; focused workflow enforces it.
  console.log('QA05QRC852_REAL_RUST_CLI_NOT_RUN_GENERIC_NODE');
  process.exit(0);
}
const full='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const base={GameInfo:{Version:626},Player:{UnknownPrivateLike:'SYNTHETIC_NEVER_ECHO_SECRET_7333'},
  World:{Villages:[{Areas:{'1':{GridIDs:[7]}}}],
    GridCollection:{Grids:{'7':{ID:7,Objects:{'4':{ID:4,ItemID:100}}}},
      UnrelatedUnknown:{'opaque':'RETAIN_ALL_BYTES'}}}};
const probe=['--native-diffgrids-nonproduct-witness-only'];
const fake=structuredClone(base);
fake.World.GridCollection.DiffGrids={
 '7':{ID:7,GridDefaultLayoutPath:'SYNTHETIC_SECRET_PATH_NEVER_OUTPUT_9911',
      DefaultLayoutGridID:0,ModifiedObjects:{'4':{ID:4,unused:{secret:'MARKER_SHOULD_REMAIN_OPAQUE'}},'5':{ID:5}},
      RemovedObjects:[4,4,5,6]},
 '8':{ID:8,ModifiedObjects:{'4':{ID:4}},RemovedObjects:{'A':4}}
};
const run=(doc,args=probe,overrides={})=>{
  const bytes=Buffer.from(typeof doc==='string'?doc:JSON.stringify(doc));
  return spawnSync(resolve(native),args,{input:bytes,encoding:'utf8',timeout:40000,maxBuffer:1024*1024,
    env:{...process.env,
      WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:full,
      WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
      WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
      WAND_LOCAL_DECODED_SHA256:createHash('sha256').update(bytes).digest('hex'),
      ...overrides}});
};
const good=run(fake);
assert.equal(good.status,0,'real Rust CLI '+good.stderr.slice(0,150));
const output=JSON.parse(good.stdout);
const r=output.nonproductDiffGridsWitness;
assert.ok(r,'explicit opt-in CLI diagnostic present');
assert.equal(r.contract,'wand.native.nonproduct.diffgrids-samesession-witness@1');
assert.equal(r.sourceBuildExactlySteam1253,true);
assert.equal(r.singleRustProductSessionScopeValidated,true);
assert.equal(r.sessionIdMatchedCore,true);
assert.equal(r.decodedShaMatchedCore,true);
assert.deepEqual([r.diffGridsMapPresent,r.diffGridRecords,r.modifiedObjectRecords,
 r.removedObjectRecords,r.modifiedRemovedIdIntersections,r.removedArrayMaps,r.removedObjectMaps],
 [true,2,3,5,3,1,1]);
assert.deepEqual([r.defaultLayoutGridIDRecords,r.defaultLayoutZeroIDRecords,
 r.gridDefaultLayoutPathRecords],[1,1,1]);
for(const key of ['defaultLayoutNativeSemanticsVerified','overlapLegalityVerified',
 'nativeV3Verified','fullNativeReferenceClosureVerified','productReadAccepted','writerAuthorized'])
 assert.equal(r[key],false,'nonproduct authority forbids '+key);
for(const key of ['allNativeReferencesVerified','productReadAccepted','writerAuthorized',
 'editedCopyAuthorized','applyAuthorized','originalModified','cloudUploadPerformed'])
 assert.equal(output[key],false,key);
for(const secret of ['SYNTHETIC_SECRET_PATH_NEVER_OUTPUT_9911',
 'SYNTHETIC_NEVER_ECHO_SECRET_7333','MARKER_SHOULD_REMAIN_OPAQUE'])
 assert.ok(!good.stdout.includes(secret)&&!good.stderr.includes(secret),'no private-like value leak');
for(const k of ['session_id','sessionId','decoded_sha256','decodedSHA256',
 'gridId','objectId','gridIDs','modifiedObjectIDs','removedObjectIDs','layoutPath'])
 assert.equal(Object.hasOwn(r,k),false,'no individual ID/path/Session/SHA: '+k);
assert.equal(Object.hasOwn(output,'nativeAreaGridSlice'),false,'opt-in single mode only');
const absent=run(base);assert.equal(absent.status,0);
const noDiff=JSON.parse(absent.stdout).nonproductDiffGridsWitness;
assert.equal(noDiff.diffGridsMapPresent,false);
assert.equal(noDiff.diffGridRecords,0);
assert.equal(noDiff.fullNativeReferenceClosureVerified,false);
const defaultRun=run(fake,[]);
assert.equal(defaultRun.status,0);
assert.equal(Object.hasOwn(JSON.parse(defaultRun.stdout),'nonproductDiffGridsWitness'),false,
 'no implicit native diagnostic on ordinary V1');
const malformed=[
 ['mismatchGrid',d=>d.World.GridCollection.DiffGrids['7'].ID=9],
 ['mismatchObject',d=>d.World.GridCollection.DiffGrids['7'].ModifiedObjects['4'].ID=9],
 ['badRemoved',d=>d.World.GridCollection.DiffGrids['7'].RemovedObjects=['4']],
 ['nullRemoved',d=>d.World.GridCollection.DiffGrids['7'].RemovedObjects=null],
 ['badModified',d=>d.World.GridCollection.DiffGrids['7'].ModifiedObjects=[]],
 ['badDefaultID',d=>d.World.GridCollection.DiffGrids['7'].DefaultLayoutGridID='0'],
 ['badPathType',d=>d.World.GridCollection.DiffGrids['7'].GridDefaultLayoutPath=42],
 ['pathTooLong',d=>d.World.GridCollection.DiffGrids['7'].GridDefaultLayoutPath='x'.repeat(4100)],
 ['nullDiffMap',d=>d.World.GridCollection.DiffGrids=null],
 ['leadingZero',d=>{
    d.World.GridCollection.DiffGrids['07']=d.World.GridCollection.DiffGrids['7'];
    delete d.World.GridCollection.DiffGrids['7'];
 }]
];
for(const [name,change] of malformed){
 const d=structuredClone(fake);change(d);
 const bad=run(d);assert.notEqual(bad.status,0,name);
 assert.equal(bad.stdout.trim(),'','no partial output: '+name);
 assert.match(bad.stderr,/^LOCAL_RUST_V1_DENIED:/,name);
}
for(const [label,args,env] of [
 ['wrongExternalBuild',probe,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}],
 ['wrongSameSchemaFullVersion',probe,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-OTHER'}],
 ['wrongDecodedSHA',probe,{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
 ['unapprovedWriter',['--native-diffgrids-native-v3-writer'],{}],
 ['bothModes',['--native-area-grid-slice-only',...probe],{}]
]){
 const denied=run(fake,args,env);
 assert.notEqual(denied.status,0,label);
 assert.equal(denied.stdout.trim(),'','no partial secrets: '+label);
 assert.match(denied.stderr,/^LOCAL_RUST_V1_DENIED:/,label);
}
console.log('QA05QRC852_NONPRODUCT_RUST_CLI_SYNTHETIC_COUNTS_CAS_UNKNOWN_LEAK_NEGATIVES_PASS');
