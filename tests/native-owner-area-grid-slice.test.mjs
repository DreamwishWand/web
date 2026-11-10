// Source-only native Rust CLI proof. Public synthetic JSON only, never private P1G.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const exe=process.env.WAND_TEST_NATIVE_RUST_V1;
if(!exe){console.log('AREA_GRID_NATIVE_BINARY_ABSENT_GENERIC_NODE_NOT_RUN');process.exit(0);}
const build='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const sha=b=>createHash('sha256').update(b).digest('hex');
const valid='{"GameInfo":{"Version":626},"Player":{},"World":{"Villages":[{"Areas":{"1":{"GridIDs":[7]}}}],"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":100}}}}}}}';
const run=(source,args=['--native-area-grid-slice-only'],extra={})=>{
 const input=Buffer.from(source,'utf8');
 return spawnSync(resolve(exe),args,{input,encoding:'utf8',timeout:40000,maxBuffer:1024*1024,
  env:{...process.env,
    WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:build,
    WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
    WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
    WAND_LOCAL_DECODED_SHA256:sha(input),...extra}});
};
const okay=run(valid);
assert.equal(okay.status,0,'native AreaGrid positive '+okay.stderr.slice(0,200));
const receipt=JSON.parse(okay.stdout);
assert.equal(receipt.coreOwnedIndexedPlayerFields,0);
assert.equal(receipt.coreOwnedIndexedWorldFields,2);
assert.deepEqual([
 receipt.nativeAreaGridSlice.villageRecords,
 receipt.nativeAreaGridSlice.areaRecords,
 receipt.nativeAreaGridSlice.gridRecords,
 receipt.nativeAreaGridSlice.directAreaGridLinks,
 receipt.nativeAreaGridSlice.gridObjectIdentityRecords
],[1,1,1,1,1]);
for(const k of ['allNativeReferencesVerified','productReadAccepted','writerAuthorized',
 'editedCopyAuthorized','applyAuthorized','physicalGameInstallCryptographicallyProven'])
  assert.equal(receipt[k],false,k);
for(const k of ['fullNativeReferenceClosureVerified','areaGroupFootprintVerified','nativeV3Verified',
 'productReadAccepted','writerAuthorized'])assert.equal(receipt.nativeAreaGridSlice[k],false,k);
// Synthetic native Island direct-root path: 7 is a Village Area root, 8 is
// an Island root. Neither route is a Native-verified game placement operation.
const withGrid8=valid.replace(
 '"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":100}}}',
 '"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":100}}},"8":{"ID":8,"Objects":{}}'
);
const floating=withGrid8.replace(
 '"GridCollection":',
 '"FloatingIslands":{"1540000147":{"SceneItemId":1540000147,"GridIDs":[8]}},"GridCollection":'
);
const islandPositive=run(floating);
assert.equal(islandPositive.status,0,'typed FloatingIsland direct root');
const islandReceipt=JSON.parse(islandPositive.stdout).nativeAreaGridSlice;
assert.equal(islandReceipt.floatingIslandMapPresent,true);
assert.equal(islandReceipt.floatingIslandRecords,1);
assert.equal(islandReceipt.floatingIslandDirectGridLinks,1);
assert.equal(islandReceipt.directRootOwnershipUnique,true);
assert.equal(islandReceipt.fullNativeReferenceClosureVerified,false);
const absentIsland=JSON.parse(okay.stdout).nativeAreaGridSlice;
assert.equal(absentIsland.floatingIslandMapPresent,false);
assert.equal(absentIsland.directRootOwnershipUnique,false);
for(const [name,json] of [
 ['islandOrphan',floating.replace('"GridIDs":[8]','"GridIDs":[9]')],
 ['islandDuplicate',floating.replace('"GridIDs":[8]','"GridIDs":[8,8]')],
 ['islandAreaCrossOwner',floating.replace('"GridIDs":[8]','"GridIDs":[7]')],
 ['islandSceneMismatch',floating.replace('"SceneItemId":1540000147','"SceneItemId":1540000148')],
 ['islandNonCanonicalMapKey',floating.replace('"1540000147":{"SceneItemId"','"01540000147":{"SceneItemId"')],
 ['islandUnsupportedType',floating.replace('"GridIDs":[8]','"GridIDs":null')],
 ['twoAreasSameRoot',valid.replace('"1":{"GridIDs":[7]}','"1":{"GridIDs":[7]},"2":{"GridIDs":[7]}')],
]){
 const denied=run(json);
 assert.notEqual(denied.status,0,name);
 assert.equal(denied.stdout.trim(),'','no partial receipt '+name);
 assert.match(denied.stderr,/^LOCAL_RUST_V1_DENIED:/,name);
}
const unchangedDefault=run(valid,[]);
assert.equal(unchangedDefault.status,0,'default V1 must remain usable');
assert.equal('nativeAreaGridSlice' in JSON.parse(unchangedDefault.stdout),false,
 'no opt-in should not add a new authority receipt');
