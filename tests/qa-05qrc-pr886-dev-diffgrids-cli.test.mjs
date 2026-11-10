// Independent 05 QR-C PR886 only. Public synthetic stdin, never Owner P1G or IDs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const binary=process.env.WAND_TEST_NATIVE_RUST_V1;
if(!binary){
 if(process.env.QA05QRC886_REQUIRE_NATIVE==='1')throw Error('Focused QA real Native Rust CLI binary required');
 console.log('QA05QRC886_NATIVE_REAL_CLI_NOT_RUN_GENERIC_NODE');
 process.exit(0);
}
const steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',flags=['--dev-stored-diffgrids-typed-read-only'];
function invoke(doc,args=flags,extra={}){
 const bytes=Buffer.from(typeof doc==='string'?doc:JSON.stringify(doc),'utf8');
 return spawnSync(resolve(binary),args,{input:bytes,encoding:'utf8',timeout:45000,maxBuffer:1024*1024,
 env:{...process.env,
  WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:steam,
  WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
  WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
  WAND_LOCAL_DECODED_SHA256:createHash('sha256').update(bytes).digest('hex'),...extra}});
}
function fixture(count=17){
 const v={GameInfo:{Version:626,UnknownField:'NEVER_ECHO_ROOT_A01'},Player:{Future:['NEVER_ECHO_PLAYER_B02']},
 World:{Villages:[{Areas:{'1':{GridIDs:[7]}}}],GridCollection:{Grids:{'7':{ID:7,Objects:{'4':{ID:4,ItemID:100}}}},DiffGrids:{}}},
 HiddenRoot:{secret:'NEVER_ECHO_UNKNOWN_C03'}};
 for(let i=0;i<count;i++)v.World.GridCollection.DiffGrids[i]={
  ID:i,DefaultLayoutGridID:i===0?0:100+i,
  GridDefaultLayoutPath:'NEVER_ECHO_NATIVE_LAYOUT_D04_'+i+'.json',
  GridDefaultLayoutType:'Fake.Type, NEVER_ECHO_ASSEMBLY_E05',
  DefaultGridHashCode:-2147483648,DefaultGridDataHashCode:2147483647,
  ModifiedObjects:{'3':{ID:3,Future:'NEVER_ECHO_MOD_F06'},'4':{ID:4}},
  RemovedObjects:i%2===0?[3,3,4,5]:{first:3,second:4},
  FutureSaveField:'NEVER_ECHO_DIFF_G07'
 };
 return v;
}
function positive(out,label){
 assert.equal(out.status,0,label+' status='+out.status+' stderr='+out.stderr.slice(0,200));
 assert.equal(out.stderr.trim(),'');
 return JSON.parse(out.stdout);
}
function denied(out,label){
 assert.notEqual(out.status,0,label);
 assert.equal(out.stdout.trim(),'','partial stdout on negative '+label);
 assert.match(out.stderr,/^LOCAL_RUST_V1_DENIED:[A-Z_]+/,label);
 for(const secret of ['NEVER_ECHO_ROOT_A01','NEVER_ECHO_PLAYER_B02','NEVER_ECHO_NATIVE_LAYOUT_D04','NEVER_ECHO_MOD_F06'])
   assert.ok(!out.stderr.includes(secret),label+' must not print values');
}
const original=fixture();
const dev=invoke(original),out=positive(dev,'17 DEV typed records');
const x=out.savedDiffGridsTypedRead;
assert.ok(x,'explicit-only receipt');
assert.equal(x.contract,'wand.dev.stored-diffgrids-typed-read-only@1');
for(const key of ['enabledOnlyByExplicitDevCliArg','exactExternalSteamFullVersion',
 'singleProductSessionScopeValidated','sessionIdMatchedCore','decodedShaMatchedCore','fullDocumentValidated'])
 assert.equal(x[key],true,key);
assert.deepEqual([x.revision,x.indexGeneration,x.indexedGridRecords,x.typedPages,
 x.maximumGridRecordsInPage,x.modifiedObjectRecords,x.removedObjectRecords,
 x.modifiedRemovedSameIdPairs,x.savedGridIdZeroRecords,x.savedDefaultLayoutIdZeroRecords,
 x.storedLayoutPathValues,x.storedLayoutTypeValues,x.storedGridHashValues,
 x.storedGridDataHashValues,x.unresolvedExternalLayoutRecords,x.consumedCursorReplayDenials],
 [0,1,17,3,8,34,52,34,1,1,17,17,17,17,17,3]);
assert.equal(x.externalLayoutStatus,'UNRESOLVED_EXTERNAL_LAYOUT');
for(const key of ['nativeEffectiveGridVerified','allNativeReferencesVerified','productReadAccepted',
 'nativeV3Verified','writerAuthorized','editedCopyAuthorized','applyAuthorized','originalModified'])
 assert.equal(x[key],false,key);
for(const key of ['allNativeReferencesVerified','productReadAccepted','writerAuthorized',
 'editedCopyAuthorized','applyAuthorized','cloudUploadPerformed','originalModified',
 'physicalGameInstallCryptographicallyProven'])assert.equal(out[key],false,key);
