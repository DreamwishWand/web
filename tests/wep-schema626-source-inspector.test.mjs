import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  openWorldSaveBytes,
  WEP_WORLD_READONLY_626_PROVENANCE
} from '../src/lib/wep/world-save-source.ts';
import {
  bind626SourceInspector, inspect626BoundObject, page626BoundObjects
} from '../src/lib/wep/schema626-source-inspector.ts';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';
import { WORLD_READONLY_COPY_LOCALES, worldReadonlyCopy } from '../src/lib/wep/world-readonly-copy.js';

const BID='9A239D3DB569756D';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceOptions={
  sourcePlatform:'switch',
  targetBuild:{platform:'switch',kind:'switch-bid',value:BID},
  sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
};
const native=(id,x=2,y=3,item=40000047,child=null)=>({
  ID:id,ItemID:item,X:x,Y:y,Orientation:'GridOrientation_Up',
  State:child===null?null:{SubGrid:{GridID:child,DesignID:null}}
});
const grid=(id,objects)=>({
  ID:id,GridDataPath:'GridData/Test-626.json',TessellationFactor:2,
  Objects:objects
});
const original=()=>({
  GameInfo:{Version:626,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'Synthetic'},
  World:{
    Villages:[{Areas:{'7':{GridIDs:[42],Unlocked:true}}}],
    GridCollection:{
      Grids:{
        '42':grid(42,{'7':native(7,2,3,40000047,43),'8':native(8,9,3,40000048)}),
        '43':grid(43,{'9':native(9,0,1,40000049)})
      },
      DiffGrids:{}
    }
  }
});
const open=async profile=>{
  const bytes=makeSyntheticP1gProfile(profile);
  const hashed=sha(bytes);
  const opened=await openWorldSaveBytes(bytes,sourceOptions);
  return {bytes,sha:hashed,opened,scope:bind626SourceInspector(opened,hashed,1,BID)};
};
const exact=(f,gridId=42,id=7,session=f.opened,sourceSha=f.sha,epoch=1)=>
  inspect626BoundObject(f.scope,session,sourceSha,epoch,gridId,id);

test('626 encrypted packaged synthetic P1G raw Area/Root/SubGrid IDs have exact source inspect, no geometry',async()=>{
 const f=await open(original());
 assert.equal(f.scope.index.version.schema,626);
 assert.equal(f.scope.index.geometryFor2d,'NOT_VERIFIED');
 assert.deepEqual(f.scope.acceptedRootGridIds,[42]);
 const root=exact(f);
 assert.equal(root.editorId,'g42:o7');
 assert.equal(root.itemId,40000047);
 assert.deepEqual([root.serializedGridLocalX,root.serializedGridLocalY],[2,3]);
 assert.equal(root.relation,'AREA_ROOT');
 assert.equal(root.parentEditorId,null);
 assert.equal(root.geometryFor2d,'NOT_VERIFIED');
 assert.equal(root.nativePlacementVerified,false);
 assert.equal(root.trustedCoreRevision,false);
 assert.equal(root.persistentWriteAuthorized,false);
 const child=exact(f,43,9);
 assert.equal(child.editorId,'g43:o9');
 assert.equal(child.relation,'SUBGRID_CHILD');
 assert.equal(child.parentEditorId,'g42:o7');
 assert.deepEqual([child.serializedGridLocalX,child.serializedGridLocalY],[0,1]);
 assert.equal(sha(f.bytes),f.sha,'P1G ciphertext unchanged');
});

test('same signed UI epoch without same opened local source instance cannot reuse old native object',async()=>{
 const f=await open(original());
 const other=await open(original());
 assert.throws(()=>exact(f,42,7,other.opened),/STALE_SOURCE_OR_SESSION/);
 assert.throws(()=>exact(f,42,7,f.opened,'b'.repeat(64)),/STALE_SOURCE_OR_SESSION/);
 assert.throws(()=>exact(f,42,7,f.opened,f.sha,2),/STALE_SOURCE_OR_SESSION/);
 const replacement=original();replacement.World.GridCollection.Grids['42'].Objects['7'].X=90;
 const newer=await open(replacement);
 assert.equal(exact(newer).serializedGridLocalX,90);
 assert.equal(exact(f).serializedGridLocalX,2);
});

