import test from 'node:test';
import assert from 'node:assert/strict';
import {createSwitch626AppearanceTransport} from '../src/lib/ddv/core/save/product-scoped-appearance-transport.mjs';
import {createProductWasmReadOwner} from '../src/lib/ddv/core/save/product-wasm-read-owner.mjs';
import {SWITCH_HAIR_RELEASE,SWITCH_SKIN_RELEASE,getSwitchHairMountInfo,getSwitchSkinMountInfo} from '../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {localPlacementCopy} from '../src/lib/dev/local-placement-copy.mjs';
import {readFile} from 'node:fs/promises';
const hash=c=>c.repeat(64),initial={contract:'wand.product.single-save-session.boundary@1',schema:626,revision:0,indexGeneration:1,sessionId:'1'.repeat(32),decodedSha256:hash('a'),productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
function fixture(scope,mutate=p=>p){
 const hair=scope==='hair',calls=[],preview={contract:'wand.core.switch626.'+scope+'-exact1-preview@1',old:hair?74:170000054,new:hair?20:170000000,...(hair?{activeMale:true}:{characterId:10000053}),selectedTokenSha256:hash('b'),readsetSha256:hash('c'),projectedDecodedSha256:hash('d'),exactFieldChangedCount:1,writerAuthorized:false,originalOverwriteAuthorized:false};
 let current=true;
 const wasm={['preview_switch626_'+scope](...args){calls.push(args);return JSON.stringify(mutate({...preview}))},['stage_switch626_'+scope](){throw Error('unused')},toggle_scoped_edit(){throw Error('unused')},begin_scoped_edit_output(){throw Error('unused')},next_scoped_edit_output_chunk(){throw Error('unused')}};
 const options={parse:JSON.parse,current:()=>current,revoke:()=>{current=false},maxBytes:1024,chunkBytes:64};
 return {wasm,options,calls};
}
for(const scope of ['hair','skin'])test(scope+' fixed target preview and rejection',()=>{
 const {wasm,options,calls}=fixture(scope);const t=createSwitch626AppearanceTransport(wasm,initial,identity,options,scope);
 const r=t.previewTarget();assert.equal(r.old,scope==='hair'?74:170000054);assert.equal(r.new,scope==='hair'?20:170000000);assert.equal(r.exactFieldChangedCount,1);assert.equal(r.writerAuthorized,false);assert.equal('readsetSha256' in r,false);assert.equal('projectedDecodedSha256' in r,false);assert.deepEqual(calls[0].slice(0,scope==='hair'?1:2),scope==='hair'?[20]:[10000053,170000000]);assert.throws(()=>t.previewTarget({new:5}));
 for(const change of [p=>({...p,old:0}),p=>({...p,readsetSha256:'bad'}),p=>({...p,writerAuthorized:true}),p=>({...p,extra:true}),p=>({...p,projectedDecodedSha256:initial.decodedSha256}),p=>({...p,contract:'foreign'}),p=>({...p,...(scope==='hair'?{activeMale:false}:{characterId:1})})]){const f=fixture(scope,change);assert.throws(()=>createSwitch626AppearanceTransport(f.wasm,initial,identity,f.options,scope).previewTarget())}
 const f=fixture(scope);assert.throws(()=>createSwitch626AppearanceTransport(f.wasm,initial,{...identity,platform:'steam-windows'},f.options,scope));assert.throws(()=>createSwitch626AppearanceTransport(f.wasm,initial,identity,f.options,scope==='hair'?'skin':'hair'));assert.throws(()=>createSwitch626AppearanceTransport(f.wasm,initial,{...identity,buildId:'0000000000000000'},f.options,scope));
});
test('appearance profiles independent, OFF anchors and typed UI routes',async()=>{
 for(const s of [SWITCH_HAIR_RELEASE,SWITCH_SKIN_RELEASE]){assert.equal(s.methods.length,13);assert.equal(s.exports.length,22);assert.equal(s.platform,'switch');assert.equal(s.features.length,2)}
 assert.notEqual(SWITCH_HAIR_RELEASE.operation,SWITCH_SKIN_RELEASE.operation);assert.notEqual(SWITCH_HAIR_RELEASE.assetDir,SWITCH_SKIN_RELEASE.assetDir);
 await assert.rejects(getSwitchHairMountInfo());await assert.rejects(getSwitchSkinMountInfo());
 for(const scope of ['hair','skin']){const a=createProductWasmReadOwner(async()=>({}),{appearanceScope:'switch-'+scope});assert.equal(typeof a.previewScopedAppearance,'function');assert.equal(a.previewScopedWardrobe,undefined);assert.equal(a.previewScopedPlacement,undefined);assert.throws(()=>createProductWasmReadOwner(async()=>({}),{appearanceScope:'switch-'+scope,placementScope:'rm01'}));assert.throws(()=>createProductWasmReadOwner(async()=>({}),{appearanceScope:'switch-'+scope,allowScopedCollectionSource:true}));assert.match(await readFile(new URL('../src/routes/editor/appearance/'+scope+'/switch/+page.svelte',import.meta.url),'utf8'),new RegExp('fixedOperation="switch-'+scope+'"'))}
 for(const l of ['en','ja','fr','de','it','es-ES','zh-CN','pt-BR']){const c=localPlacementCopy(l);assert.ok(c.hairTitle&&c.skinTitle);assert.match(c.hairDetail,/74 → 20/);assert.match(c.skinDetail,/170000054 → 170000000/)}
});

 // Regression E3373: exercise actual local adapter OPEN through P1G codec and
 // read-only bridge, with a synthetic encrypted profile and mock Rust session.
 // Dedicated generated WASM/OPFS/independent Reopen remain the L2 oracle.
test('Appearance local adapter OPEN binds exact platform and Build before Rust construction',async()=>{
 const {createHash}=await import('node:crypto');
 const {makeSyntheticP1gProfile}=await import('./helpers/p1g-fixture.mjs');
 const {p1gPackagedProfileCodec}=await import('../src/lib/ddv/core/save/p1g-packaged-profile-codec.js');
 const a=await import('../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs');
 const digest=b=>createHash('sha256').update(b).digest('hex');
 const enc=makeSyntheticP1gProfile({GameInfo:{Version:626},World:{Unknown:{keep:1}},Player:{AvatarIsMale:true},Unknown:{future:true}});
 const file=new File([enc],'appearance-open.p1g'),originalSha256=digest(enc);
 const decodedSha256=digest(new TextEncoder().encode((await p1gPackagedProfileCodec.loadProfile(enc)).jsonText));
 const sw={...identity,externallyConfirmed:true},steam={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
 for(const [mode,scope,create,build,foreign] of [
  ['switch','hair',a.createProductSwitch626HairLocalAdapter,sw,steam],
  ['switch','skin',a.createProductSwitch626SkinLocalAdapter,sw,steam],
  ['steam','hair',a.createProductSteam626HairLocalAdapter,steam,sw],
  ['steam','skin',a.createProductSteam626SkinLocalAdapter,steam,sw]]){
  let opens=0,closes=0,dirs=0,factories=0;
  class Mock{
   constructor(p,k,b,s,confirmed){assert.deepEqual([p,k,b,s,confirmed],[build.platform,build.buildKind,build.buildId,626,true]);opens++}
   append_chunk(){}finish(){return JSON.stringify({...initial,decodedSha256,allDomainReferencesVerified:false,productReadAccepted:false})}
   close(){closes++}
   toggle_scoped_edit(){throw Error('unexpected mutation')}
   begin_scoped_edit_output(){throw Error('unexpected output')}
   next_scoped_edit_output_chunk(){throw Error('unexpected output')}
  }
  Mock.prototype['preview_'+mode+'626_'+scope]=()=>{throw Error('unexpected preview')};
  Mock.prototype['stage_'+mode+'626_'+scope]=()=>{throw Error('unexpected stage')};
  const adapter=create({wasmFactory:async()=>{factories++;return {WorkerWasmSource:Mock}},getDirectory:async()=>{dirs++;return {}}});
  for(const bad of [foreign,{...build,buildId:'0000000000000000'},{...build,buildKind:foreign.buildKind},{...build,schema:624},{...build,externallyConfirmed:false}]){
   await assert.rejects(adapter.open({file,build:bad,originalSha256}),/PRODUCT_SCOPED_LOCAL_DENIED/);
   assert.deepEqual([factories,opens,closes,dirs],[0,0,0,0]);
  }
  assert.deepEqual(await adapter.open({file,build,originalSha256}),{kind:'OPEN',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
  assert.deepEqual([factories,opens,dirs],[1,1,1]);await adapter.close();assert.equal(closes,1);
  assert.equal(digest(new Uint8Array(await file.arrayBuffer())),originalSha256);
 }
});
