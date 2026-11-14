import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  WORLD_ADAPTER_V16_SOURCE_SHA256,
  WORLD_DIRECT_ROOT_EDITOR_DOCUMENT_V116_SHA256,
  WORLD_GRIDDATA_DIMENSIONS_V125_SHA256,
  WORLD_READ_SWITCH_V125_SHA256,
  WORLD_ROLE_AUTHORITY_V125_SHA256,
  createSwitchWorldReadAdapter,
  projectSwitchAreaGrid,
  projectSwitchFloatingIslandGrid
} from '../src/lib/wep/world-browser-adapter.ts';
import { openWorldSaveBytes } from '../src/lib/wep/world-save-source.ts';

const root = new URL('../', import.meta.url);

async function repoFile(path) {
  return new Uint8Array(await readFile(new URL(path, root)));
}

async function localFetch(url) {
  const pathname = new URL(String(url), 'https://wand.invalid').pathname;
  const bytes = await repoFile(`./static${pathname}`);
  return new Response(bytes, { status: 200 });
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const profile = {
  GameInfo: {
    Version: 624,
    InitialVersion: 624,
    LastSaveDeviceInfo: { deviceType: 'DeviceType_Switch' }
  },
  Player: {},
  World: {
    GridCollection: {
      Grids: {
        '10': {
          ID: 10,
          GridDataPath: 'GridData/Villages/Village04-BeachLevel-GridData.json',
          GridDefaultLayoutPath: '',
          TessellationFactor: 1,
          NextGridObjectID: 101,
          Objects: {
            '100': {
              ID: 100,
              ItemID: 40000047,
              X: 2,
              Y: 3,
              Orientation: 'GridOrientation_Up',
              State: {}
            }
          }
        }
      }
    },
    Villages: [
      {
        Areas: {
          '7': {
            GridIDs: [10],
            Unlocked: true,
            EnvironmentEffectItemID: 0,
            EnvironmentEffectOrientation: 'GridOrientation_Up'
          }
        }
      }
    ]
  }
};


import { projectSwitchFloatingIslandGrid as oldProject } from '../src/lib/wep/qa615-parent-adapter.ts';
test('independent parent/fixed raw browser consumer graph witness',async()=>{
 const fixture=JSON.parse(new TextDecoder().decode(await repoFile('./tests/fixtures/ddv-world/core-world-v125-observed-fixture.json')));
 const parent=fixture.profile.World.GridCollection.Grids['5'].Objects['13802'],child=fixture.profile.World.GridCollection.Grids['1395'];
 const obj=(id,g)=>({...structuredClone(parent),ID:id,State:{SubGrid:{GridID:g,DesignID:null}}});
 const grid=(id,objects)=>({...structuredClone(child),ID:id,Objects:objects,NextGridObjectID:Math.max(0,...Object.keys(objects).map(Number))+1});
 const binding=await createSwitchWorldReadAdapter({basePath:'',fetchImpl:localFetch});
 const cases=[
 ['three-sibling-empty',{'1':obj(1,910001),'2':obj(2,910002),'3':obj(3,910001)},{'910001':grid(910001,{}),'910002':grid(910002,{})},'alias'],
 ['ancestor-depth-asymmetric',{'1':obj(1,910001),'2':obj(2,910002)},{'910001':grid(910001,{'1':obj(1,910003)}),'910002':grid(910002,{'1':obj(1,910004)}),'910003':grid(910003,{}),'910004':grid(910004,{'1':obj(1,910003)})},'alias'],
 ['unique-single',{'1':obj(1,910001)},{'910001':grid(910001,{})},'ok'],
 ['unique-asymmetric',{'1':obj(1,910001),'2':obj(2,910002)},{'910001':grid(910001,{'1':obj(1,910003)}),'910002':grid(910002,{}),'910003':grid(910003,{'1':obj(1,910004)}),'910004':grid(910004,{})},'ok'],
 ['cycle',{'1':obj(1,910001)},{'910001':grid(910001,{'1':obj(1,910002)}),'910002':grid(910002,{'1':obj(1,910001)})},'cycle']];
 for(const [name,roots,children,kind] of cases){
 const raw=structuredClone(profile);Object.assign(raw.World.GridCollection.Grids,children,{'760':{ID:760,GridDataPath:'GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json',GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:4,Objects:roots}});raw.World.FloatingIslands={'1540000147':{SceneItemId:1540000147,GridIDs:[760],Unlocked:true,CustomLocationPositionsPath:'SceneLayouts/FloatingIslands/FloatingIsland_Urban/CustomLocations.json'}};
 const opened=await openWorldSaveBytes(new TextEncoder().encode(JSON.stringify(raw)),{sourcePlatform:'switch'}),island=opened.floatingIslands.find(x=>x.sceneItemId===1540000147),before=JSON.stringify(opened.profile);assert.ok(island);
 const args=[opened,island,island.roots[0],binding];
 if(kind==='alias'){const old=oldProject(...args);assert.equal(old.target.persistentWriteAuthorized,false);assert.throws(()=>projectSwitchFloatingIslandGrid(...args),/WEP_WORLD_DIRECT_ROOT_SUBGRID_DUPLICATE_PARENT/);}
 else if(kind==='cycle'){assert.throws(()=>oldProject(...args),/CYCLE/);assert.throws(()=>projectSwitchFloatingIslandGrid(...args),/CYCLE/);}
 else {const old=oldProject(...args),fixed=projectSwitchFloatingIslandGrid(...args);assert.deepEqual(fixed,old);assert.equal(fixed.target.persistentWriteAuthorized,false);assert.equal(fixed.capabilities.worldPersistentWrite,'unsupported');}
 assert.equal(JSON.stringify(opened.profile),before);console.log('QA615_CAUSAL',name,kind);
 }
});