test('raw mutable profile after binding cannot grant a forged native ID or changed coordinates',async()=>{
 const f=await open(original());
 f.opened.profile.World.GridCollection.Grids['42'].Objects['7'].X=999;
 assert.throws(()=>exact(f),/RAW_SOURCE_CHANGED/);
 f.opened.profile.World.GridCollection.Grids['42'].Objects['7'].X=2;
 f.opened.profile.World.GridCollection.Grids['42'].Objects['999']=native(999);
 assert.throws(()=>exact(f,42,999),/SOURCE_OBJECT_NOT_FOUND/);
});

test('source index wrong/duplicate native map and DiffGrid conflict fail closed',async()=>{
 const dup=original();dup.World.GridCollection.Grids['42'].Objects['7'].ID=8;
 const a=await open(dup);
 assert.throws(()=>exact(a),/SOURCE_OBJECT_NOT_FOUND/);
 const conflict=original();conflict.World.GridCollection.DiffGrids['42']={ID:42};
 const b=await open(conflict);
 assert.throws(()=>exact(b),/GRID_REFERENCE_UNRESOLVED/);
 assert.equal(b.scope.geometryFor2d,'NOT_VERIFIED');
});

test('unknown grid, unresolved route, noncanonical input, incomplete parent cannot become 626 inspector',async()=>{
 const f=await open(original());
 for(const key of ['01','-1','1e2','1.0','g42:o7','']) {
  assert.throws(()=>exact(f,key,7),/CANONICAL_ADDRESS_REQUIRED/);
 }
 assert.throws(()=>exact(f,444,7),/SOURCE_OBJECT_NOT_FOUND/);
 const p=original();p.World.Villages[0].Areas['7'].GridIDs=[];
 const missing=await open(p);
 assert.throws(()=>exact(missing),/GRID_REFERENCE_UNRESOLVED/);
});

test('page lists source-minted IDs and limits output without exposing unverified child geometry',async()=>{
 const f=await open(original());
 const page=page626BoundObjects(f.scope,f.opened,f.sha,1,'42');
 assert.deepEqual(page.items.map(x=>x.editorId),['g42:o7','g42:o8']);
 assert.equal(page.totalCandidates,2);
 assert.equal(page.nextOffset,null);
 assert.equal(page.geometryFor2d,'NOT_VERIFIED');
 assert.throws(()=>page626BoundObjects(f.scope,f.opened,f.sha,1,'42',0,26),/PAGE_BOUNDS/);
 assert.throws(()=>page626BoundObjects(f.scope,f.opened,f.sha,1,'42',-1,2),/PAGE_BOUNDS/);
 assert.throws(()=>page626BoundObjects(f.scope,f.opened,f.sha,1,'999'),/GRID_UNKNOWN/);
});

test('schema624/incorrect external BID/source metadata never borrow schema626 inspector capability',async()=>{
 const f=await open(original());
 assert.throws(()=>bind626SourceInspector(f.opened,f.sha,1,'52BD625D9B4E0053'),/EXACT_READONLY_SOURCE_REQUIRED/);
 assert.throws(()=>bind626SourceInspector(f.opened,'not-a-sha',1,BID),/SOURCE_SCOPE_REQUIRED/);
 const cloned={...f.opened,profileSchemaVersion:624};
 assert.throws(()=>bind626SourceInspector(cloned,f.sha,1,BID),/EXACT_READONLY_SOURCE_REQUIRED/);
 const json={...f.opened,inputFormat:'plain-json'};
 assert.throws(()=>bind626SourceInspector(json,f.sha,1,BID),/EXACT_READONLY_SOURCE_REQUIRED/);
});

test('8 locales mark source-only/geometry-not-verified and no editor/persistent capability',()=>{
 assert.deepEqual([...WORLD_READONLY_COPY_LOCALES].sort(),['de','en','es-ES','fr','it','ja','pt-BR','zh-CN'].sort());
 for(const loc of WORLD_READONLY_COPY_LOCALES){
  const copy=worldReadonlyCopy(loc);
  for(const field of ['sourceInspectorTitle','sourceInspectorHint','sourceGridId','sourceObjectId','sourceInspect','sourceGeometryWarning','sourceNoResults','sourceItemId','sourceGridLocal','sourceParent']){
    assert.ok(typeof copy[field]==='string'&&copy[field].length>2,loc+':'+field);
  }
 }
});
