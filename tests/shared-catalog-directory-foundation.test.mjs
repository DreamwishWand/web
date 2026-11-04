import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSharedCatalogDirectory, relatedSharedCatalogItems, searchSharedCatalogDirectory,
 sharedCatalogDirectoryHref, SHARED_DIRECTORY_COPY, sharedDirectoryCopy, SHARED_DIRECTORY_WRITER_ENABLED }
 from '../src/lib/entity/shared-catalog-directory.mjs';
import { resolveSharedCatalogEntity } from '../src/lib/entity/shared-catalog-detail.mjs';

const index={s:'wand.collection.runtime@1',n:4,t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
 f:['Furniture','Fish'],c:['TRACKED'],m:['Reference'],w:['Valley','IsEternityIsle'],u:['Disney','Mickey'],e:['Base'],l:['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'],
 wl:[['Valley','Valley','Valley','Valley','Valley','谷','谷','Vale'],['Isle','Isle','Isle','Isle','Isle','島','岛','Ilha']],
 ul:[['Disney','Disney','Disney','Disney','Disney','ディズニー','迪士尼','Disney'],['Mickey','Mickey','Mickey','Mickey','Mickey','ミッキー','米奇','Mickey']]};
const row=(id,fam=0,w=[0],u=[0])=>[id,fam,0,0,w,u,[0],[`Item ${id}`,`FR ${id}`,`IT ${id}`,`DE ${id}`,`ES ${id}`,`JA ${id}`,`ZH ${id}`,`PT ${id}`]];
const rows=[row(31700014),row(31700015),row(31700016,0,[1],[1]),row(31700017,1)];
const read=p=>readFileSync(p,'utf8');

test('shared directory exposes typed verified 1.25.0 Item IDs with strict same-version search/facets/related',()=>{
 const d=buildSharedCatalogDirectory(index,rows,'ja');
 assert.equal(d.status,'READY');
 assert.equal(d.entries.length,4);
 assert.equal(d.entries[0].label,'JA 31700014');
 assert.deepEqual(d.source,index.t);
 assert.equal(searchSharedCatalogDirectory(d,{query:'31700014'}).total,1);
 assert.equal(searchSharedCatalogDirectory(d,{query:'31700014',family:'Fish'}).total,0);
 assert.equal(searchSharedCatalogDirectory(d,{family:'Furniture',world:'Valley'}).total,2);
 assert.equal(searchSharedCatalogDirectory(d,{universe:'Mickey'}).total,1);
 assert.equal(relatedSharedCatalogItems(d,d.entries[0]).map(x=>x.itemId).join(','),'31700015');
 assert.equal(sharedCatalogDirectoryHref('/web','ja',d.entries[0]),'/web/ja/31700014/');
 assert.equal(SHARED_DIRECTORY_WRITER_ENABLED,false);
});

test('unknown, bad IDs, duplicate IDs, private/unverified/foreign Version cannot acquire shared links',()=>{
 for(const bad of ['0','-1','001','1e3','12345678901234567890'])
  assert.equal(sharedCatalogDirectoryHref('', 'en', {itemId:bad}),null,bad);
 assert.equal(sharedCatalogDirectoryHref('', 'xx', {itemId:31700014}),null);
 assert.equal(sharedCatalogDirectoryHref('', 'en', {itemId:undefined}),null);
 const duplicated=[rows[0],rows[0],rows[2],rows[3]];
 const d=buildSharedCatalogDirectory(index,duplicated,'en');
 assert.equal(d.status,'READY');
 assert.equal(d.ambiguousCount,2);
 assert.equal(searchSharedCatalogDirectory(d,{query:'31700014'}).total,0);
 assert.equal(resolveSharedCatalogEntity(index,duplicated,'31700014','en').status,'AMBIGUOUS');
 assert.equal(resolveSharedCatalogEntity(index,rows,'99999999','en').status,'NOT_FOUND');
 for(const t of [{...index.t,gameVersion:'1.25.3'},{...index.t,buildID:'UNKNOWN'},{...index.t,platform:'Steam'}]){
   const no=buildSharedCatalogDirectory({...index,t},rows,'en');
   assert.equal(no.status,'UNAVAILABLE');
   assert.equal(searchSharedCatalogDirectory(no,{query:'31700014'}).items.length,0);
 }
 assert.equal(buildSharedCatalogDirectory({...index,n:5},rows,'en').status,'UNAVAILABLE');
 assert.equal(searchSharedCatalogDirectory(buildSharedCatalogDirectory(index,rows,'en'),{query:'x'.repeat(121)}).status,'UNAVAILABLE');
});

test('eight supported locales and fallback do not invent personal owned or public publication',()=>{
 const codes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(SHARED_DIRECTORY_COPY).sort(),codes.sort());
 for(const code of codes){
   const c=sharedDirectoryCopy(code);
   for(const key of ['search','family','world','universe','related','results','source','empty','disabled','detail','id','private','more'])
    assert.equal(typeof c[key],'string',code+'/'+key);
   assert.equal(buildSharedCatalogDirectory(index,rows,code).status,'READY');
 }
 assert.deepEqual(sharedDirectoryCopy('xx'),sharedDirectoryCopy('en'));
 for(const p of ['src/routes/[primary=sharedId]/+page.ts','src/routes/[locale=wandLocale]/[primary=sharedId]/+page.ts'])
   assert.match(read(p),/prerender\s*=\s*false/,'Dynamic page must not claim static 200');
 assert.match(read('src/lib/entity/SharedEntityDetail.svelte'),/noindex,follow/);
 assert.match(read('src/routes/editor/items/+page.svelte'),/noindex,follow/);
 assert.match(read('src/routes/editor/items/+page.svelte'),/data-owned="unknown"/);
 assert.ok(!read('src/routes/editor/items/+page.svelte').includes('const samples = ['));
 assert.match(read('src/lib/entity/SharedCatalogDiscovery.svelte'),/data-public-indexable="false"/);
 assert.match(read('src/lib/entity/SharedCatalogDiscovery.svelte'),/data-personal-state="unknown"/);
});

test('shared detail composition retains one Moodboard API and source proof',()=>{
 const detail=read('src/lib/entity/SharedEntityDetail.svelte');
 assert.match(detail,/SharedCatalogDiscovery/);
 assert.match(detail,/data-entity-identity="source-bound"/);
 assert.match(detail,/52BD625D9B4E0053/);
 assert.match(detail,/addCatalogEntityToMoodboard/);
 assert.match(detail,/parseMoodboardDocument/);
 assert.match(detail,/MOODBOARD_BACKUP_KEY/);
 assert.match(detail,/data-shared-detail-moodboard-action="local-only"/);
 assert.ok(!detail.includes('setOwned('));
 assert.ok(!detail.includes('publishWork('));
});
