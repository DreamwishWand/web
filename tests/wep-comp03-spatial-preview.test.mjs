import test from 'node:test';
import assert from 'node:assert/strict';
import { fitViewport, panViewport, zoomViewportAt, worldToScreen } from '../src/lib/wep/canvas-runtime.ts';
import { projectComp03PreviewMarkers } from '../src/lib/wep/comp03-spatial-preview.ts';

const bounds = {x:0,y:0,w:260,h:260};
const view = fitViewport(bounds, 800, 600);
// Synthetic presentation anchors; intentionally not a geometry oracle.
const points = () => [
 {objectId:500,x:12,y:16,role:'retained'},
 {objectId:901,x:16,y:16,role:'proposed'},
 {objectId:902,x:20,y:16,role:'proposed'},
 {objectId:903,x:12,y:20,role:'proposed'},
 {objectId:904,x:16,y:20,role:'proposed'},
 {objectId:905,x:20,y:20,role:'proposed'},
 {objectId:906,x:12,y:24,role:'proposed'},
 {objectId:907,x:16,y:24,role:'proposed'},
 {objectId:908,x:20,y:24,role:'proposed'}
];

test('COMP03 2D marker projection uses supplied anchors and existing viewport, not a second geometry engine',()=>{
 const rows=points(), before=structuredClone(rows);
 const moved=panViewport(view, 31, -22);
 const zoomed=zoomViewportAt(moved, moved.zoom*2, {x:400,y:300});
 for(const viewport of [view,moved,zoomed]){
  const p=projectComp03PreviewMarkers(42,rows,viewport);
  assert.equal(p.gridId,42);
  assert.equal(p.markers.length,9);
  assert.equal(p.markers.filter(r=>r.role==='retained').length,1);
  for(let i=0;i<rows.length;i++){
   const r=rows[i], m=p.markers[i], expected=worldToScreen(viewport,r);
   assert.deepEqual([m.objectId,m.x,m.y,m.role],[r.objectId,r.x,r.y,r.role]);
   assert.deepEqual([m.screenX,m.screenY],[expected.x,expected.y]);
   assert.equal(m.selectable,false);assert.equal(m.hitTestEligible,false);
   assert(Object.isFrozen(m));
  }
  assert.equal(p.persistentWriteAuthorized,false);assert.equal(p.placementValidated,false);
  assert(Object.isFrozen(p));assert(Object.isFrozen(p.markers));
 }
 assert.deepEqual(rows,before);
 // No pitch/topology synthesis, normalization or validation claim.
 const offPattern=points();offPattern[1].x=17;
 assert.equal(projectComp03PreviewMarkers(42,offPattern,view).markers[1].x,17);
});

test('COMP03 presentation rejects malformed/partial/foreign-shaped rows, without a partial overlay',()=>{
 const change=(i,patch)=>points().map((p,j)=>j===i?{...p,...patch}:p);
 const cases=[
  [0,points(),view],[42,points().slice(1),view],[42,[...points(),points()[0]],view],
  [42,change(1,{objectId:500}),view],[42,change(1,{x:12,y:16}),view],
  [42,change(1,{role:'retained'}),view],[42,change(0,{role:'proposed'}),view],
  [42,change(1,{role:'existing'}),view],[42,change(1,{x:'16'}),view],
  [42,change(1,{x:1.2}),view],[42,change(1,{x:-1}),view],
  [42,change(1,{x:260}),view],[42,change(1,{objectId:0}),view],
  [42,change(1,{writerAuthorized:true}),view],[42,points(),{...view,zoom:0}],
  [42,points(),{...view,offsetX:NaN}],[42,points(),{...view,widthPx:0}],
  [42,points(),{...view,areaBounds:{...bounds,w:0}}]
 ];
 for(const [grid,rows,viewport] of cases)
  assert.throws(()=>projectComp03PreviewMarkers(grid,rows,viewport),/WEP_COMP03_SPATIAL_PRESENTATION_INVALID/);
});
