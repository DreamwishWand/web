import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSyntheticEntityHost,SYNTHETIC_HOST_FIXTURE_CONTRACT} from '../scripts/web-entity-http-loopback-fixture.mjs';
import {APPROVED_ENTITY_ROUTE_MANIFEST,ENTITY_PUBLISHING_ENABLED,compileEntityHostPlan} from '../src/lib/foundation/public-entity-host-contract.mjs';
const scope={platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',schema:624,sourceDigest:'a'.repeat(64)};
const sample=()=>({
 entityKind:'ITEM',visibility:'PUBLIC',rights:'ACCEPTED',privacy:'PUBLIC_OPT_IN',
 moderation:'ACCEPTED',independentQa:'PASS',publishConsent:'VERIFIED',
 rightsVersion:'SYNTHETIC',publishedRevision:'b'.repeat(64),sourceScope:{...scope},
 acceptedSourceScope:{...scope},primaryId:'40000047',secondaryId:null,
 canonicalPath:'/web/ja/40000047/',aliases:[{path:'/web/ja/40000047/old-title/',
 samePublicEntityProof:'INDEPENDENT_PASS',sourceScope:{...scope}}]
});
async function withFixture(entries,visit){
 const {server,compiled}=createSyntheticEntityHost(entries);
 await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
 const url='http://127.0.0.1:'+server.address().port;
 try{await visit(url,compiled);}finally{await new Promise((res,rej)=>server.close(err=>err?rej(err):res()));}
}
const get=(root,path,method='GET')=>fetch(root+path,{redirect:'manual',method});
test('default live product authorization is EMPTY and loopback gives real HTTP404 for direct Item/Quest',async()=>{
 assert.equal(SYNTHETIC_HOST_FIXTURE_CONTRACT,'wand.synthetic-entity-http-host@1');
 assert.deepEqual(APPROVED_ENTITY_ROUTE_MANIFEST,[]);
 assert.equal(ENTITY_PUBLISHING_ENABLED,false);
 await withFixture([],async root=>{
  const home=await get(root,'/web/');
  assert.equal(home.status,200);
  assert.match(await home.text(),/synthetic public-root transport/);
  for(const path of ['/web/ja/40000047/','/web/ja/40000047/old-title/','/web/ja/99999999/','/web/ja/entity/quest/12345/']){
   const r=await get(root,path);
   assert.equal(r.status,404,path);
   assert.equal(r.headers.get('x-robots-tag'),'noindex,nofollow');
   assert.equal(r.headers.get('x-wand-test-fixture'),'synthetic-only');
  }
  assert.equal((await get(root,'/web/ja/40000047/','POST')).status,405);
 });
});
test('real loopback GET returns transport 200 and 301 ONLY for a FULLY SYNTHETIC approved plan',async()=>{
 const record=sample();
 assert.equal(compileEntityHostPlan([record]).status,'COMPILED_ONLY');
 await withFixture([record],async(root,compiled)=>{
  assert.equal(compiled.publicEnabled,false,'host fixture never enables public release');
  assert.equal(compiled.hostAccepted,false);
  const canonical=await get(root,record.canonicalPath);
  assert.equal(canonical.status,200);
  assert.equal(canonical.headers.get('x-wand-test-fixture'),'synthetic-only');
  assert.equal(canonical.headers.get('x-robots-tag'),'noindex,nofollow');
  const body=await canonical.text();
  assert.match(body,/synthetic HTTP200 route transport only/);
  assert.doesNotMatch(body,/Mickey|Player|Owned|authToken|P1G/);
  const alias=await get(root,record.aliases[0].path);
  assert.equal(alias.status,301);
  assert.equal(alias.headers.get('location'),record.canonicalPath);
  assert.equal(alias.headers.get('x-robots-tag'),'noindex,nofollow');
  assert.equal((await get(root,'/web/ja/40000047/unproven/')).status,404);
  assert.equal((await get(root,'/web/ja/40000047/999/')).status,404);
  assert.equal((await get(root,'/web/ja/40000048/')).status,404);
  assert.equal((await get(root,'/web/ja/40000047/','POST')).status,405);
 });
});
test('bad Rights, Privacy, source BID/Schema, forged alias and P/S never start route server',()=>{
 const reject=mutate=>{
  const r=sample();mutate(r);
  assert.equal(compileEntityHostPlan([r]).status,'DENIED');
  assert.throws(()=>createSyntheticEntityHost([r]),/FIXTURE_DENIED_MANIFEST/);
 };
 reject(r=>{r.rights='UNKNOWN';});
 reject(r=>{r.privacy='PRIVATE';});
 reject(r=>{r.independentQa='PENDING';});
 reject(r=>{r.sourceScope.schema=626;});
 reject(r=>{r.sourceScope.bid='9A239D3DB569756D';});
 reject(r=>{r.aliases[0].samePublicEntityProof='UNKNOWN';});
 reject(r=>{r.aliases[0].path='/web/ja/40000048/old-title/';});
 reject(r=>{r.canonicalPath='/web/ja/40000047/999/';r.secondaryId='999';});
 const pages=readFileSync('.github/workflows/pages.yml','utf8');
 assert.ok(!pages.includes('web-entity-http-loopback-fixture'));
 assert.ok(!pages.includes('web-entity-http-host-fixture'));
 assert.ok(!pages.includes('synthetic HTTP200 route transport'));
});
