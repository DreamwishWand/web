import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const require=createRequire(import.meta.url);
const projectorApi=require('../static/ddv/core/world/v1.25/direct-root-editor-document-v125.cjs');
const locationApi=require('../static/ddv/core/world/v1.25/location-v125.cjs');
const worldApi=require('../static/ddv/core/world/v1.25/adapter-v125.cjs');

const contract=JSON.parse(readFileSync(new URL('../static/ddv/core/world/v1.25/direct-root-editor-document-contract-v125.json',import.meta.url),'utf8'));
const dims=JSON.parse(readFileSync(new URL('../static/ddv/core/world/v1.25/griddata-dimensions-v125.json',import.meta.url),'utf8'));
const audit=JSON.parse(readFileSync(new URL('./fixtures/ddv-world/outdoor-location-routing-audit-v125.json',import.meta.url),'utf8'));
const fx=JSON.parse(readFileSync(new URL('./fixtures/ddv-world/core-world-v125-observed-fixture.json',import.meta.url),'utf8'));

const URBAN_PATH='GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json';
const URBAN_SCENE=1540000147;
const URBAN_GRID=760;
const source={gameVersion:'1.25.0',platform:'Nintendo Switch',buildIdentity:'52BD625D9B4E0053',profileSchemaVersion:624};
const locationRef=locationApi.locationRefFloatingIsland(URBAN_SCENE);
const directRootRoute={codec:locationApi.DIRECT_GRID_ROUTE_CODEC,gridDataPath:URBAN_PATH};

const projector=projectorApi.createProjector({
  locationApi,
  worldApi,
  gridDataDimensions:dims,
  gridDataDimensionsSha256:projectorApi.GRIDDATA_DIMENSIONS_SHA256,
  geometryIndex:fx.geometryIndex,
  scopeIndex:fx.scopeIndex
});

function knownObject(id=1,overrides={}){
  return {
    ID:id,
    ItemID:40000173,
    X:(id*2)%240,
    Y:Math.floor(id/120)%240,
    Orientation:'GridOrientation_Up',
    State:null,
    ...overrides
  };
}

function floatingProfile({
  objects={'1':knownObject(1)},
  path=URBAN_PATH,
  gridId=URBAN_GRID,
  sceneItemId=URBAN_SCENE,
  gridIds=[gridId],
  extraGrids={},
  villages=[]
}={}){
  return {
    World:{
      GridCollection:{
        Grids:{
          [String(gridId)]:{
            ID:gridId,
            GridDataPath:path,
            GridDefaultLayoutPath:'',
            TessellationFactor:2,
            NextGridObjectID:Object.keys(objects).length+1,
            Objects:objects
          },
          ...extraGrids
        }
      },
      FloatingIslands:{
        [String(sceneItemId)]:{
          SceneItemId:sceneItemId,
          GridIDs:gridIds,
          Unlocked:true,
          CustomLocationPositionsPath:'SceneLayouts/FloatingIslands/FloatingIsland_Urban/CustomLocations.json'
        }
      },
      Villages:villages
    }
  };
}

function project(profile,overrides={}){
  return projector.project(profile,{
    locationRef,
    directRootRoute,
    source,
    ...overrides
  });
}

