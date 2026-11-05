// 04 QR-W independent NEW-HEAD only: PR446 original QA462 explicit schema626 directory TRUE RED.
// No 8-locale Chrome rerun; only newly changed directory and tests are under review.
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {buildSharedCatalogDirectory,searchSharedCatalogDirectory,typedSharedCatalogDirectoryHref,
 SHARED_DIRECTORY_WRITER_ENABLED} from '../src/lib/entity/shared-catalog-directory.mjs';
import {CATALOG_SOURCE_SCOPE,resolveTypedCatalogItem,
 TYPED_CATALOG_PUBLIC_ENABLED,TYPED_CATALOG_PERSONAL_READ_ENABLED} from '../src/lib/foundation/typed-entity-page-consumer.mjs';
const SOURCE='282ecff4fa4836d53adff30ad634fdde5b422d55';
const RED_HEAD='ef2c0c0ef75a34099a8dd3e284396d98aabe654b';
const sourceFiles=['src/lib/entity/shared-catalog-directory.mjs','tests/web-typed-entity-consumers.test.mjs'].sort();
const qaFiles=['.github/workflows/04qr-w-pr446-schema626-boundary-independent.yml',
 'tests/04qr-w-pr446-schema626-boundary-independent.test.mjs'].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const locales=['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR'];
const names=['Valley','Vallée','Valle','Tal','Valle','谷','山谷','Vale'];
const itemLabels=id=>locales.map((_,i)=>i===5?'家具 '+id:'Item '+id);
const data={
 s:'wand.collection.runtime@1',n:2,
 t:{platform:'Nintendo Switch',gameVersion:'1.25.0',buildID:'52BD625D9B4E0053'},
 f:['Furniture'],c:['TRACKED'],m:['Reference'],w:['Valley'],u:['Disney'],e:['Base'],l:locales,
 wl:[names],ul:[['Disney','Disney','Disney','Disney','Disney','ディズニー','迪士尼','Disney']]
};
const rows=[
 [40000047,0,0,0,[0],[0],[0],itemLabels(40000047)],
 [40000048,0,0,0,[0],[0],[0],itemLabels(40000048)]
];
const source=t=>({...data,t:{...data.t,...t}});
test('previous independent RED Source has precisely two changed files, QA only two and expected Git blobs',()=>{
 assert.equal(git('merge-base',RED_HEAD,SOURCE),RED_HEAD);
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(git('diff','--name-only',RED_HEAD,SOURCE).trim().split('\n').sort(),sourceFiles);
 assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').trim().split('\n').sort(),qaFiles);
 assert.equal(git('rev-parse',SOURCE+':src/lib/entity/shared-catalog-directory.mjs'),
  '5f20b4f8e33157b33d020a8991f2361bdc397ab3');
 assert.equal(git('rev-parse',SOURCE+':tests/web-typed-entity-consumers.test.mjs'),
  '00af8bd662fc9dbf1f38d70f15d44b04a09dacd9');
 assert.equal(git('diff','--name-only',RED_HEAD,SOURCE,'--','src/routes/','src/lib/foundation/',
  'src/lib/entity/shared-entity-identity.mjs','supabase/','.github/workflows/'),'');
});
test('old static reference with omitted schema and explicit matching numeric624 remain reference-only',()=>{
 const absent=buildSharedCatalogDirectory(data,rows,'ja');
 const numeric=buildSharedCatalogDirectory(source({schema:624}),rows,'ja');
 for(const d of [absent,numeric]){
  assert.equal(d.status,'READY');
  assert.equal(d.entries.length,2);
  assert.equal(Object.isFrozen(d),true);
  assert.equal(searchSharedCatalogDirectory(d,{query:'40000047'}).total,1);
  assert.equal(typedSharedCatalogDirectoryHref('/web','ja',d.entries[0],d),'/web/ja/40000047/');
  assert.equal(d.source.schema,undefined,'Directory does not claim schema from unverified source');
  assert.equal(resolveTypedCatalogItem(data,rows,'40000047','ja','/web').status,'FOUND_REFERENCE_ONLY');
 }
 assert.equal(CATALOG_SOURCE_SCOPE.schema,624);
 assert.equal(CATALOG_SOURCE_SCOPE.bid,'52BD625D9B4E0053');
 assert.equal(SHARED_DIRECTORY_WRITER_ENABLED,false);
 assert.equal(TYPED_CATALOG_PUBLIC_ENABLED,false);
 assert.equal(TYPED_CATALOG_PERSONAL_READ_ENABLED,false);
});
test('explicit mismatched schema626 and invalid types fail closed across directory, search, typed link and detail',()=>{
 const good=buildSharedCatalogDirectory(data,rows,'ja');
 assert.equal(good.status,'READY');
 const foreignSchemas=[626,625,0,-1,'624',null,{},[624],new Number(624),NaN,Infinity];
 for(const schema of foreignSchemas){
  const f=source({schema});
  const dir=buildSharedCatalogDirectory(f,rows,'ja');
  assert.equal(dir.status,'UNAVAILABLE','schema='+String(schema));
  assert.deepEqual(dir.entries,[]);
  assert.equal(dir.source,null);
  assert.equal(Object.isFrozen(dir),true);
  assert.equal(searchSharedCatalogDirectory(dir,{query:'40000047'}).status,'UNAVAILABLE');
  assert.equal(typedSharedCatalogDirectoryHref('/web','ja',good.entries[0],dir),null);
  assert.equal(resolveTypedCatalogItem(f,rows,'40000047','ja','/web').status,'SOURCE_MISMATCH');
 }
});
test('no forged cross-BID/version or unverified public index, aliases, Writer or personal overlay',()=>{
 for(const [field,value] of [['buildID','9A239D3DB569756D'],['gameVersion','1.25.3'],['platform','Steam']]){
  const f=source({[field]:value});
  const dir=buildSharedCatalogDirectory(f,rows,'ja');
  assert.equal(dir.status,'UNAVAILABLE');
  assert.equal(dir.entries.length,0);
  assert.equal(typedSharedCatalogDirectoryHref('/web','ja',rows[0],dir),null);
 }
 const accepted=resolveTypedCatalogItem(data,rows,'40000047','ja','/web');
 assert.equal(accepted.publicIndexable,false);
 assert.equal(accepted.canonicalUrl,null);
 assert.equal(accepted.personalOverlay,null);
 assert.equal(accepted.writerAuthorized,false);
 assert.deepEqual(accepted.aliases,[]);
 assert.equal(typedSharedCatalogDirectoryHref('/web','ja',{itemId:40000047},
  buildSharedCatalogDirectory(data,rows,'ja')),null,'cloned or spoofed item is not a directory row');
 const owner=readFileSync('src/lib/entity/shared-catalog-directory.mjs','utf8');
 assert.match(owner,/index\?\.t\?\.schema !== undefined && index\.t\.schema !== CATALOG_SOURCE_SCOPE\.schema/);
 const ci=readFileSync('.github/workflows/04qr-w-pr446-schema626-boundary-independent.yml','utf8');
 assert.match(ci,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.doesNotMatch(ci,/secrets\.|deploy-pages|workflow_dispatch|pull_request_target|git push|write-all/);
});
