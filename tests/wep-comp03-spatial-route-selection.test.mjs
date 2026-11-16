import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile} from 'svelte/compiler';
import {createComp03ReviewPort} from '../src/lib/dev/comp03-product-route-port.mjs';
import {productPlacementPortScope} from '../src/lib/dev/product-placement-client.mjs';
import {PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR} from '../src/lib/ddv/core/save/product-scoped-comp03-spatial-release-anchor.mjs';

test('COMP03 fixed route selects only the protected optional anchor and never downgrades on failure',async()=>{
 const url=new URL('../src/lib/dev/comp03-product-route-port.mjs',import.meta.url);
 const src=await readFile(url,'utf8');
 // Execute the actual selector source with isolated dependency doubles. This
 // tests selection and rejection, NOT signatures, real Worker or public grants.
 const body=src.replace(/^import .*;\n/gm,'');
 assert.doesNotMatch(body,/\bimport\b/);
 const legacy=(options)=>({kind:'legacy',options});
 const spatial=(options)=>({kind:'spatial',options});
 const make=(anchor,old=legacy,next=spatial)=>import('data:text/javascript;base64,'+Buffer.from(
  'const PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR='+JSON.stringify(anchor)+';\n'+
  'const createProductComp03Port='+old.toString()+';\nconst createProductComp03SpatialPort='+next.toString()+';\n'+body
 ).toString('base64'));
 const options={signal:'synthetic',spatialPreviewEnabled:true,mode:'untrusted'};
 assert.deepEqual((await make(null)).createComp03ReviewPort(options),{kind:'legacy',options});
 for(const anchor of [{},false,0,'bad',{contract:'synthetic'}]){
  const m=await make(anchor);assert.deepEqual(m.createComp03ReviewPort(options),{kind:'spatial',options});
 }
 const m=await make({contract:'invalid'},()=>{throw Error('DOWNGRADE')},async()=>{throw Error('SPATIAL_DENIED')});
 await assert.rejects(m.createComp03ReviewPort(options),/SPATIAL_DENIED/);
});
test('COMP03 production null anchor remains OFF with no Worker or forged brand',async()=>{
 assert.equal(PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR,null);
 let calls=0;const old=Object.fromEntries(['document','location','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://example.invalid/web/editor/world/comp03/?spatial=1')});
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){calls++}}});
  await assert.rejects(createComp03ReviewPort({spatialPreviewEnabled:true,mode:'public-accepted'}));assert.equal(calls,0);
  assert.equal(productPlacementPortScope({spatialPreviewEnabled:true}),null);
 }finally{for(const [k,v] of Object.entries(old)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k]}}
});
test('COMP03 actual product route wiring preserves all other fixed routes and cleanup',async()=>{
 const f=new URL('../src/lib/dev/PlacementProductRoute.svelte',import.meta.url),src=await readFile(f,'utf8');
 assert(compile(src,{filename:f.pathname,generate:'client'}).js.code.length>0);
 assert.match(src,/comp03:createComp03ReviewPort,vase:createProductVaseAddPort,'backpack-steam':createProductSteamBackpackPort,'backpack-switch':createProductSwitchBackpackPort,'wardrobe-steam':createProductSteamWardrobePort,'wardrobe-switch':createProductSwitchWardrobePort/);
 assert.match(src,/create\(\{signal:abort.signal,onFault:clear\}\)/);
 assert.match(src,/abort\.signal\.aborted\)\{p\.dispose\(\);return\}/);
 assert.match(src,/port&&scope\}<LocalPlacementEditorDev trustedWorkerAdapter=\{port\} \{fixedOperation\}/);
 assert.match(src,/return \(\)=>\{abort.abort\(\);clear\(\)\}/);
});