test('machine contract is exact-build scoped, read/model only, and does not fabricate Area identity',()=>{
  assert.equal(contract.schema,'ddv.direct-root-editor-document@1');
  assert.equal(contract.artifactId,'DDV-DIRECT-ROOT-EDITOR-DOCUMENT-V125-V1_16');
  assert.equal(contract.status,'PROMOTED');
  assert.equal(contract.mutable,false);
  assert.equal(contract.owner,'01 CORE Integrator');
  assert.equal(contract.semanticOwner,'01B CORE - World / Grid / Buildings');
  assert.equal(contract.promotion.integratorDecision,'PROMOTED_READ_MODEL_PROJECTOR_ONLY');
  const moduleBytes=readFileSync(new URL('../static/ddv/core/world/v1.25/direct-root-editor-document-v125.cjs',import.meta.url));
  assert.equal(createHash('sha256').update(moduleBytes).digest('hex'),contract.implementationArtifact.sha256);
  assert.equal(contract.target.platform,'Nintendo Switch');
  assert.equal(contract.target.titleId,'0100D39012C1A000');
  assert.equal(contract.target.buildId,'52BD625D9B4E0053');
  assert.equal(contract.target.profileSchemaVersion,624);
  assert.deepEqual(contract.supportedRootRoles.map(x=>x.role),['FLOATING_ISLAND_DIRECT_ROOT']);
  assert.equal(contract.writerBoundary.persistentWriteAuthorized,false);
  assert.equal(contract.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
  assert.equal(contract.writerBoundary.applyAuthorized,false);
});

test('representative Urban authority is the exact private-save-derived 4230-object direct root',()=>{
  const urban=audit.floatingIslands.find(x=>x.sceneItemId===URBAN_SCENE);
  assert.ok(urban);
  assert.equal(audit.target.switch.buildId,'52BD625D9B4E0053');
  assert.equal(audit.target.switch.decryptedProfileSha256,'1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10');
  assert.equal(urban.directRoots.length,1);
  assert.deepEqual(urban.directRoots[0],{
    sourceGridId:760,
    gridDataPath:URBAN_PATH,
    tessellationFactor:2,
    objectCount:4230
  });
  assert.deepEqual(dims[URBAN_PATH],{
    sizeX:130,
    sizeY:130,
    sourceSha256:'835be72b17e5897fe1f6df026be17cd0756a760d71946d3771735db79731b9ca'
  });
});

test('4230-object Urban direct root projects into the ordinary EditorDocument model without pseudo Village/Area',()=>{
  const objects={};
  for(let id=1;id<=4230;id++)objects[String(id)]=knownObject(id);
  const r=project(floatingProfile({objects}));
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.evidenceStatus,'CONFIRMED');
  const d=r.document;
  assert.equal(d.schema,'dreamwish-wand-wep-editor-document');
  assert.equal(d.version,1);
  assert.equal(d.objects.length,4230);
  assert.deepEqual(d.target.locationRef,locationRef);
  assert.deepEqual(d.target.directRootRoute,directRootRoute);
  assert.equal(d.target.directRootRole,'FLOATING_ISLAND_DIRECT_ROOT');
  assert.equal(d.target.rootGridId,760);
  assert.equal(d.target.gridDataPath,URBAN_PATH);
  assert.equal(d.target.tessellationFactor,2);
  assert.equal('villageIndex' in d.target,false);
  assert.equal('areaId' in d.target,false);
  assert.equal('areaKey' in d.target,false);
  assert.deepEqual(d.metadata.rootGridBounds,{x:0,y:0,w:260,h:260,status:'AUTHORITATIVE_GRIDDATAPATH'});
  assert.equal(d.metadata.directRootProjection.boundsAuthority.sha256,'75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa');
  assert.equal(d.capabilities.worldAreaRoute,'not-applicable-direct-root');
  assert.equal(d.capabilities.worldDryRunMutation,'not-authorized-by-projector');
  assert.equal(d.capabilities.worldPersistentWrite,'unsupported');
  assert.equal(d.target.persistentWriteAuthorized,false);
  assert.equal(r.persistentWriteAuthorized,false);
  assert.equal(r.WORLD_PERSISTENT_WRITE_V125,false);

  const first=d.objects[0],last=d.objects.at(-1);
  assert.equal(first.editorId,'g760:o1');
  assert.equal(first.source.gridId,760);
  assert.equal(first.source.gridObjectId,1);
  assert.equal(first.source.relation,'ROOT');
  assert.equal(first.itemId,40000173);
  assert.equal(first.orientation,0);
  assert.equal(first.metadata.worldClass,'FurnitureItemData');
  assert.equal(first.metadata.stateKind,'NONE');
  assert.equal(first.metadata.projectionAuthorization,'NONE');
  assert.equal(last.source.gridObjectId,4230);
});

test('projection with unknown imported-save exact build remains read-only rather than inventing build proof',()=>{
  const r=project(floatingProfile(),{source:{...source,buildIdentity:null}});
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.document.target.exactBuildKnown,false);
  assert.equal(r.document.capabilities.worldDryRunMutation,'not-authorized-by-projector');
  assert.equal(r.document.capabilities.worldPersistentWrite,'unsupported');
});

