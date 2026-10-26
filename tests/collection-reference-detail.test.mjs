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
test('Collection deep links retain existing workspace browse lens and search across Item Detail/back',()=>{
  const state={view:'world',world:'IsDreamlightValley',query:'椅子',version:'1.25.0'};
  const path=collectionWorkspaceHref('/wand',state,123);
  assert.equal(path,'/wand/collection/?view=world&q=%E6%A4%85%E5%AD%90&world=IsDreamlightValley&item=123');
  const parsed=collectionWorkspaceState(new URL(path,'https://wand.invalid'));
  assert.equal(parsed.itemId,'123');assert.equal(parsed.view,'world');assert.equal(parsed.query,'椅子');
  assert.equal(parsed.world,'IsDreamlightValley');
  const back=collectionWorkspaceHref('/wand',parsed);
  assert(!back.includes('item='));
  assert.equal(collectionWorkspaceState(new URL(back,'https://wand.invalid')).view,'world');
  assert.equal(collectionWorkspaceHref('',{view:'unknown'},null),'/collection/');
  assert.throws(()=>collectionWorkspaceHref('',{},-5),/Invalid Collection ItemID/);
});
test('All 8 locale copies state unavailable version and uncertain ownership explicitly',()=>{
  assert.equal(Object.keys(COLLECTION_REFERENCE_COPY).length,8);
  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    const copy=collectionReferenceCopy(locale);
    for(const key of ['detail','back','notFound','unsupported','version','worlds','universes','noFacet','reference','notOwned','noMedia','retry'])
      assert(typeof copy[key]==='string'&&copy[key].trim().length>4,`${locale} ${key}`);
  }
  assert.equal(collectionReferenceCopy('unknown'),COLLECTION_REFERENCE_COPY.en);
});
test('Collection route is non-mutating, stays in one workspace and has explicit detail/failed/version states',()=>{
  const source=readFileSync('src/routes/collection/+page.svelte','utf8');
  for(const marker of ['data-collection-state="item-detail"','data-collection-state="unknown-item"',
    'data-collection-state="unsupported-version"','on:click={reload}',
    'aria-pressed={view ===','collectionWorkspaceHref','itemSelection.item.itemId',
    'detailCopy.notOwned','detailCopy.noMedia'])
    assert(source.includes(marker),marker);
  for(const forbidden of ['save_writer','apply_preset','uploadBytes','galleryPublish','service_role'])
    assert(!source.includes(forbidden),forbidden);
});
