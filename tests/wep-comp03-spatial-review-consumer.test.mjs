import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {createHash} from 'node:crypto';
import {createLocalPlacementDevWorkflow} from '../src/lib/dev/local-placement-workflow.mjs';

const safe=(kind,extra={})=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false,...extra});
const preview={itemId:40100038,gridId:90001,seedId:500,nextObjectId:510,oldAmount:30,newAmount:30,inventoryDelta:0,retainSeed:1,addObjects:8,exactFieldChangedCount:9,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false};
const anchors=()=>[{objectId:500,x:12,y:16,role:'retained'},...Array.from({length:8},(_,i)=>({objectId:510+i,x:16+4*(i%2),y:16+4*Math.floor(i/2),role:'proposed'}))];
// Synthetic anchors are presentation inputs, deliberately not a geometry oracle.
const spatial=()=>({rootSceneItemId:1540000150,gridId:90001,seedId:500,nextObjectId:510,anchors:anchors(),writerAuthorized:false,editedCopyAuthorized:false});
function setup({enabled=false,patch={},missing=false,operation='comp03',delay=null}={}){
 let log=[];const file=new File([new Uint8Array(16)],'original.p1g');
 const sha=createHash('sha256').update(new Uint8Array(16)).digest('hex');
 const a={async open(){return safe('OPEN')},async backupOriginal(){return {backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,originalName:file.name,originalSha256:sha,originalSizeBytes:16,backupName:'backup.p1g'}},
  async previewPlacement(s){log.push(['preview',s]);return preview},async spatialPreview(...args){log.push(['spatial',...args]);if(delay)await delay;return {...spatial(),...patch}},
  async stagePlacement(){log.push(['stage']);return safe('STAGED',{exactFieldChangedCount:9})},
  async undo(){return safe('UNDONE')},async redo(){return safe('REDONE')},async exportEditedCopy(){throw Error('not used')},async downloadVerifiedCopy(){throw Error('not used')},async close(){log.push(['close']);return safe('CLOSED')}};
 if(missing)delete a.spatialPreview;
 const w=createLocalPlacementDevWorkflow(a,{trustedLocalHarness:true,operation,spatialPreviewEnabled:enabled});
 const ready=async()=>{await w.openFile({file,buildConfirmed:true});await w.backupOriginal()};
 return {w,log,ready};
}
test('COMP03 optional product review binds same preview, renders supplied anchors and clears on Stage',async()=>{
 const s=setup({enabled:true});await s.ready();
 const p=await s.w.preview({seedId:500});
 assert.deepEqual(s.log,[['preview',{seedId:500}],['spatial']]);
 assert.equal(p.phase,'previewed');assert.equal(p.spatialPreview.gridId,90001);assert.equal(p.spatialPreview.seedId,500);
 assert.deepEqual(p.spatialPreview.markers.map(m=>[m.objectId,m.x,m.y,m.role]),anchors().map(a=>[a.objectId,a.x,a.y,a.role]));
 assert(p.spatialPreview.markers.every(m=>!m.selectable&&!m.hitTestEligible&&Object.isFrozen(m)));
 assert.equal((await s.w.stage()).spatialPreview,null);
 assert.equal((await s.w.undo()).spatialPreview,null);assert.equal((await s.w.redo()).spatialPreview,null);
 assert.equal((await s.w.close()).spatialPreview,undefined);
});
test('COMP03 legacy workflow never discovers spatial by method presence and optional failures close atomically',async()=>{
 const legacy=setup();await legacy.ready();assert.equal((await legacy.w.preview({seedId:500})).spatialPreview,undefined);
 assert.deepEqual(legacy.log,[['preview',{seedId:500}]]);
 assert.throws(()=>setup({enabled:true,missing:true}));assert.throws(()=>setup({enabled:true,operation:'vase'}));
 const bad=(i,p)=>anchors().map((a,j)=>i===j?{...a,...p}:a);
 for(const patch of [{gridId:90002},{seedId:501},{nextObjectId:511},{rootSceneItemId:1540000153},{writerAuthorized:true},{editedCopyAuthorized:true},{unexpected:1},{anchors:anchors().slice(1)},{anchors:bad(1,{objectId:500})},{anchors:bad(1,{x:12,y:16})},{anchors:bad(1,{x:261})},{anchors:bad(1,{role:'retained'})}]){
  const s=setup({enabled:true,patch});await s.ready();await assert.rejects(s.w.preview({seedId:500}));
  assert.equal(s.w.snapshot().phase,'closed');assert.equal(s.w.snapshot().spatialPreview,undefined);await assert.rejects(s.w.stage());assert(!s.log.some(a=>a[0]==='stage'));
 }
});
test('COMP03 close while companion is pending cannot publish stale anchors',async()=>{
 let release;const delay=new Promise(r=>{release=r});const s=setup({enabled:true,delay});await s.ready();
 const pending=s.w.preview({seedId:500});await Promise.resolve();await Promise.resolve();
 await s.w.close();release();await assert.rejects(pending);assert.equal(s.w.snapshot().phase,'closed');assert.equal(s.w.snapshot().spatialPreview,undefined);
});
test('COMP03 actual Review mounts anchors only on branded optional scope and current Preview',async()=>{
 const file=new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url),src=await readFile(file,'utf8');
 assert(compile(src,{filename:file.pathname,generate:'client'}).js.code.length>0);
 assert.match(src,/spatialPreviewEnabled:scope\?\.spatialPreviewEnabled===true/);
 assert.match(src,/\{#if state\.phase==='previewed'&&!pending&&p\.seedId===seed&&state\.spatialPreview\}/);
 assert.match(src,/data-comp03-spatial-review/);assert.match(src,/state\.spatialPreview\.markers as m/);
 assert.match(src,/pointer-events:none/);assert.match(src,/data-product-writer="off"/);
 assert.doesNotMatch(src,/on:click=\{[^}]*spatialPreview/);
});
