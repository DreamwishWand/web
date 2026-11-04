import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeEntityRef,nativeEntityPath,entityRefKey,createSharedEntityRegistry} from '../src/lib/entity/shared-entity-identity.mjs';
import {sharedEntityHref} from '../src/lib/entity/shared-catalog-detail.mjs';
import {buildSharedCatalogDirectory,sharedCatalogDirectoryHref,typedSharedCatalogDirectoryHref,
 relatedSharedCatalogItems,searchSharedCatalogDirectory} from '../src/lib/entity/shared-catalog-directory.mjs';
import {CATALOG_SOURCE_SCOPE,TYPED_CATALOG_PUBLIC_ENABLED,TYPED_CATALOG_PERSONAL_READ_ENABLED,
 typedItemPreviewHref,resolveTypedCatalogItem,typedDirectoryItemHref,nonItemPublicDetailStatus} from '../src/lib/foundation/typed-entity-page-consumer.mjs';

const read=p=>readFileSync(p,'utf8');
const index={s:'wand.collection.runtime@1',n:4,t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
f:['Furniture','Fish'],c:['TRACKED'],m:['Reference'],w:['Valley','IsEternityIsle'],u:['Disney','Mickey'],e:['Base'],l:['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'],
wl:[['Valley','Valley','Valley','Valley','Valley','谷','谷','Vale'],['Isle','Isle','Isle','Isle','Isle','島','岛','Ilha']],
ul:[['Disney','Disney','Disney','Disney','Disney','ディズニー','迪士尼','Disney'],['Mickey','Mickey','Mickey','Mickey','Mickey','ミッキー','米奇','Mickey']]};
const row=(id,fam=0,w=[0],u=[0])=>[id,fam,0,0,w,u,[0],[`Item ${id}`,`FR ${id}`,`IT ${id}`,`DE ${id}`,`ES ${id}`,`JA ${id}`,`ZH ${id}`,`PT ${id}`]];
const rows=[row(40000047),row(40000048),row(40000049,0,[1],[1]),row(31700017,1)];
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
test('one 06 PRODUCT EntityRef identity backs all Item browse search and related links',()=>{
 const source=buildSharedCatalogDirectory(index,rows,'ja');
 assert.equal(source.status,'READY');
 const ref=makeEntityRef({kind:'ITEM',primaryId:'40000047'});
 assert.equal(entityRefKey(ref),JSON.stringify(['ITEM','40000047',null]));
 assert.equal(CATALOG_SOURCE_SCOPE.schema,624);
 assert.equal(CATALOG_SOURCE_SCOPE.bid,'52BD625D9B4E0053');
 assert.equal(TYPED_CATALOG_PUBLIC_ENABLED,false);
 assert.equal(TYPED_CATALOG_PERSONAL_READ_ENABLED,false);
 const page=resolveTypedCatalogItem(index,rows,'40000047','ja','/web');
 assert.equal(page.status,'FOUND_REFERENCE_ONLY');
 assert.deepEqual(page.ref,ref);
 assert.equal(page.href,'/web/ja/40000047/');
 assert.equal(page.record.itemId,40000047);
 for(const k of ['publicIndexable','writerAuthorized'])assert.equal(page[k],false);
 for(const k of ['canonicalUrl','personalOverlay'])assert.equal(page[k],null);
 assert.deepEqual(page.relations,[]);
 assert.deepEqual(page.aliases,[]);
 assert.deepEqual(relatedSharedCatalogItems(source,source.entries[0]).map(x=>x.itemId),[40000048]);
 assert.equal(searchSharedCatalogDirectory(source,{query:'40000047'}).total,1);
 assert.equal(typedSharedCatalogDirectoryHref('/web','ja',source.entries[0],source),page.href);
 assert.equal(sharedCatalogDirectoryHref('/web','ja',source.entries[0]),page.href);
 assert.equal(typedDirectoryItemHref('/web','ja',{itemId:40000047},source),null);
 assert.equal(typedSharedCatalogDirectoryHref('/web','ja',source.entries[0],buildSharedCatalogDirectory({...index,t:{...index.t,gameVersion:'1.25.3'}},rows,'ja')),null);
});
test('eight real locale Item links equal PR396 native candidates, never public canonical or alias/Writer',()=>{
 for(const locale of locales) {
  const ref=makeEntityRef({kind:'ITEM',primaryId:'40000047'});
  const expected=nativeEntityPath(ref,locale,{base:'/web'});
  assert.equal(typedItemPreviewHref('/web',locale,'40000047'),expected);
  assert.equal(typedItemPreviewHref('/web',locale,'40000047'),sharedEntityHref('/web',locale,'40000047'));
  const page=resolveTypedCatalogItem(index,rows,'40000047',locale,'/web');
  assert.equal(page.status,'FOUND_REFERENCE_ONLY');
  assert.equal(page.href,expected);
  assert.equal(page.canonicalUrl,null);
  assert.equal(page.publicIndexable,false);
 }
 for(const bad of ['001','0','-1','1e4','40000047/1','9007199254740992','<script>'])
  assert.equal(typedItemPreviewHref('/web','ja',bad),null,bad);
 assert.equal(typedItemPreviewHref('/web','jp','40000047'),null);
 assert.equal(typedItemPreviewHref('/web','ja','40000047/9001'),null);
});
test('duplicate/unknown/foreign Version + schema refuse typed item detail and search leakage',()=>{
 assert.equal(resolveTypedCatalogItem(index,rows,'999999999','ja').status,'NOT_FOUND');
 assert.equal(resolveTypedCatalogItem(index,[rows[0],rows[0]],'40000047','ja').status,'AMBIGUOUS');
 for(const t of [{gameVersion:'1.25.3'},{buildID:'9A239D3DB569756D'},{schema:626},{platform:'Steam'}]){
  assert.equal(resolveTypedCatalogItem({...index,t:{...index.t,...t}},rows,'40000047','ja').status,'SOURCE_MISMATCH');
 }
 assert.equal(resolveTypedCatalogItem(index,rows,'000047','ja').status,'INVALID_REF_OR_LOCALE');
});
test('unverified Quest/Creator/Work/Preset use canonical type grammar but have NO public details',()=>{
 for(const [kind,id] of [['QUEST','12345'],['CREATOR','creator-id_1'],['WORK','work-id_2'],['PRESET','preset-id_3']]){
  const x=nonItemPublicDetailStatus(kind,id);
  assert.equal(x.status,'SOURCE_UNVERIFIED');
  assert.equal(x.ref.kind,kind);
  assert.equal(x.publicIndexable,false);
  assert.equal(x.href,null);
  assert.equal(x.canonicalUrl,null);
 }
 for(const [kind,id] of [['QUEST','bad'],['CREATOR','../hidden'],['WORK','<>'],['PRESET','']]){
  assert.equal(nonItemPublicDetailStatus(kind,id).status,'INVALID_REF');
 }
 const conflict=createSharedEntityRegistry([]);
 assert.equal(conflict.resolveNative('40000047',null,CATALOG_SOURCE_SCOPE).status,'NOT_FOUND');
 const gate=read('src/lib/foundation/SharedTypedEntityGate.svelte');
 assert.match(gate,/nonItemPublicDetailStatus/);
 assert.match(gate,/data-public-indexable="false"/);
 assert.match(gate,/noindex,nofollow/);
 const shared=read('src/lib/entity/SharedCatalogDiscovery.svelte');
 assert.match(shared,/typedSharedCatalogDirectoryHref\(base, localeCode, item, directory\)/);
 assert.match(read('src/lib/entity/SharedEntityDetail.svelte'),/data-writer="off"/);
});
