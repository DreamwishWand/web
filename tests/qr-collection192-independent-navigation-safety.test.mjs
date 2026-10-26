import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectionWorkspaceHref,collectionWorkspaceState,collectionReferenceSelection,COLLECTION_SUPPORTED_VERSION} from '../src/lib/collection/reference-navigation.js';
import {COLLECTION_COPY,COLLECTION_REFERENCE_COPY,collectionCopy,collectionReferenceCopy} from '../src/lib/collection/copy.js';

const path=readFileSync('src/routes/collection/+page.svelte','utf8');
const runtime=readFileSync('src/lib/collection/runtime.js','utf8');
const sample={itemId:507,label:'SOURCE_TEST_ITEM'};
test('QR192 direct URL state for three views, non-ASCII and reserved chars always generates safe return HREF',()=>{
 const cases=[
  {view:'category',family:'Furniture',query:'椅子 & sofa/?'},
  {view:'world',world:'IsDreamlightValley',query:'A+B & 椅子'},
  {view:'universe',universe:'Mickey',query:'ToM #19 😀'}
 ];
 for(const c of cases){
  const original={...c,version:'1.25.0'};
  const href=collectionWorkspaceHref('/web',original,507);
  const url=new URL(href,'https://offline.invalid');
  assert.equal(url.searchParams.get('item'),'507');
  assert.equal(url.searchParams.get('q'),c.query);
  assert.equal(url.searchParams.get('view'),c.view==='category'?null:c.view);
  const state=collectionWorkspaceState(url);
  const back=collectionWorkspaceHref('/web',state);
  const returnState=collectionWorkspaceState(new URL(back,'https://offline.invalid'));
  assert.equal(returnState.view,c.view);
  assert.equal(returnState.query,c.query);
  assert.equal(returnState.family,c.view==='category'?c.family:'');
  assert.equal(returnState.world,c.view==='world'?c.world:'');
  assert.equal(returnState.universe,c.view==='universe'?c.universe:'');
  assert.equal(new URL(back,'https://offline.invalid').searchParams.has('item'),false);
 }
});
test('QR192 ID strict and version boundaries: no guessed Switch1253 schema626 or Steam identity',()=>{
 assert.equal(COLLECTION_SUPPORTED_VERSION,'1.25.0');
 for(const version of ['1.25.3','Steam','1.25.3/schema626','1.24.13','1.25','v1.25.0','']){
  if(version==='')continue;
  assert.equal(collectionReferenceSelection([sample],'507',version).status,'unsupported-version');
 }
 for(const raw of ['-1','0507','5e2','+507','507.0',' 507','507 ','0x1fb','0%20','507/1','507\u0000','9007199254740992','507&other=1'])
  assert.equal(collectionReferenceSelection([sample],raw).status,'unknown-item',raw);
 assert.equal(collectionReferenceSelection([sample],'507').status,'found');
 assert.equal(collectionReferenceSelection([sample],'508').status,'unknown-item');
});
test('QR192 red URL-witness: duplicated item keys and malformed uncategorized filters are accepted, URL not normalized on entry',()=>{
 const url=new URL('/web/collection/?item=507&item=abc&view=???&family=Furniture&world=WRONG&universe=WRONG&q=%25broken','https://offline.invalid');
 const state=collectionWorkspaceState(url);
 assert.equal(state.itemId,'507'); // duplicate second item is silently ignored
 assert.equal(state.view,'category');
 assert.equal(collectionReferenceSelection([sample],state.itemId).status,'found');
 const href=collectionWorkspaceHref('/web',state,507);
 assert.equal(new URL(href,'https://offline.invalid').searchParams.has('world'),false);
 assert.equal(new URL(href,'https://offline.invalid').searchParams.has('universe'),false);
 assert(!path.includes('history.replaceState'));
 assert(!path.includes('replaceState('));
 console.log('QR_COLLECTION192_RED_NONCANONICAL_DUPLICATE_ITEM_PARAM_ACCEPTED',JSON.stringify({
  input:url.search,status:'found',duplicateItemParamDenied:false,
  incomingAddressCanonicalizedOnLoad:false,subsequentGeneratedHrefCanonical:true
 }));
});
test('QR192 independent 8 locale privacy/rights/eight-language safety boundaries are explicit and no entitlement is inferred',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(COLLECTION_REFERENCE_COPY).sort(),locales.slice().sort());
 assert.deepEqual(Object.keys(COLLECTION_COPY).sort(),locales.slice().sort());
 for(const lang of locales){
  const list=collectionCopy(lang),detail=collectionReferenceCopy(lang);
  for(const field of ['personalDetail','media','source','readonly']){
   assert.equal(typeof list[field],'string');assert(list[field].trim().length>0,lang+'/'+field);
  }
  for(const field of ['notOwned','noMedia','unsupported','reference']){
   assert.equal(typeof detail[field],'string');assert(detail[field].trim().length>0,lang+'/'+field);
  }
 }
 assert.match(path,/detailCopy\.notOwned/);
 assert.match(path,/detailCopy\.noMedia/);
 assert.match(path,/item\.stateClass === 'TRACKED'/);
 assert(!/<img\b/i.test(path));
 assert(!/createSignedUrl|createSignedUploadUrl|Upload|saveOwned|loadSave|entitlementCheck/.test(path));
 assert.equal(runtime.includes('return {\n    itemId,'),true);
 for(const field of ['owned:','discovered:','premiumOwned:','dlcOwned:'])assert(!runtime.includes(field));
});
test('QR192 keyboard and 320px responsive static source contract (NOT a repeated live Chrome proof)',()=>{
 for(const token of ['<a class="collection-card" href={referenceHref(item)}>',
 'role="group"','aria-pressed={view ===','type="search"','on:click={() => displayLimit += DISPLAY_LIMIT}',
 'data-collection-state="unsupported-version"','data-collection-state="item-detail"',
 'class="back-link"','on:click={reload}','@media(max-width:480px)',
 '.collection-grid{grid-template-columns:1fr}','.item-detail-grid{grid-template-columns:1fr}',
 ':focus-visible']) assert(path.includes(token),token);
 assert(path.includes('overflow-wrap:anywhere'));
 assert(path.includes('collectionWorkspaceHref(base,workspaceState'));
});
