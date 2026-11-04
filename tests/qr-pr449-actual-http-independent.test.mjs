import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticEntityHost} from '../scripts/web-entity-http-loopback-fixture.mjs';
import {APPROVED_ENTITY_ROUTE_MANIFEST,ENTITY_PUBLISHING_ENABLED} from '../src/lib/foundation/public-entity-host-contract.mjs';
const scope={platform:'Nintendo Switch',fullVersion:'1.25.0',bid:'52BD625D9B4E0053',
 schema:624,sourceDigest:'f'.repeat(64)};
function eligible() {
 return {entityKind:'ITEM',visibility:'PUBLIC',rights:'ACCEPTED',privacy:'PUBLIC_OPT_IN',
  moderation:'ACCEPTED',independentQa:'PASS',publishConsent:'VERIFIED',
  rightsVersion:'QR_SYNTHETIC',publishedRevision:'a'.repeat(64),
  sourceScope:{...scope},acceptedSourceScope:{...scope},primaryId:'40000047',
  secondaryId:null,canonicalPath:'/web/ja/40000047/',
  aliases:[{path:'/web/ja/40000047/test-alias/',samePublicEntityProof:'INDEPENDENT_PASS',sourceScope:{...scope}}]};
}
async function run(entries,check){
 const {server,compiled}=createSyntheticEntityHost(entries);
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 const host='http://127.0.0.1:'+server.address().port;
 try{await check(host,compiled);}finally{await new Promise(resolve=>server.close(resolve));}
}
const request=(host,path,method='GET')=>fetch(host+path,{redirect:'manual',method});
test('QR449 real loopback default manifest empty never converts source candidate to real public 200/301',async()=>{
 assert.equal(ENTITY_PUBLISHING_ENABLED,false);
 assert.deepEqual(APPROVED_ENTITY_ROUTE_MANIFEST,[]);
 await run([],async host=>{
  for(const path of ['/web/ja/40000047/','/web/ja/40000047/test-alias/','/web/ja/2070000620/','/web/xx/40000047/']){
   const res=await request(host,path);
   assert.equal(res.status,404,path);
   assert.equal(res.headers.get('x-robots-tag'),'noindex,nofollow');
   assert.equal(res.headers.get('x-wand-test-fixture'),'synthetic-only');
   assert.equal(res.headers.get('location'),null);
  }
  assert.equal((await request(host,'/web/ja/40000047/','POST')).status,405);
 });
 console.log('QR449_EMPTY_MANIFEST_ACTUAL_LOCAL_HTTP404_NO_PUBLIC_HOST_PASS');
});
test('QR449 synthetic eligible route returns REAL loopback HTTP200 and alias301 only as noindex fixture',async()=>{
 await run([eligible()],async(host,plan)=>{
  assert.equal(plan.publicEnabled,false);
  assert.equal(plan.hostAccepted,false);
  const page=await request(host,'/web/ja/40000047/');
  assert.equal(page.status,200);
  assert.equal(page.headers.get('x-robots-tag'),'noindex,nofollow');
  assert.equal(page.headers.get('x-wand-test-fixture'),'synthetic-only');
  assert.equal(page.headers.get('cache-control'),'no-store');
  assert.match(await page.text(),/synthetic HTTP200 route transport only/);
  const alias=await request(host,'/web/ja/40000047/test-alias/');
  assert.equal(alias.status,301);
  assert.equal(alias.headers.get('location'),'/web/ja/40000047/');
  assert.equal(alias.headers.get('x-robots-tag'),'noindex,nofollow');
  for(const path of ['/web/ja/40000048/','/web/ja/40000047/unverified/','/web/ja/40000047/17/']){
   assert.equal((await request(host,path)).status,404,path);
  }
  for(const method of ['HEAD','POST','PUT','DELETE']){
   assert.equal((await request(host,'/web/ja/40000047/',method)).status,405,method);
  }
 });
 console.log('QR449_REAL_LOOPBACK_SYNTHETIC_200_301_404_METHOD405_NO_PUBLIC_RIGHTS_PASS');
});
test('QR449 identical real HTTP route cannot be opened on forged privacy/BID/alias/specialization',()=>{
 const reject=mutate=>{
  const e=eligible();mutate(e);
  assert.throws(()=>createSyntheticEntityHost([e]),/FIXTURE_DENIED_MANIFEST/);
 };
 reject(e=>e.rights='UNKNOWN');
 reject(e=>e.privacy='PRIVATE');
 reject(e=>e.visibility='PRIVATE');
 reject(e=>e.publishConsent='SELF_ASSERTED');
 reject(e=>e.moderation='PENDING');
 reject(e=>e.independentQa='OWNER_CI_ONLY');
 reject(e=>e.sourceScope={...scope,schema:626});
 reject(e=>e.sourceScope={...scope,bid:'9A239D3DB569756D'});
 reject(e=>e.acceptedSourceScope={...scope,sourceDigest:'e'.repeat(64)});
 reject(e=>e.aliases[0].samePublicEntityProof='CLAIMED');
 reject(e=>e.aliases[0].sourceScope={...scope,fullVersion:'1.25.3'});
 reject(e=>e.aliases[0].path='/web/ja/40000048/test-alias/');
 reject(e=>{e.secondaryId='17';e.canonicalPath='/web/ja/40000047/17/';});
 console.log('QR449_RIGHTS_PRIVACY_VERSION_P_S_ALIAS_FAILCLOSED_PASS');
});
