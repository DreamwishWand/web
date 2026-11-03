import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSharedPrimaryId, sharedEntityHref, resolveSharedCatalogEntity, sharedEntityLabels, SUPPORTED_DETAIL_LOCALES } from '../src/lib/entity/shared-catalog-detail.mjs';
const locales=['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'];
const index={s:'wand.collection.runtime@1',t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},f:['Furniture'],c:['TRACKED'],m:['Reference'],w:['Valley'],u:['Universe'],e:['Base'],l:locales,wl:[locales],ul:[locales]};
const record=[31700014,0,0,0,[0],[0],[0],['Softwood','Bois tendre','Legno tenero','Weichholz','Madera blanda','軟材','软木','Madeira macia']];
test('stable ID and 8 locale link construction is strict and product-neutral',()=>{
 assert.equal(parseSharedPrimaryId('31700014'),31700014);
 for(const bad of ['0','0001','3/1','1e2','-1','12345678901234567890','undefined',''])assert.equal(parseSharedPrimaryId(bad),null);
 assert.equal(sharedEntityHref('/web','ja','31700014'),'/web/ja/31700014/');
 assert.equal(sharedEntityHref('','en',31700014),'/en/31700014/');
 assert.equal(SUPPORTED_DETAIL_LOCALES.length,8);
 for(const l of SUPPORTED_DETAIL_LOCALES)assert.ok(sharedEntityLabels(l).detail);
 assert.throws(()=>sharedEntityHref('/web','xx','31700014'));
});
test('shared source uses catalog, no owned assumptions nor SEO promotion',()=>{
 const a=resolveSharedCatalogEntity(index,[record],'31700014','ja');
 assert.equal(a.status,'FOUND');
 assert.equal(a.item.label,'軟材');
 assert.equal(a.item.itemId,31700014);
 assert.equal(a.saveState,null);
 assert.equal(a.publicIndexable,false);
 assert.equal(a.aliasesVerified,false);
 assert.equal(a.relationsVerified,false);
 assert.equal(a.canExplore,false);
});
test('unknown/duplicate/version mismatch fail closed',()=>{
 assert.equal(resolveSharedCatalogEntity(index,[], '31700014','en').status,'NOT_FOUND');
 assert.equal(resolveSharedCatalogEntity(index,[record,record], '31700014','en').status,'AMBIGUOUS');
 assert.equal(resolveSharedCatalogEntity({...index,t:{...index.t,gameVersion:'1.25.3'}},[record], '31700014','en').status,'UNAVAILABLE');
 assert.equal(resolveSharedCatalogEntity(index,[record], '31700014','xx').status,'UNAVAILABLE');
});