test('shared root-object fields are equivalent to the existing Area EditorDocument projection',()=>{
  const areaAdapter=worldApi.createAdapter({
    geometryIndex:fx.geometryIndex,
    scopeIndex:fx.scopeIndex,
    gridDataDimensions:dims
  });
  const area=areaAdapter.loadAreaGrid(fx.profile,{villageIndex:0,areaId:7,rootGridId:0,source});
  const raw=structuredClone(fx.profile.World.GridCollection.Grids['0'].Objects['1686']);
  const direct=project(floatingProfile({objects:{[String(raw.ID)]:raw}})).document;
  const a=area.objects.find(x=>x.itemId===40004907);
  const b=direct.objects[0];
  for(const field of ['itemId','layer','x','y','orientation','footprint','editability']){
    assert.deepEqual(b[field],a[field],field);
  }
  for(const field of ['worldClass','stateKind','reasons','rawState','geometryStatus','footprintMode','footprintSize']){
    assert.deepEqual(b.metadata[field],a.metadata[field],`metadata.${field}`);
  }
});

test('materialized SubGrid hierarchy is preserved with authoritative child bounds and is not flattened',()=>{
  const rootRaw=structuredClone(fx.profile.World.GridCollection.Grids['5'].Objects['13802']);
  const child=structuredClone(fx.profile.World.GridCollection.Grids['1395']);
  const profile=floatingProfile({
    objects:{[String(rootRaw.ID)]:rootRaw},
    extraGrids:{'1395':child}
  });
  const r=project(profile);
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.document.objects.length,1);
  const root=r.document.objects[0];
  assert.equal(root.metadata.stateKind,'SubGrid');
  assert.equal(root.metadata.subGridBinding.gridId,1395);
  assert.equal(root.metadata.subGridBinding.hierarchyPreserved,true);
  assert.equal(root.portableState.codec,'subgrid.serialized-local-child@1');
  assert.equal(root.portableState.child.width,6);
  assert.equal(root.portableState.child.height,6);

  assert.equal(r.document.metadata.subGridHierarchy.length,1);
  const node=r.document.metadata.subGridHierarchy[0];
  assert.equal(node.gridId,1395);
  assert.equal(node.gridDataPath,'GridData/Furniture/PrincessFrog_Update12/BistroTables01-GridData.json');
  assert.deepEqual(node.bounds,{x:0,y:0,w:6,h:6,status:'AUTHORITATIVE_GRIDDATAPATH'});
  assert.equal(node.objects.length,5);
  assert.ok(node.objects.every(x=>x.source.relation==='SUBGRID_CHILD'));
  assert.ok(node.objects.every(x=>x.source.gridId===1395));
  assert.equal(r.document.objects.some(x=>x.source.gridId===1395),false);
});

test('ambiguous duplicate direct-root GridDataPath fails closed',()=>{
  const p=floatingProfile({
    gridIds:[760,761],
    extraGrids:{
      '761':{
        ID:761,
        GridDataPath:URBAN_PATH,
        GridDefaultLayoutPath:'',
        TessellationFactor:2,
        NextGridObjectID:0,
        Objects:{}
      }
    }
  });
  const r=project(p);
  assert.equal(r.status,'AMBIGUOUS_FAIL_CLOSED');
  assert.equal(r.blockers[0].code,'DIRECT_ROOT_ROUTE_AMBIGUOUS');
  assert.match(JSON.stringify(r.blockers[0].upstreamBlockers),/LOCATION_DIRECT_GRID_PATH_DUPLICATE/);
});

test('missing route and missing authoritative dimensions fail closed without Area fallback',()=>{
  const missingRoute=project(floatingProfile(),{directRootRoute:{codec:locationApi.DIRECT_GRID_ROUTE_CODEC,gridDataPath:'GridData/FloatingIslands/NoSuch.json'}});
  assert.equal(missingRoute.status,'UNRESOLVED');
  assert.equal(missingRoute.blockers[0].code,'DIRECT_ROOT_ROUTE_UNRESOLVED');

  const unknownPath='GridData/FloatingIslands/Test/Unlisted-GridData.json';
  const missingBounds=project(floatingProfile({path:unknownPath}),{
    directRootRoute:{codec:locationApi.DIRECT_GRID_ROUTE_CODEC,gridDataPath:unknownPath}
  });
  assert.equal(missingBounds.status,'UNSUPPORTED');
  assert.equal(missingBounds.blockers[0].code,'DIRECT_ROOT_BOUNDS_UNRESOLVED');
});

