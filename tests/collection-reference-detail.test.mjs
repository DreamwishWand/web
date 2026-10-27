import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  COLLECTION_SUPPORTED_VERSION, collectionReferenceSelection, collectionWorkspaceHref, collectionWorkspaceState
} from '../src/lib/collection/reference-navigation.js';
import {collectionReferenceCopy, COLLECTION_REFERENCE_COPY} from '../src/lib/collection/copy.js';
import {decodeCollectionRecord} from '../src/lib/collection/runtime.js';

const index={
  f:['Furniture','Clothing'],c:['READ_ONLY','TRACKED'],m:['QUANTITY_STOCK','OWNERSHIP_AND_DISCOVERY'],
  w:['IsDreamlightValley'],u:['Mickey'],e:['BaseGame']
};
const row=decodeCollectionRecord(index,[123,0,1,1,[0],[0],[0],
  ['Chair','Chaise','Sedia','Stuhl','Silla','椅子','椅子','Cadeira']],'ja');
const records=[row];

test('Collection Item Detail selects an existing normalized DDV ItemID without claiming personal ownership',()=>{
  const found=collectionReferenceSelection(records,'123');
  assert.equal(found.status,'found');assert.strictEqual(found.item,row);
  assert.equal(found.item.itemId,123);
  assert.equal(found.item.family,'Furniture');
  assert.equal(found.item.stateClass,'TRACKED');
  assert(!Object.hasOwn(found.item,'owned'));
  assert(!Object.hasOwn(found.item,'discovered'));
});
test('Unsupported target version and invalid/nonexistent ItemIDs fail closed',()=>{
  assert.equal(collectionReferenceSelection(records,'123','1.25.3').status,'unsupported-version');
  assert.equal(collectionReferenceSelection(records,'123','Steam').status,'unsupported-version');
  for(const value of ['-1','1.0','0123','Infinity','1e3','abc','9007199254740993','<img>','not-a-source-id'])
    assert.equal(collectionReferenceSelection(records,value).status,'unknown-item');
  assert.equal(collectionReferenceSelection(records,'124').status,'unknown-item');
  assert.equal(collectionReferenceSelection(records,'').status,'browse');
  assert.equal(COLLECTION_SUPPORTED_VERSION,'1.25.0');
});
test('Category-first Collection deep links retain Universe/Expansion contextual facets',()=>{
  const state={family:'Furniture',universe:'Mickey',expansion:'BaseGame',query:'椅子',version:'1.25.0'};
  const path=collectionWorkspaceHref('/wand',state,123);
  assert.equal(path,'/wand/collection/?q=%E6%A4%85%E5%AD%90&family=Furniture&universe=Mickey&expansion=BaseGame&item=123');
  const parsed=collectionWorkspaceState(new URL(path,'https://wand.invalid'));
  assert.equal(parsed.itemId,'123');assert.equal(parsed.view,'category');assert.equal(parsed.query,'椅子');
  assert.equal(parsed.family,'Furniture');assert.equal(parsed.universe,'Mickey');assert.equal(parsed.expansion,'BaseGame');
  const back=collectionWorkspaceHref('/wand',parsed);
  assert(!back.includes('item='));
  assert.equal(collectionWorkspaceState(new URL(back,'https://wand.invalid')).universe,'Mickey');
  for(const legacy of ['?view=world&world=IsDreamlightValley&item=123','?view=universe&universe=Mickey&item=123']) {
    assert.equal(collectionWorkspaceState(new URL('/collection/'+legacy,'https://wand.invalid')).invalid,true);
  }
  assert.throws(()=>collectionWorkspaceHref('',{view:'world'},null),/Unsupported permanent/);
  assert.throws(()=>collectionWorkspaceHref('',{},-5),/Invalid Collection ItemID/);
});
test('All 8 locale copies state unavailable version and uncertain ownership explicitly',()=>{
  assert.equal(Object.keys(COLLECTION_REFERENCE_COPY).length,8);
  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    const copy=collectionReferenceCopy(locale);
    for(const key of ['showMore','detail','back','notFound','unsupported','version','worlds','universes','noFacet','reference','notOwned','noMedia','retry'])
      assert(typeof copy[key]==='string'&&copy[key].trim().length>=2,`${locale} ${key}`);
  }
  assert.equal(collectionReferenceCopy('unknown'),COLLECTION_REFERENCE_COPY.en);
});
test('Collection route is non-mutating, stays in one workspace and has explicit detail/failed/version states',()=>{
  const source=readFileSync('src/routes/collection/+page.svelte','utf8');
  for(const marker of ['data-collection-state="item-detail"','data-collection-state="unknown-item"',
    'data-collection-state="unsupported-version"','on:click={reload}',
    'stage1Copy.expansion','collectionWorkspaceHref','itemSelection.item.itemId',
    'detailCopy.notOwned','detailCopy.noMedia','displayLimit += DISPLAY_LIMIT'])
    assert(source.includes(marker),marker);
  for(const forbidden of ['save_writer','apply_preset','uploadBytes','galleryPublish','service_role'])
    assert(!source.includes(forbidden),forbidden);
});