assert.equal('nativeAreaGridSlice' in out,false);
assert.equal('originalBytesSuppliedSeparately' in out,false,'no private original size in DEV');
for(const needle of ['NEVER_ECHO_ROOT_A01','NEVER_ECHO_PLAYER_B02','NEVER_ECHO_UNKNOWN_C03',
 'NEVER_ECHO_NATIVE_LAYOUT_D04','NEVER_ECHO_ASSEMBLY_E05','NEVER_ECHO_MOD_F06',
 'NEVER_ECHO_DIFF_G07','"session_id"','"decoded_sha256"','"gridId"',
 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'])
 assert.ok(!dev.stdout.includes(needle)&&!dev.stderr.includes(needle),'private-like data leak '+needle);
const legacy=positive(invoke(original,[]),'noarg legacy');
const area=positive(invoke(original,['--native-area-grid-slice-only']),'AreaGrid legacy');
assert.equal('savedDiffGridsTypedRead' in legacy,false);
assert.equal('savedDiffGridsTypedRead' in area,false);
assert.equal('nativeAreaGridSlice' in legacy,false);
assert.deepEqual([
 area.nativeAreaGridSlice.villageRecords,area.nativeAreaGridSlice.areaRecords,
 area.nativeAreaGridSlice.gridRecords,area.nativeAreaGridSlice.directAreaGridLinks,
 area.nativeAreaGridSlice.gridObjectIdentityRecords],[1,1,1,1,1]);
assert.equal(area.nativeAreaGridSlice.nativeV3Verified,false);
assert.equal(legacy.originalBytesSuppliedSeparately,1680);
assert.equal(area.originalBytesSuppliedSeparately,1680);
for(const [k,v] of Object.entries(legacy)){
 if(k!=='originalBytesSuppliedSeparately')assert.deepEqual(out[k],v,'new opt-in must not change old root field '+k);
 assert.deepEqual(area[k],v,'old AreaGrid root regression '+k);
}
for(const [n,pages,maxPage] of [[0,1,0],[1,1,1],[9,2,8]]){
 const r=positive(invoke(fixture(n)),'bounded pages '+n).savedDiffGridsTypedRead;
 assert.deepEqual([r.indexedGridRecords,r.typedPages,r.maximumGridRecordsInPage,
  r.consumedCursorReplayDenials],[n,pages,maxPage,pages]);
 assert.equal(r.productReadAccepted,false);
}
const pairs=fixture(0);
for(let i=1;i<=14;i++)pairs.World.GridCollection.DiffGrids[i]={
 ID:i,ModifiedObjects:{'3':{ID:3},'4':{ID:4},'5':{ID:5},'6':{ID:6}},RemovedObjects:[3,4,5,6]};
const overlap=positive(invoke(pairs),'14x4 saved overlap').savedDiffGridsTypedRead;
assert.equal(overlap.indexedGridRecords,14);
assert.equal(overlap.modifiedRemovedSameIdPairs,56);
assert.equal(overlap.nativeEffectiveGridVerified,false);
for(const [name,args] of [
 ['mixedAreaAndTyped',['--native-area-grid-slice-only',...flags]],
 ['mixedWriter',[...flags,'--writer']],['duplicateTyped',[...flags,...flags]],
 ['badWriter',['--native-v3-writer']],['unknownFlag',['--not-supported']]
])denied(invoke(original,args),name);
for(const [name,extra] of [
 ['SwitchBuild',{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}],
 ['wrongSteamFullVersion',{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-OTHER'}],
 ['decodedSHAMismatch',{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
 ['originalSHAZero',{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)}],
 ['originalSHAFormat',{WAND_LOCAL_ORIGINAL_SHA256:'A'.repeat(64)}],
 ['missingSteamBuild',{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:''}],
 ['originalZeroSize',{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'0'}],
 ['oversizeOriginal',{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'}]
])denied(invoke(original,flags,extra),name);
for(const [name,change] of [
 ['schema624',o=>o.GameInfo.Version=624],
 ['forgedGridID',o=>o.World.GridCollection.DiffGrids['0'].ID=99],
 ['forgedObjectID',o=>o.World.GridCollection.DiffGrids['0'].ModifiedObjects['3'].ID=99],
 ['defaultIDString',o=>o.World.GridCollection.DiffGrids['0'].DefaultLayoutGridID='0'],
 ['hashString',o=>o.World.GridCollection.DiffGrids['0'].DefaultGridHashCode='-4'],
 ['removedString',o=>o.World.GridCollection.DiffGrids['0'].RemovedObjects=['3']],
 ['removedNull',o=>o.World.GridCollection.DiffGrids['0'].RemovedObjects=null],
 ['absentDiffGrids',o=>delete o.World.GridCollection.DiffGrids],
 ['nullDiffGrids',o=>o.World.GridCollection.DiffGrids=null],
 ['pathWrongType',o=>o.World.GridCollection.DiffGrids['0'].GridDefaultLayoutPath=47],
 ['pathOverBound',o=>o.World.GridCollection.DiffGrids['0'].GridDefaultLayoutPath='x'.repeat(5000)]
]){
 const x=structuredClone(original);change(x);denied(invoke(x),name);
}
denied(invoke('{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"1":{"ID":1},"1":{"ID":1}}}}}'),'duplicateJSONkey');
console.log('QA05QRC886_DEV_TYPED_NATIVE_CLI_UNCHANGED_NOARG_AREA_REPLAY_SAFEGUARDS_NO_PRIVATE_PASS');