test('unsupported Biome semantic role is explicit and never falls through to the Area loader',()=>{
  const r=project(floatingProfile(),{
    locationRef:locationApi.locationRefBiome(123,4)
  });
  assert.equal(r.status,'UNSUPPORTED');
  assert.equal(r.blockers[0].code,'DIRECT_ROOT_SEMANTIC_ROLE_UNSUPPORTED');
  assert.equal(r.document,null);
});

test('GridID/key inconsistency and ambiguous semantic ownership both fail closed',()=>{
  const bad=floatingProfile();
  bad.World.GridCollection.Grids['760'].ID=761;
  const mismatch=project(bad);
  assert.equal(mismatch.status,'UNRESOLVED');
  assert.equal(mismatch.blockers[0].code,'DIRECT_ROOT_ROUTE_UNRESOLVED');
  assert.match(JSON.stringify(mismatch.blockers[0].upstreamBlockers),/LOCATION_DIRECT_GRID_UNRESOLVED/);

  const shared=floatingProfile({
    villages:[{
      SceneItemId:1000,
      Areas:{'1':{GridIDs:[760],Unlocked:true}}
    }]
  });
  const ambiguous=project(shared);
  assert.equal(ambiguous.status,'UNSUPPORTED');
  assert.equal(ambiguous.blockers[0].code,'DIRECT_ROOT_OWNERSHIP_UNRESOLVED');
  assert.equal(ambiguous.blockers[0].ownershipStatus,'AMBIGUOUS_FAIL_CLOSED');
});

test('unresolved root-object geometry blocks projection instead of producing a fake 1x1 footprint',()=>{
  const raw=knownObject(1,{ItemID:99999999});
  const r=project(floatingProfile({objects:{'1':raw}}));
  assert.equal(r.status,'UNSUPPORTED');
  assert.equal(r.blockers[0].code,'DIRECT_ROOT_OBJECT_GEOMETRY_UNRESOLVED');
  assert.equal(r.document,null);
});

test('unsupported SubGrid DesignID and nested cycles fail closed rather than flattening descendants',()=>{
  const designRoot=structuredClone(fx.profile.World.GridCollection.Grids['5'].Objects['13802']);
  designRoot.State.SubGrid.DesignID=123;
  const design=project(floatingProfile({objects:{[String(designRoot.ID)]:designRoot}}));
  assert.equal(design.status,'UNSUPPORTED');
  assert.equal(design.blockers[0].code,'DIRECT_ROOT_SUBGRID_STATE_UNSUPPORTED');

  const cycleRoot=structuredClone(fx.profile.World.GridCollection.Grids['5'].Objects['13802']);
  const child=structuredClone(fx.profile.World.GridCollection.Grids['1395']);
  child.Objects={
    '1':{
      ID:1,
      ItemID:40000178,
      X:0,
      Y:0,
      Orientation:'GridOrientation_Up',
      State:{SubGrid:{GridID:1395,DesignID:null}}
    }
  };
  const cycle=project(floatingProfile({
    objects:{[String(cycleRoot.ID)]:cycleRoot},
    extraGrids:{'1395':child}
  }));
  assert.equal(cycle.status,'UNSUPPORTED');
  assert.equal(cycle.blockers[0].code,'DIRECT_ROOT_SUBGRID_CYCLE');
});

test('contract rejects unsupported platform/schema and preserves writer boundary',()=>{
  const p=floatingProfile();
  const platform=project(p,{source:{...source,platform:'Steam Windows'}});
  assert.equal(platform.blockers[0].code,'DIRECT_ROOT_PLATFORM_UNSUPPORTED');
  const schema=project(p,{source:{...source,profileSchemaVersion:623}});
  assert.equal(schema.blockers[0].code,'DIRECT_ROOT_PROFILE_SCHEMA_UNSUPPORTED');
  for(const r of [platform,schema]){
    assert.equal(r.persistentWriteAuthorized,false);
    assert.equal(r.WORLD_PERSISTENT_WRITE_V125,false);
    assert.equal(r.document,null);
  }
});
