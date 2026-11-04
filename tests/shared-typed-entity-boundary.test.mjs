import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENTITY_KINDS, RELATION_TYPES, SHARED_TYPED_ENTITY_CONTRACT, SHARED_TYPED_PUBLIC_URL_AUTHORIZED,
  SWITCH_1250_CATALOG_SCOPE, parseTypedEntityRef, exactSourceScope, resolveTypedEntityFromCatalog,
  inspectNativeComposite, resolveUnverifiedAlias, safeTypedEntityReference
} from '../src/lib/entity/shared-typed-entity-contract.mjs';
import { SHARED_TYPED_COPY, sharedTypedCopy } from '../src/lib/entity/shared-typed-entity-copy.mjs';

const index={s:'wand.collection.runtime@1',n:1,
 t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
 f:['Furniture'],c:['TRACKED'],m:['Reference'],w:['Valley'],u:['Disney'],e:['Base'],
 l:['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'],
 wl:[['Valley','Valley','Valley','Valley','Valley','谷','谷','Vale']],
 ul:[['Disney','Disney','Disney','Disney','Disney','ディズニー','迪士尼','Disney']]};
const row=[40000047,0,0,0,[0],[0],[0],['Mickey Wardrobe','FR Wardrobe','IT Wardrobe','DE Wardrobe','ES Wardrobe','ミッキーのワードローブ','米奇衣柜','PT Wardrobe']];
const read=x=>readFileSync(x,'utf8');

test('single typed identity / source scope for five entity kinds, no public UUID or Account ID guess',()=>{
 assert.equal(SHARED_TYPED_ENTITY_CONTRACT,'wand.shared-entity.typed@1');
 assert.deepEqual(ENTITY_KINDS,['ITEM','QUEST','CREATOR','WORK','PRESET']);
 assert.equal(RELATION_TYPES.length,6);
 assert.equal(SHARED_TYPED_PUBLIC_URL_AUTHORIZED,false);
 assert.deepEqual(parseTypedEntityRef('ITEM','40000047'),{kind:'ITEM',primaryId:'40000047',secondaryId:null});
 assert.deepEqual(parseTypedEntityRef('QUEST','9123'),{kind:'QUEST',primaryId:'9123',secondaryId:null});
 assert.deepEqual(parseTypedEntityRef('WORK','test-work_1'),{kind:'WORK',primaryId:'test-work_1',secondaryId:null});
 for(const kind of ENTITY_KINDS) {
   assert.equal(parseTypedEntityRef(kind,'../../private'),null);
   assert.equal(parseTypedEntityRef(kind,'\u202efoo'),null);
 }
 for(const kind of ['ITEM','QUEST'])for(const id of ['0','001','1.5','1e9','-3','', '9007199254740992']) {
   assert.equal(parseTypedEntityRef(kind,id),null,kind+' '+id);
 }
 assert.equal(parseTypedEntityRef('WORK','00000000-0000-0000-0000-000000000001','2'),null);
 assert.equal(parseTypedEntityRef('ENTRY','123'),null);
 assert.equal(parseTypedEntityRef('CREATOR','123','456'),null);
 assert.equal(parseTypedEntityRef('PRESET','invalid@id'),null);
 assert.equal(exactSourceScope(SWITCH_1250_CATALOG_SCOPE,SWITCH_1250_CATALOG_SCOPE),true);
 assert.equal(exactSourceScope({...SWITCH_1250_CATALOG_SCOPE,fullVersion:'1.25.3'},SWITCH_1250_CATALOG_SCOPE),false);
 assert.equal(exactSourceScope({...SWITCH_1250_CATALOG_SCOPE,bid:'9A239D3DB569756D'},SWITCH_1250_CATALOG_SCOPE),false);
 assert.equal(exactSourceScope({...SWITCH_1250_CATALOG_SCOPE,schema:626},SWITCH_1250_CATALOG_SCOPE),false);
});

