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
console.log('NATIVE_AREA_GRID_SLICE_PUBLIC_SYNTHETIC_DIRECT_LINK_OBJECT_CAS_CLI_NEGATIVES_PASS');
