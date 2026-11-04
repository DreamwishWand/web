import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEntityRef,nativeEntityPath} from '../src/lib/entity/shared-entity-identity.mjs';
import {buildSharedCatalogDirectory,typedSharedCatalogDirectoryHref,relatedSharedCatalogItems} from '../src/lib/entity/shared-catalog-directory.mjs';
import {resolveTypedCatalogItem,typedItemPreviewHref,nonItemPublicDetailStatus,
 TYPED_CATALOG_PUBLIC_ENABLED,TYPED_CATALOG_PERSONAL_READ_ENABLED}
 from '../src/lib/foundation/typed-entity-page-consumer.mjs';
const index={s:'wand.collection.runtime@1',n:2,t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
 f:['Furniture'],c:['TRACKED'],m:['Reference'],w:['Valley'],u:['Disney'],e:['Base'],
 l:['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'],
 wl:[['Valley','Valley','Valley','Valley','Valley','谷','谷','Vale']],
 ul:[['Disney','Disney','Disney','Disney','Disney','ディズニー','迪士尼','Disney']]};
const row=id=>[id,0,0,0,[0],[0],[0],[String(id),String(id),String(id),String(id),String(id),String(id),String(id),String(id)]];
const rows=[row(40000047),row(40000048)];
test('QR446 independent one native Typed Item URL and source membership, not generic guessed ID',()=>{
 const dir=buildSharedCatalogDirectory(index,rows,'ja');
 assert.equal(dir.status,'READY');
 assert.equal(dir.entries.length,2);
 const source=dir.entries[0];
 const original=makeEntityRef({kind:'ITEM',primaryId:'40000047'});
 const actual=resolveTypedCatalogItem(index,rows,'40000047','ja','/web');
 assert.equal(actual.status,'FOUND_REFERENCE_ONLY');
 assert.deepEqual(actual.ref,original);
 assert.equal(actual.href,nativeEntityPath(original,'ja',{base:'/web'}));
 assert.equal(actual.publicIndexable,false);assert.equal(actual.canonicalUrl,null);
 assert.equal(actual.personalOverlay,null);assert.equal(actual.writerAuthorized,false);
 assert.deepEqual(actual.relations,[]);assert.deepEqual(actual.aliases,[]);
 assert.equal(typedSharedCatalogDirectoryHref('/web','ja',source,dir),'/web/ja/40000047/');
 assert.equal(typedSharedCatalogDirectoryHref('/web','ja',{...source},dir),null,
  'unverified clone cannot masquerade as accepted Catalog directory entry');
 assert.equal(relatedSharedCatalogItems(dir,source).length,1);
 assert.equal(TYPED_CATALOG_PUBLIC_ENABLED,false);
 assert.equal(TYPED_CATALOG_PERSONAL_READ_ENABLED,false);
 console.log('QR446_SINGLE_TYPED_ITEM_CATALOG_REFERENCE_ONLY_NO_PUBLIC_PERSONAL_WRITER_PASS');
});
test('QR446 fail closed on Version/BID/Schema and same ID from unrelated catalog',()=>{
 for(const bad of [
   {...index,t:{...index.t,platform:'Steam'}},
   {...index,t:{...index.t,gameVersion:'1.25.3'}},
   {...index,t:{...index.t,buildID:'9A239D3DB569756D'}},
   {...index,t:{...index.t,schema:626}}
 ]){
  const x=buildSharedCatalogDirectory(bad,rows,'ja');
  assert.equal(x.status,'UNAVAILABLE');
  assert.equal(resolveTypedCatalogItem(bad,rows,'40000047','ja','/web').status,'SOURCE_MISMATCH');
  assert.equal(typedSharedCatalogDirectoryHref('/web','ja',row(40000047),x),null);
 }
 const duplicated=buildSharedCatalogDirectory({...index,n:2},[rows[0],rows[0]],'ja');
 assert.equal(duplicated.entries.length,0);
 assert.equal(typedItemPreviewHref('/web','ja','40000047/17'),null);
 assert.equal(typedItemPreviewHref('/web','ja','00047'),null);
 console.log('QR446_VERSION_BID_SCHEMA_DUPLICATE_FORGED_SOURCE_ID_DENY_PASS');
});
test('QR446 four non-item types may parse but not gain canonical alias, relation or publication',()=>{
 for(const [kind,id] of [['QUEST','12345'],['CREATOR','creator-1'],['WORK','work-1'],['PRESET','preset-1']]){
  const x=nonItemPublicDetailStatus(kind,id);
  assert.equal(x.status,'SOURCE_UNVERIFIED');assert.equal(x.href,null);
  assert.equal(x.canonicalUrl,null);assert.equal(x.personalOverlay,null);
  assert.equal(x.publicIndexable,false);
 }
 const d=nonItemPublicDetailStatus('QUEST','000123');
 assert.equal(d.status,'INVALID_REF');
 console.log('QR446_UNVERIFIED_QUEST_CREATOR_WORK_PRESET_NO_PUBLIC_SEO_PASS');
});
