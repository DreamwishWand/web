// 05 QR-C / PR807 independent native-only CLI verification.
// PUBLIC SYNTHETIC JSON. Never read/send owner's encrypted or decrypted Save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const exe=process.env.QRC807_NATIVE_V1;
const ready=Boolean(exe);
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=()=>({
  GameInfo:{Version:626},
  Player:{SyntheticField:'🍀'},
  World:{
    Villages:[{Areas:{
      '1':{GridIDs:[7,8],Future:{any:'untouched'}},
      '3':{GridIDs:[]}
    }},{Areas:{'2':{GridIDs:[8]}}}],
    GridCollection:{Grids:{
      '7':{ID:7,Objects:{'4':{ID:4,ItemID:100}}},
      '8':{ID:8,Objects:{'4':{ID:4},'5':{ID:5,Opaque:'preserve'}}}
    }},
    Extension:{future:['unknown',null,{'🌱':'retained'}]}
  },
  Opaque:{Untouched:'not a native reference'}
});
const call=(v=fixture(),args=['--native-area-grid-slice-only'],extra={})=>{
 const decoded=Buffer.from(typeof v==='string'?v:JSON.stringify(v),'utf8');
 const env={...process.env,
    WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:STEAM,
    WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64), // fabricated public synthetic claim, never real P1G
    WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
    WAND_LOCAL_DECODED_SHA256:sha(decoded),...extra
 };
 return spawnSync(resolve(exe),args,{input:decoded,env,
    encoding:null,timeout:40000,maxBuffer:1024*1024});
};
const u=x=>x.toString('utf8');
function denied(r,label){
 assert.notEqual(r.status,0,label);
 assert.equal(r.stdout.length,0,label+' failure stdout must not disclose content');
 assert.match(u(r.stderr),/^LOCAL_RUST_V1_DENIED:/,label);
 assert.ok(r.stderr.length<260,label+' stderr must contain only bounded deny code');
}
test('QRC807 focused CI native Rust binary required', {skip:ready?false:'binary missing: NOT_RUN'},()=>{
 assert.ok(exe?.length>0);
});
test('QRC807 direct 2-village 3-Area multi-Grid links with unknown retention and no authority',
 {skip:!ready},()=>{
 const r=call();
 assert.equal(r.status,0,u(r.stderr).slice(0,220));
 assert.equal(r.stderr.length,0);
 const receipt=JSON.parse(u(r.stdout));
 assert.deepEqual([
   receipt.nativeAreaGridSlice.villageRecords,
   receipt.nativeAreaGridSlice.areaRecords,
   receipt.nativeAreaGridSlice.gridRecords,
   receipt.nativeAreaGridSlice.directAreaGridLinks,
   receipt.nativeAreaGridSlice.gridObjectIdentityRecords
 ],[2,3,2,3,3]);
 for(const k of ['writerAuthorized','applyAuthorized','productReadAccepted','editedCopyAuthorized',
                  'allNativeReferencesVerified','physicalGameInstallCryptographicallyProven'])
  assert.equal(receipt[k],false,k);
 for(const k of ['fullNativeReferenceClosureVerified','areaGroupFootprintVerified',
                  'nativeV3Verified','productReadAccepted','writerAuthorized'])
  assert.equal(receipt.nativeAreaGridSlice[k],false,k);
 assert.equal(receipt.coreOwnedIndexedPlayerFields,1);
 assert.equal(receipt.coreOwnedIndexedWorldFields,3);
 for(const needle of ['Untouched','Future','🌱',sha(Buffer.from(JSON.stringify(fixture())))])
  assert.ok(!u(r.stdout).includes(needle),'no raw extension/hash in native Slice output');
});
test('QRC807 native validator rejects malformed links/duplicates/IDs with no stdout',
 {skip:!ready},()=>{
 const cases=[];
 const f=(name,mut)=>{let x=fixture();mut(x);cases.push([name,x]);};
 f('orphan',x=>x.World.Villages[0].Areas['1'].GridIDs.push(999));
 f('duplicate',x=>x.World.Villages[0].Areas['1'].GridIDs.push(7));
 f('GridID string',x=>x.World.Villages[0].Areas['1'].GridIDs=['7']);
 f('GridID unsafe',x=>x.World.Villages[0].Areas['1'].GridIDs=[9007199254740992]);
 f('GridID negative',x=>x.World.Villages[0].Areas['1'].GridIDs=[-1]);
 f('wrong Grids shape',x=>x.World.GridCollection.Grids=[]);
 f('missing Grids',x=>delete x.World.GridCollection.Grids);
 f('null Villages',x=>x.World.Villages=null);
 f('bad Areas type',x=>x.World.Villages[0].Areas=[]);
 f('missing Area GridIDs',x=>delete x.World.Villages[0].Areas['1'].GridIDs);
 f('Grid key ID mismatch',x=>x.World.GridCollection.Grids['7'].ID=9);
 f('Object key ID mismatch',x=>x.World.GridCollection.Grids['7'].Objects['4'].ID=9);
 f('noncanonical Grid alias',x=>x.World.GridCollection.Grids['07']={ID:7});
 f('noncanonical Object alias',x=>x.World.GridCollection.Grids['7'].Objects['04']={ID:4});
 f('noncanonical Area key',x=>x.World.Villages[0].Areas['01']={GridIDs:[7]});
 for(const [name,x] of cases)denied(call(x),name);
});
test('QRC807 rejects forged Build/Source SHA/Schema and arbitrary UI cursor/action',
 {skip:!ready},()=>{
 const v=fixture();
 for(const [name,args,extra,doc] of [
  ['unknown Steam',undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'UNKNOWN'},v],
  ['Switch BID mistaken for Steam',undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'},v],
  ['Steam FullVersion suffix',undefined,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:STEAM+'-bad'},v],
  ['decoded SHA mismatch',undefined,{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)},v],
  ['zero original SHA',undefined,{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)},v],
  ['oversize external claim',undefined,{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'},v],
  ['unrecognized cursor flag',['--native-area-grid-slice-only','--cursor','bad'],{},v],
  ['unrecognized writer flag',['--native-v3-writer'],{},v],
  ['no operation plus garbage',['--native-area-grid-slice-only','--apply'],{},v],
  ['schema624',undefined,{},JSON.stringify({...v,GameInfo:{Version:624}})],
  ['duplicate root',undefined,{},'{"GameInfo":{"Version":626},"Player":{},"World":{},"World":{}}']
 ])denied(call(doc,args,extra),name);
});