test('source-proven Item record only positive READ, all other entity kinds and every P/S held',()=>{
 const ok=resolveTypedEntityFromCatalog({kind:'ITEM',primaryId:'40000047',locale:'ja',index,rows:[row]});
 assert.equal(ok.status,'FOUND');
 assert.equal(ok.record.itemId,40000047);
 assert.equal(ok.record.label,'ミッキーのワードローブ');
 assert.equal(ok.source.schema,624);
 assert.equal(ok.publicIndexable,false);
 assert.equal(ok.canonicalUrl,null);
 assert.equal(ok.writerAuthorized,false);
 assert.equal(ok.personalOverlay,null);
 assert.equal(ok.relations.length,0);
 assert.equal(ok.aliases.length,0);
 for(const kind of ['QUEST','CREATOR','WORK','PRESET']) {
   const denied=resolveTypedEntityFromCatalog({kind,primaryId:kind==='QUEST'?'40000047':'40000047',locale:'ja',index,rows:[row]});
   assert.equal(denied.status,'NOT_VERIFIED',kind);
   assert.equal(denied.record,null);
   assert.equal(denied.canonicalUrl,null);
 }
 for(const scope of [{gameVersion:'1.25.3'},{buildID:'9A239D3DB569756D'},{platform:'Steam'}]){
   const changed={...index,t:{...index.t,...scope}};
   assert.equal(resolveTypedEntityFromCatalog({kind:'ITEM',primaryId:'40000047',index:changed,rows:[row]}).status,'SOURCE_MISMATCH');
 }
 assert.equal(resolveTypedEntityFromCatalog({kind:'ITEM',primaryId:'40000047',index,rows:[row,row]}).status,'AMBIGUOUS');
 assert.equal(resolveTypedEntityFromCatalog({kind:'ITEM',primaryId:'99999',index,rows:[row]}).status,'NOT_FOUND');
 assert.equal(resolveTypedEntityFromCatalog({kind:'ITEM',primaryId:'40000047',secondaryId:'123',index,rows:[row]}).status,'NOT_VERIFIED');
 assert.equal(resolveTypedEntityFromCatalog({kind:'ITEM',primaryId:'40000047',locale:'xx',index,rows:[row]}).status,'INVALID');
});

test('composite P/S requires real specialization; alias cannot redirect from numeric coincidence or label',()=>{
 const a=inspectNativeComposite('40000047','12123');
 assert.equal(a.status,'UNVERIFIED_RELATION');
 assert.equal(a.canonicalUrl,null);
 assert.equal(a.redirectUrl,null);
 assert.equal(a.record,null);
 assert.equal(a.publicIndexable,false);
 for(const pair of [['40000047','40000047'],['4','0'],['abc','2'],['0001','222']]) {
   assert.equal(inspectNativeComposite(...pair).status,'INVALID');
 }
 assert.equal(resolveUnverifiedAlias().status,'UNVERIFIED_ALIAS');
 assert.equal(resolveUnverifiedAlias().redirectUrl,null);
 assert.equal(safeTypedEntityReference('WORK','user-given-uuid').status,'NOT_VERIFIED');
 assert.equal(safeTypedEntityReference('INVALID','123'),null);
});

test('eight-locale shared gate, noindex routes and distinct public SEO/Writer boundaries',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(SHARED_TYPED_COPY).sort(),locales.sort());
 for(const loc of locales){
  const c=sharedTypedCopy(loc);
  for(const k of ['preview','unavailable','notVerified','invalid','identity','version','relations','visibility','requested','notVerifiedLabel','noSource','noRelations','private','boundary','back','composite','unknown']){
    assert.equal(typeof c[k],'string',loc+' '+k);
    assert.ok(c[k].length>=2,loc+' '+k);
  }
  for(const kind of ENTITY_KINDS)assert.ok(c.kinds[kind]);
 }
 assert.equal(sharedTypedCopy('xx'),SHARED_TYPED_COPY.en);
 const gate=read('src/lib/entity/SharedTypedEntityGate.svelte');
 for(const token of ['data-typed-entity-gate="closed"','data-public-indexable="false"','data-writer="off"','data-provider="off"','data-relations-verified="false"','data-alias-resolved="false"','data-personal-state="unknown"','noindex,nofollow']){
   assert.ok(gate.includes(token),token);
 }
 for(const p of [
  'src/routes/entity/[kind]/[primary]/+page.ts',
  'src/routes/[locale=wandLocale]/entity/[kind]/[primary]/+page.ts',
  'src/routes/[primary=sharedId]/[secondary=sharedId]/+page.ts',
  'src/routes/[locale=wandLocale]/[primary=sharedId]/[secondary=sharedId]/+page.ts'
 ]) assert.match(read(p),/prerender\s*=\s*false/);
 const accepted=read('src/lib/entity/SharedEntityDetail.svelte');
 assert.match(accepted,/SharedCatalogDiscovery/);
 assert.match(accepted,/data-shared-detail-moodboard-action="local-only"/);
 assert.match(accepted,/noindex,follow/);
});
