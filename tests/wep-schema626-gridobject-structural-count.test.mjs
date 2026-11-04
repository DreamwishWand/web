import test from 'node:test';
import assert from 'node:assert/strict';
import {openWorldSaveBytes,WEP_WORLD_READONLY_626_PROVENANCE} from '../src/lib/wep/world-save-source.ts';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';

// SOURCE-SYNTHETIC only. This counts serialized Objects map entries and
// NEVER turns Native 626 geometry, default layout, DiffGrid or Writer ON.
const accepted={
 sourcePlatform:'switch',
 targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},
 sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
};
const profile=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},World:{
   Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
   GridCollection:{Grids:{
     '10':{ID:10,Objects:{'42':{State:{}},'43':{State:{}}}},
     '11':{ID:11,Objects:{'44':{State:{}}}}
   },DiffGrids:{}}
 }
});
test('626 real-route packaged synthetic source surfaces original GridObject entries as a nonsemantic count',async()=>{
 const p=profile(),bytes=makeSyntheticP1gProfile(p),original=bytes.slice();
 const result=await openWorldSaveBytes(bytes,accepted);
 assert.equal(result.profileSchemaVersion,626);
 assert.equal(result.structuralDiagnostics?.gridRecordCount,2);
 assert.equal(result.structuralDiagnostics?.gridObjectEntryCount,3);
 assert.equal(result.compatibility.readOnly,true);
 assert.equal(result.compatibility.routesAuthorized,false);
 assert.equal(result.compatibility.persistentWriteAuthorized,false);
 assert.equal(result.compatibility.productApplyAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('0 is valid only for present actual empty Objects maps, never for missing grids',async()=>{
 const p=profile();
 p.World.GridCollection.Grids['10'].Objects={};
 p.World.GridCollection.Grids['11'].Objects={};
 const result=await openWorldSaveBytes(makeSyntheticP1gProfile(p),accepted);
 assert.equal(result.structuralDiagnostics?.gridObjectEntryCount,0);
 assert.equal(result.structuralDiagnostics?.gridRecordCount,2);
});
test('malformed/missing Grid Objects remain UNKNOWN or rejected, never silently zero',async()=>{
 const p=profile();
 delete p.World.GridCollection.Grids['11'].Objects;
 const check=await openWorldSaveBytes(makeSyntheticP1gProfile(p),accepted).catch(e=>e);
 if(check instanceof Error){
   assert.match(check.message,/STRUCTURAL|CONTRACT|INVALID|GRID|PROFILE/i);
 }else{
   assert.equal(check.structuralDiagnostics?.gridObjectEntryCount,null);
   assert.equal(check.compatibility.editingAuthorized,false);
 }
});
test('626 source count does not merge DiffGrids into invented effective Grid layout',async()=>{
 const p=profile();
 p.World.GridCollection.DiffGrids={'10':{ID:10,Objects:{'99':{State:{}}}}};
 const result=await openWorldSaveBytes(makeSyntheticP1gProfile(p),accepted);
 assert.equal(result.structuralDiagnostics?.gridObjectEntryCount,3);
 assert.equal(result.compatibility.persistentWriteAuthorized,false);
});
test('unknown source, absent external BID or plain 626 JSON never yields positive packaged count',async()=>{
 const p=profile();
 const raw=makeSyntheticP1gProfile(p);
 await assert.rejects(()=>openWorldSaveBytes(raw,{...accepted,sourcePlatform:'unknown'}),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
 await assert.rejects(()=>openWorldSaveBytes(raw,{...accepted,targetBuild:{...accepted.targetBuild,value:'0000000000000000'}}),/UNSUPPORTED_BUILD/);
 await assert.rejects(()=>openWorldSaveBytes(new TextEncoder().encode(JSON.stringify(p)),accepted),/PACKAGED_SOURCE_REQUIRED/);
});
