// 05 QR-C independently authored PR819 native CLI contract verification.
// Public synthetic JSON only; no Owner P1G, decode, path, keys or private hashes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const exe=process.env.QRC819_NATIVE_V1;
// Generic Node Verify has no native Rust binary: these four cases are explicitly SKIPPED there.
// The dedicated 05 QR-C workflow builds the actual binary and runs every case.
const steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sample=()=>({
 GameInfo:{Version:626}, Player:{PrivateSyntheticSentinel:'DO_NOT_ECHO_ISLAND_FUTURE'},
 World:{
   Villages:[{Areas:{'1':{GridIDs:[7]}}},{Areas:{'2':{GridIDs:[10]}}}],
   FloatingIslands:{
      '1540000147':{SceneItemId:1540000147,GridIDs:[8],Future:{canary:'DO_NOT_ECHO_SECRET'}},
      '1540000148':{SceneItemId:1540000148,GridIDs:[9]}
   },
   GridCollection:{Grids:{
     '7':{ID:7,Objects:{'4':{ID:4}}},
     '8':{ID:8,Objects:{'4':{ID:4}}},
     '9':{ID:9,Objects:{}},
     '10':{ID:10,Objects:{'5':{ID:5}}}
   }},
   Future:{PrivateSyntheticSentinel:'KEEP_UNKNOWN_EXTENSION'}
 }
});
function call(value=sample(),args=['--native-area-grid-slice-only'],additional={}){
 const decoded=Buffer.from(typeof value==='string'?value:JSON.stringify(value),'utf8');
 return spawnSync(resolve(exe),args,{
   input:decoded,encoding:'utf8',timeout:40000,maxBuffer:1024*1024,
   env:{...process.env,
      WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:steam,
      WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
      WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
      WAND_LOCAL_DECODED_SHA256:sha(decoded),...additional
   }
 });
}
function success(r,msg){
 assert.equal(r.status,0,msg+': '+r.stderr.slice(0,180));
 assert.equal(r.stderr,'',msg+' must not log data on success');
 return JSON.parse(r.stdout);
}
function denied(r,msg){
 assert.notEqual(r.status,0,msg);
 assert.equal(r.stdout,'',msg+' must not print partial native receipts');
 assert.match(r.stderr,/^LOCAL_RUST_V1_DENIED:/,msg);
 assert.ok(r.stderr.length<260,msg+' must not log source, tokens or private JSON');
}
function edit(fn){
 const v=sample();fn(v);return v;
}
test('QRC819 positive two-Island refs and counts, native read-only flags, no private echo',{skip:!exe},()=>{
 const v=sample();const out=success(call(v),'two islands');
 const r=out.nativeAreaGridSlice;
 assert.equal(r.floatingIslandMapPresent,true);
 assert.equal(r.floatingIslandRecords,2);
 assert.equal(r.floatingIslandDirectGridLinks,2);
 assert.equal(r.directRootOwnershipUnique,true);
 assert.deepEqual([r.villageRecords,r.areaRecords,r.gridRecords,r.directAreaGridLinks,
                   r.gridObjectIdentityRecords],[2,2,4,2,3]);
 for(const flag of ['fullNativeReferenceClosureVerified','areaGroupFootprintVerified',
     'nativeV3Verified','productReadAccepted','writerAuthorized'])
   assert.equal(r[flag],false,flag);
 for(const flag of ['allNativeReferencesVerified','physicalGameInstallCryptographicallyProven',
     'productReadAccepted','writerAuthorized','editedCopyAuthorized','applyAuthorized',
     'cloudUploadPerformed','originalModified'])
   assert.equal(out[flag],false,flag);
 for(const secret of ['DO_NOT_ECHO_ISLAND_FUTURE','DO_NOT_ECHO_SECRET','KEEP_UNKNOWN_EXTENSION','1540000147'])
   assert.ok(!JSON.stringify(out).includes(secret),'counts-only native response');
});
test('QRC819 missing island map UNKNOWN, empty map and zero-link island not Native usable proof',{skip:!exe},()=>{
 const missing=edit(v=>delete v.World.FloatingIslands);
 const a=success(call(missing),'missing map').nativeAreaGridSlice;
 assert.equal(a.floatingIslandMapPresent,false);
 assert.equal(a.directRootOwnershipUnique,false);
 assert.deepEqual([a.floatingIslandRecords,a.floatingIslandDirectGridLinks],[0,0]);
 assert.equal(a.fullNativeReferenceClosureVerified,false);
 const empty=edit(v=>{v.World.FloatingIslands={};});
 const b=success(call(empty),'empty map').nativeAreaGridSlice;
 assert.equal(b.floatingIslandMapPresent,true);
 assert.equal(b.directRootOwnershipUnique,true);
 assert.deepEqual([b.floatingIslandRecords,b.floatingIslandDirectGridLinks],[0,0]);
 const locked=edit(v=>{v.World.FloatingIslands={'1540000147':{SceneItemId:1540000147,GridIDs:[]}}});
 const c=success(call(locked),'empty locked island').nativeAreaGridSlice;
 assert.equal(c.floatingIslandRecords,1);
 assert.equal(c.floatingIslandDirectGridLinks,0);
 assert.equal(c.writerAuthorized,false);
 const defaultCli=success(call(sample(),[]),'default native V1');
 assert.equal('nativeAreaGridSlice' in defaultCli,false,'explicit opt-in necessary');
});
test('QRC819 malformed Island GridIDs, Scene ID, root owner aliases deny with no data',{skip:!exe},()=>{
 const cases=[
 ['orphan',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=[999]})],
 ['duplicate Island',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=[8,8]})],
 ['same Grid in other Island',edit(v=>{v.World.FloatingIslands['1540000148'].GridIDs=[8]})],
 ['Island grid alias Area',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=[7]})],
 ['duplicate across Village Area',edit(v=>{v.World.Villages[1].Areas['2'].GridIDs=[7]})],
 ['noncanonical Island key',edit(v=>{v.World.FloatingIslands['01540000147']={SceneItemId:1540000147,GridIDs:[]}})],
 ['Island key zero',edit(v=>{v.World.FloatingIslands['0']={SceneItemId:0,GridIDs:[]}})],
 ['Scene Item mismatch',edit(v=>{v.World.FloatingIslands['1540000147'].SceneItemId=1540000148})],
 ['Scene Item String',edit(v=>{v.World.FloatingIslands['1540000147'].SceneItemId='1540000147'})],
 ['missing Scene Item',edit(v=>{delete v.World.FloatingIslands['1540000147'].SceneItemId})],
 ['missing GridIDs',edit(v=>{delete v.World.FloatingIslands['1540000147'].GridIDs})],
 ['GridIDs null',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=null})],
 ['GridIDs object',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs={'8':true}})],
 ['GridIDs string',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=['8']})],
 ['GridIDs negative',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=[-1]})],
 ['GridIDs unsafe',edit(v=>{v.World.FloatingIslands['1540000147'].GridIDs=[9007199254740992]})],
 ['island map null',edit(v=>{v.World.FloatingIslands=null})],
 ['island map array',edit(v=>{v.World.FloatingIslands=[]})],
 ];
 for(const [name,val] of cases)denied(call(val),name);
});
test('QRC819 reject bad Steam registry, schema, SHA and untrusted CLI flag',{skip:!exe},()=>{
 const val=sample();
 for(const [name,doc,args,extra] of [
  ['schema624',edit(v=>{v.GameInfo.Version=624}),undefined,{}],
  ['Switch BID passed as Steam',val,undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}],
  ['wrong exact Build suffix',val,undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:steam+'-unknown'}],
  ['bad decoded source SHA',val,undefined,{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
  ['untrusted writer argument',val,['--native-v3-writer'],{}],
  ['untrusted fake cursor',val,['--native-area-grid-slice-only','--cursor','forge'],{}],
 ])denied(call(doc,args,extra),name);
});