for(const [label,json,args,extra] of [
 ['orphan',valid.replace('"GridIDs":[7]','"GridIDs":[9]'),undefined,{}],
 ['duplicateLink',valid.replace('"GridIDs":[7]','"GridIDs":[7,7]'),undefined,{}],
 ['badID',valid.replace('"7":{"ID":7','"7":{"ID":8'),undefined,{}],
 ['duplicateObjectAlias',valid.replace('"4":{"ID":4,"ItemID":100}',
   '"4":{"ID":4},"04":{"ID":4}'),undefined,{}],
 ['unknownGridType',valid.replace('"GridIDs":[7]','"GridIDs":null'),undefined,{}],
 ['wrongBuild',valid,undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'UNKNOWN'}],
 ['wrongSha',valid,undefined,{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
 ['badOpt',valid,['--native-v3-writer'],{}]
]){
 const denied=run(json,args,extra);
 assert.notEqual(denied.status,0,label);
 assert.equal(denied.stdout.trim(),'','no data on deny '+label);
 assert.match(denied.stderr,/^LOCAL_RUST_V1_DENIED:/,label);
}
// 00 CTRL-authorized R22 NONPRODUCT diagnostic: completely synthetic data.
// A DiffGrid may have the SAME ID as a Base Grid; this probe never judges
// whether Overlay and Modified∩Removed relationships are legal.
const diffDoc=JSON.parse(valid);
diffDoc.World.GridCollection.DiffGrids={
 '7':{ID:7,DefaultLayoutGridID:0,GridDefaultLayoutPath:'dummy/layout.json',
      ModifiedObjects:{'4':{ID:4},'5':{ID:5}},RemovedObjects:[4,6]},
 '8':{ID:8,ModifiedObjects:{'6':{ID:6}},RemovedObjects:{a:6}}
};
const diffJson=JSON.stringify(diffDoc);
const probeFlag=['--native-diffgrids-nonproduct-witness-only'];
const probe=run(diffJson,probeFlag);
assert.equal(probe.status,0,'nonproduct synthethic DiffGrids '+probe.stderr.slice(0,160));
const nonproduct=JSON.parse(probe.stdout);
const d=nonproduct.nonproductDiffGridsWitness;
assert.equal(d.contract,'wand.native.nonproduct.diffgrids-samesession-witness@1');
assert.equal(d.singleRustProductSessionScopeValidated,true);
assert.equal(d.sessionIdMatchedCore,true);
assert.equal(d.decodedShaMatchedCore,true);
assert.equal(d.sourceBuildExactlySteam1253,true);
assert.deepEqual([d.revision,d.indexGeneration,d.diffGridRecords,d.modifiedObjectRecords,
 d.removedObjectRecords,d.modifiedRemovedIdIntersections],[0,1,2,3,3,2]);
assert.equal(d.diffGridsMapPresent,true);
assert.deepEqual([d.removedArrayMaps,d.removedObjectMaps,d.defaultLayoutZeroIDRecords],[1,1,1]);
for(const prop of ['defaultLayoutNativeSemanticsVerified','overlapLegalityVerified',
 'nativeV3Verified','fullNativeReferenceClosureVerified','productReadAccepted',
 'writerAuthorized'])assert.equal(d[prop],false,prop);
assert.equal('session_id' in d,false,'do not output private session ID');
assert.equal('decoded_sha256' in d,false,'do not output private SHA');
assert.equal('nativeAreaGridSlice' in nonproduct,false,'separate diagnostics, no accidental Area authority');
assert.equal('nonproductDiffGridsWitness' in JSON.parse(run(valid,[]).stdout),false,
 'default native V1 stays unchanged');
const missingMap=run(valid,probeFlag);
assert.equal(missingMap.status,0);
assert.equal(JSON.parse(missingMap.stdout).nonproductDiffGridsWitness.diffGridsMapPresent,false);
for(const [label,doc] of [
 ['diffMapNull',(()=>{const x=structuredClone(diffDoc);x.World.GridCollection.DiffGrids=null;return x})()],
 ['diffIDForged',(()=>{const x=structuredClone(diffDoc);x.World.GridCollection.DiffGrids['7'].ID=9;return x})()],
 ['modifiedIDForged',(()=>{const x=structuredClone(diffDoc);x.World.GridCollection.DiffGrids['7'].ModifiedObjects['4'].ID=99;return x})()],
 ['removedWrongType',(()=>{const x=structuredClone(diffDoc);x.World.GridCollection.DiffGrids['7'].RemovedObjects=['4'];return x})()],
 ['modifiedWrongType',(()=>{const x=structuredClone(diffDoc);x.World.GridCollection.DiffGrids['7'].ModifiedObjects=[];return x})()],
 ['unknownDefaultPathType',(()=>{const x=structuredClone(diffDoc);x.World.GridCollection.DiffGrids['7'].GridDefaultLayoutPath=11;return x})()]
]){
 const bad=run(JSON.stringify(doc),probeFlag);
 assert.notEqual(bad.status,0,label);
 assert.equal(bad.stdout.trim(),'','no partly trusted witness on failure: '+label);
 assert.match(bad.stderr,/^LOCAL_RUST_V1_DENIED:/,label);
}
for(const [label,extra] of [
 ['wrongExternalBuild',{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'unknown'}],
 ['wrongSourceSHA',{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}]
]){
 const bad=run(diffJson,probeFlag,extra);
 assert.notEqual(bad.status,0,label);
 assert.equal(bad.stdout.trim(),'','no leak on failure '+label);
}
const both=run(diffJson,['--native-area-grid-slice-only','--native-diffgrids-nonproduct-witness-only']);
assert.notEqual(both.status,0,'no implicit combined authorization');
assert.equal(both.stdout.trim(),'');
console.log('NONPRODUCT_R22_RUST_DIFFGRIDS_SYNTHETIC_SAMESESSION_MASKED_NEGATIVES_PASS');

console.log('NATIVE_AREA_GRID_SLICE_PUBLIC_SYNTHETIC_DIRECT_LINK_OBJECT_CAS_CLI_NEGATIVES_PASS');
