import test from 'node:test';
import assert from 'node:assert/strict';
import {createSteam626AppearanceTransport} from '../src/lib/ddv/core/save/product-scoped-appearance-transport.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {HAIR_RELEASE,SKIN_RELEASE,getHairMountInfo,getSkinMountInfo} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
import {readFile} from 'node:fs/promises';
const hash=c=>c.repeat(64),initial={contract:'wand.product.single-save-session.boundary@1',schema:626,revision:0,indexGeneration:1,sessionId:'1'.repeat(32),decodedSha256:hash('a'),productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626};
function fixture(scope,mutate=p=>p){
 const hair=scope==='hair',calls=[],preview={contract:'wand.core.steam626.'+scope+'-exact1-preview@1',old:hair?74:170000054,new:hair?20:170000000,...(hair?{activeMale:true}:{characterId:10000053}),selectedTokenSha256:hash('b'),readsetSha256:hash('c'),projectedDecodedSha256:hash('d'),exactFieldChangedCount:1,writerAuthorized:false,originalOverwriteAuthorized:false};
 let current=true;
 const wasm={['preview_steam626_'+scope](...args){calls.push(args);return JSON.stringify(mutate({...preview}))},['stage_steam626_'+scope](){throw Error('unused')},toggle_scoped_edit(){throw Error('unused')},begin_scoped_edit_output(){throw Error('unused')},next_scoped_edit_output_chunk(){throw Error('unused')}};
 const options={parse:JSON.parse,current:()=>current,revoke:()=>{current=false},maxBytes:1024,chunkBytes:64};
 return {wasm,options,calls};
}
for(const scope of ['hair','skin'])test(scope+' fixed target preview and rejection',()=>{
 const {wasm,options,calls}=fixture(scope);const t=createSteam626AppearanceTransport(wasm,initial,identity,options,scope);
 const r=t.previewTarget();assert.equal(r.old,scope==='hair'?74:170000054);assert.equal(r.new,scope==='hair'?20:170000000);assert.equal(r.exactFieldChangedCount,1);assert.equal(r.writerAuthorized,false);assert.equal('readsetSha256' in r,false);assert.equal('projectedDecodedSha256' in r,false);assert.deepEqual(calls[0].slice(0,scope==='hair'?1:2),scope==='hair'?[20]:[10000053,170000000]);assert.throws(()=>t.previewTarget({new:5}));
 for(const change of [p=>({...p,old:0}),p=>({...p,readsetSha256:'bad'}),p=>({...p,writerAuthorized:true}),p=>({...p,extra:true}),p=>({...p,projectedDecodedSha256:initial.decodedSha256}),p=>({...p,contract:'foreign'})]){const f=fixture(scope,change);assert.throws(()=>createSteam626AppearanceTransport(f.wasm,initial,identity,f.options,scope).previewTarget())}
 const f=fixture(scope);assert.throws(()=>createSteam626AppearanceTransport(f.wasm,initial,{...identity,platform:'switch'},f.options,scope));assert.throws(()=>createSteam626AppearanceTransport(f.wasm,initial,identity,f.options,scope==='hair'?'skin':'hair'));
});
test('appearance profiles independent, OFF anchors and typed UI routes',async()=>{
 for(const s of [HAIR_RELEASE,SKIN_RELEASE]){assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.equal(s.platform,'steam-windows');assert.equal(s.features.length,2)}
 assert.notEqual(HAIR_RELEASE.operation,SKIN_RELEASE.operation);assert.notEqual(HAIR_RELEASE.assetDir,SKIN_RELEASE.assetDir);
 await assert.rejects(getHairMountInfo());await assert.rejects(getSkinMountInfo());
 for(const scope of ['hair','skin']){const a=createProductWasmReadOwner(async()=>({}),{appearanceScope:scope});assert.equal(typeof a.previewScopedAppearance,'function');assert.equal(a.previewScopedWardrobe,undefined);assert.equal(a.previewScopedPlacement,undefined);assert.throws(()=>createProductWasmReadOwner(async()=>({}),{appearanceScope:scope,placementScope:'rm01'}));assert.throws(()=>createProductWasmReadOwner(async()=>({}),{appearanceScope:scope,allowScopedCollectionSource:true}));assert.match(await readFile(new URL('../src/routes/editor/appearance/'+scope+'/steam/+page.svelte',import.meta.url),'utf8'),new RegExp('fixedOperation="'+scope+'"'))}
 for(const l of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){const c=localPlacementCopy(l);assert.ok(c.hairTitle&&c.skinTitle);assert.match(c.hairDetail,/74 → 20/);assert.match(c.skinDetail,/170000054 → 170000000/)}
});
