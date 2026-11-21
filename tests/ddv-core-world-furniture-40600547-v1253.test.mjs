import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 FURNITURE_40600547_ID,FURNITURE_40600547_BUILD,FURNITURE_40600547_OLD,FURNITURE_40600547_NEW,
 classifyFurniture40600547DefinitionV1253
} from '../src/lib/ddv/core/world/furniture-40600547-placement-boundary-v1253.js';
const source={...FURNITURE_40600547_BUILD};
const record=()=>({source,itemId:FURNITURE_40600547_ID,recordSha256:FURNITURE_40600547_NEW.recordSha256,gridArea:{SizeX:1,SizeY:1,Layers:[66]}});
const hard=x=>{for(const k of ['persistentWriteAuthorized','WORLD_PERSISTENT_WRITE_V125','PERSISTENT_WRITE','productApplyAuthorized','directSourceReplacementAuthorized','nativeWriterAuthorized'])assert.equal(x[k],false,k);};
test('only ID 40600547 recognizes exact typed Switch v1.25.3 GridArea',()=>{
 const r=classifyFurniture40600547DefinitionV1253(record());
 assert.equal(r.status,'STATIC_DELTA_CONFIRMED_NATIVE_PENDING');
 assert.equal(r.currentNativePlacementValidity,'UNKNOWN');
 assert.equal(r.mayAuthorizePlacement,false);assert.equal(r.mayAuthorizeMutation,false);hard(r);
 assert.deepEqual(r.oldGridArea,{SizeX:2,SizeY:2,Layers:[4,68,4,68]});
 assert.deepEqual(r.newGridArea,{SizeX:1,SizeY:1,Layers:[66]});
});
test('wrong version, record or grid-area masks cannot silently authorize placement',()=>{
 const f=record();
 const candidates=[
  {...f,source:{...source,gameVersion:'1.25.0',buildIdentity:'52BD625D9B4E0053',profileSchemaVersion:624}},
  {...f,source:{...source,platform:'SteamWindows'}},
  {...f,source:{...source,buildIdentity:'0'}},
  {...f,recordSha256:FURNITURE_40600547_OLD.recordSha256},
  {...f,gridArea:{SizeX:2,SizeY:2,Layers:[4,68,4,68]}},
  {...f,gridArea:{SizeX:1,SizeY:1,Layers:[4]}},
 ];
 for(const c of candidates){const r=classifyFurniture40600547DefinitionV1253(c);assert.notEqual(r.status,'STATIC_DELTA_CONFIRMED_NATIVE_PENDING');assert.equal(r.mayAuthorizePlacement,false);hard(r);}
 assert.equal(classifyFurniture40600547DefinitionV1253({...f,itemId:40600548}).status,'OUT_OF_SCOPE');
});
test('versioned machine evidence independently pins 6.1/6.2/6.3 typed and no native proof',async()=>{
 const m=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25.3/furniture-40600547-placement-boundary-v1253.json',import.meta.url),'utf8'));
 assert.equal(m.target.itemId,FURNITURE_40600547_ID);
 assert.deepEqual(m.typedDecode.paths.map(x=>x.name),['GridAreaData.SizeX','GridAreaData.SizeY','GridAreaData.Layers']);
 assert.deepEqual(m.typedDecode.paths.map(x=>x.before),[2,2,[4,68,4,68]]);
 assert.deepEqual(m.typedDecode.paths.map(x=>x.after),[1,1,[66]]);
 assert.equal(m.sources.switch1253Furniture.recordSha256,FURNITURE_40600547_NEW.recordSha256);
 assert.ok(m.runtimeUnknowns.length>0);assert.equal(m.downstreamContract.fallback,'NATIVE_UNKNOWN_UNVERIFIED / APPLY_DISABLED');hard(m.hardFlags);
});

test('baseline v1.25 placement comparator distinguishes old and new exclusive layer masks without certifying v1.25.3 native',async()=>{
  await import('../src/lib/ddv/core/world/runtime-v125/placement-v125.js');
  const api=globalThis.DdvCoreWorldV125Placement;
  assert.equal(typeof api?.layersCollide,'function');
  const old=FURNITURE_40600547_OLD.gridArea.Layers;
  const newer=FURNITURE_40600547_NEW.gridArea.Layers;
  assert.deepEqual(old.map(v=>v&api.EXCLUSIVE),[4,4,4,4]);
  assert.deepEqual(newer.map(v=>v&api.EXCLUSIVE),[2]);
  assert.equal(api.layersCollide(68,66),false);
  assert.equal(api.layersCollide(66,66),true);
  const raw=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25.3/furniture-40600547-placement-boundary-v1253.json',import.meta.url),'utf8'));
  assert.equal(raw.baselineCollisionComparison.evidence.includes('HYPOTHESIS only for v1.25.3'),true);
  assert.equal(raw.downstreamContract.fallback,'NATIVE_UNKNOWN_UNVERIFIED / APPLY_DISABLED');
});
