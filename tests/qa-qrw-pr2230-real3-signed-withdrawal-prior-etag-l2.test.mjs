// 04 QR-W independent actual 09INT signed Media batch verifier PR2230, fixed Source b1871a.
// Previously observed real CDN validators are public historical QA evidence, NOT new signed ON
// provenance. The test uses a throwaway synthetic registry in /tmp. No CDN withdrawal occurs.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
  readBatch,verifyLive,pathFor
} from '../scripts/int-steam-public-media-signed-batch.mjs';

const originalScript=fileURLToPath(new URL('../scripts/int-steam-public-media-signed-batch.mjs',import.meta.url));
const trustedRegistry=fileURLToPath(new URL('../ops/ddv-steam-public-media-prior-on-cache.json',import.meta.url));
const base='https://dreamwishwand.github.io/web/';
const snapshot=readBatch(),images=snapshot.items;
const date='Wed, 18 Nov 2026 11:38:36 GMT';
const etags={
 '40300045':'"6afd8e3c-3bce"',
 '40006110':'"6afd8e3c-6e10"',
 '40005160':'"6afd8e3c-16a4"'
};
const sandbox=mkdtempSync(join(tmpdir(),'qrw-int-pr2230-'));
after(()=>rmSync(sandbox,{recursive:true,force:true}));
assert.deepEqual(images.map(i=>i.itemId).sort(),Object.keys(etags).sort(),
  'Actual signed Steam public3 immutable ItemID set, not a new media batch');
const from=(item,etag=etags[item.itemId])=>({
 itemId:item.itemId,sha256:item.sha256,etag,lastModified:date,
 protectedCommit:'d37a774a8ce2ac08ef05389f0d14d3442063edeb',
 pagesRunId:44295999572,observerRunId:44307835397,
 signedBundleSha256:'a'.repeat(64),releaseState:'SIGNED_PAGES_ON_OBSERVED',
 recordedBy:'09_INT_PROTECTED_MAIN'
});
const withdrawal=items=>({...structuredClone(snapshot),items:[],withdrawn:items.map(({itemId,sha256})=>({itemId,sha256}))});
let seq=0;
async function isolated(records) {
 const dir=join(sandbox,'fixture-'+(++seq));
 mkdirSync(join(dir,'scripts'),{recursive:true});
 mkdirSync(join(dir,'ops'),{recursive:true});
 const source=join(dir,'scripts','int-steam-public-media-signed-batch.mjs');
 const reg=join(dir,'ops','ddv-steam-public-media-prior-on-cache.json');
 copyFileSync(originalScript,source);
 writeFileSync(reg,JSON.stringify({schema:'wand.int.steam-public-signed-prior-on-cache@1',records}));
 const module=await import(pathToFileURL(source).href);
 return {module,source,reg};
}
const fetchRequests=[];
function mock(status) {
 fetchRequests.length=0;
 return async(url,{method,headers,redirect})=>{
  fetchRequests.push({url,method,headers,redirect});
  assert.equal(redirect,'manual');
  assert.match(url,/^https:\/\/dreamwishwand\.github\.io\/web\/ddv\/item-images\/steam-1\.25\.3-schema626-lossless160-v1\//);
  const s=typeof status==='function'?status({url,method,headers}):status;
  return new Response(null,{status:s});
 };
}
test('actual current protected prior-on anchor empty rejects ALL 3 public item withdrawal requests before ANY HTTP',async()=>{
 const records=JSON.parse(readFileSync(trustedRegistry));
 assert.equal(records.schema,'wand.int.steam-public-signed-prior-on-cache@1');
 assert.deepEqual(records.records,[]);
 for(const subset of [images.slice(0,1),images]){
  let calls=0;
  await assert.rejects(verifyLive(withdrawal(subset),base,async()=>{
   calls++;return new Response(null,{status:404});
  }),/WITHDRAWAL_PRIOR_REAL_ON_VALIDATORS_REQUIRED/);
  assert.equal(calls,0);
 }
});
test('actual original Source resolves previous observed 3 real distinct ETags + common date; 404 or 410 all conditions',async()=>{
 const {module}=await isolated(images.map(i=>from(i)));
 for(const status of [404,410]){
  const result=await module.verifyLive(withdrawal(images),base,mock(status));
  assert.deepEqual(result,{publicItems:0,withdrawn:3});
  assert.equal(fetchRequests.length,12);
  for(const item of images){
   const url=new URL(pathFor(item.sha256),base).href;
   const itemCalls=fetchRequests.filter(r=>r.url===url);
   assert.deepEqual(itemCalls.map(x=>x.method),['GET','HEAD','GET','GET']);
   assert.equal(itemCalls[2].headers['If-None-Match'],etags[item.itemId]);
   assert.equal(itemCalls[3].headers['If-Modified-Since'],date);
   assert.equal(itemCalls.some(r=>r.headers['If-None-Match']==='"stale"'),false);
  }
 }
});
test('each genuinely observed old image ETag returning conditional 304 must DENY withdrawal, not accept 404 for fabricated stale header',async()=>{
 const {module}=await isolated(images.map(i=>from(i)));
 for(const item of images){
  const exactUrl=new URL(pathFor(item.sha256),base).href;
  const fn=mock(({url,headers})=>url===exactUrl&&headers['If-None-Match']===etags[item.itemId]?304:404);
  await assert.rejects(module.verifyLive(withdrawal(images),base,fn),/WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED_304/);
  assert(fetchRequests.some(r=>r.url===exactUrl&&r.headers['If-None-Match']===etags[item.itemId]));
 }
});
test('each genuinely observed Last-Modified 304 individually also DENIES even when normal GET/HEAD are 404',async()=>{
 const {module}=await isolated(images.map(i=>from(i)));
 for(const item of images){
  const exactUrl=new URL(pathFor(item.sha256),base).href;
  await assert.rejects(module.verifyLive(withdrawal(images),base,
   mock(({url,headers})=>url===exactUrl&&headers['If-Modified-Since']===date?304:404)),
   /WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED_304/);
  assert(fetchRequests.some(r=>r.url===exactUrl&&r.headers['If-Modified-Since']===date));
 }
});
test('any missing original per-image history, wrong exact ItemID or SHA fails before ANY HTTP; other valid image history is not transferable',async()=>{
 for(const item of images){
  for(const variant of ['missing','other-id','wrong-sha']){
   let rec=images.map(i=>from(i));
   if(variant==='missing')rec=rec.filter(r=>r.itemId!==item.itemId);
   else if(variant==='other-id')rec=rec.map(r=>r.itemId===item.itemId?{...r,itemId:'99999999'}:r);
   else rec=rec.map(r=>r.itemId===item.itemId?{...r,sha256:'b'.repeat(64)}:r);
   const {module}=await isolated(rec);
   let calls=0;
   await assert.rejects(module.verifyLive(withdrawal(images),base,async()=>{
    calls++;return new Response(null,{status:404});
   }),/WITHDRAWAL_PRIOR_REAL_ON_VALIDATORS_REQUIRED/);
   assert.equal(calls,0,item.itemId+' '+variant);
  }
 }
});
test('multiple genuine earlier validator generations for same ItemID+SHA all replayed; overlooked older 304 blocks',async()=>{
 const subject=images[0],old='"prior-generation-earlier"';
 const {module}=await isolated([from(subject),from(subject,old)]);
 const checked=await module.verifyLive(withdrawal([subject]),base,mock(404));
 assert.deepEqual(checked,{publicItems:0,withdrawn:1});
 assert.equal(fetchRequests.length,6);
 assert(fetchRequests.some(r=>r.headers['If-None-Match']===old));
 assert(fetchRequests.some(r=>r.headers['If-None-Match']===etags[subject.itemId]));
 await assert.rejects(module.verifyLive(withdrawal([subject]),base,
  mock(({headers})=>headers['If-None-Match']===old?304:404)),
  /WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED_304/);
});
test('on disk original source import rejects forged, duplicated or malformed protected registry rather than allowing caller injection',async()=>{
 const baseRecord=from(images[0]);
 const mutators=[
  [r=>({...r,etag:'"injected\r\nX: yes"'}),/PRIOR_ON_ETAG_INVALID/],
  [r=>({...r,lastModified:'Mon, 18 Nov 2026 11:38:36 GMT'}),/PRIOR_ON_DATE_INVALID/],
  [r=>({...r,lastModified:'Wed, 31 Nov 2026 11:38:36 GMT'}),/PRIOR_ON_DATE_INVALID/],
  [r=>({...r,recordedBy:'CALLER_SUPPLIED'}),/PRIOR_ON_ISSUER_INVALID/],
  [r=>({...r,releaseState:'OFF_OR_UNKNOWN'}),/PRIOR_ON_STATE_INVALID/],
  [r=>({...r,pagesRunId:0}),/PRIOR_ON_PAGES_RUN_INVALID/],
  [r=>({...r,protectedCommit:'A'.repeat(40)}),/PRIOR_ON_PROTECTED_COMMIT_INVALID/],
  [r=>({...r,signedBundleSha256:'not-a-digest'}),/PRIOR_ON_SIGNED_BUNDLE_INVALID/],
  [r=>({...r,userClaimsRights:true}),/PRIOR_ON_CACHE_ENTRY_FIELDS/]
 ];
 for(const [mutation,regex] of mutators){
  const records=[mutation(baseRecord)];
  const dir=join(sandbox,'bad-'+(++seq));
  mkdirSync(join(dir,'scripts'),{recursive:true});mkdirSync(join(dir,'ops'),{recursive:true});
  const source=join(dir,'scripts','int-steam-public-media-signed-batch.mjs');
  copyFileSync(originalScript,source);
  writeFileSync(join(dir,'ops','ddv-steam-public-media-prior-on-cache.json'),
   JSON.stringify({schema:'wand.int.steam-public-signed-prior-on-cache@1',records}));
  await assert.rejects(import(pathToFileURL(source).href),regex);
 }
 const dir=join(sandbox,'duplicate-'+(++seq));
 mkdirSync(join(dir,'scripts'),{recursive:true});mkdirSync(join(dir,'ops'),{recursive:true});
 const source=join(dir,'scripts','int-steam-public-media-signed-batch.mjs');
 copyFileSync(originalScript,source);
 writeFileSync(join(dir,'ops','ddv-steam-public-media-prior-on-cache.json'),
  JSON.stringify({schema:'wand.int.steam-public-signed-prior-on-cache@1',records:[baseRecord,baseRecord]}));
 await assert.rejects(import(pathToFileURL(source).href),/PRIOR_ON_DUPLICATE_VALIDATOR/);
});
test('original signed public Steam3 ON remains existing exact WebP bytes GET+HEAD, MIME and SHA, no release/Op toggle',async()=>{
 assert.equal(snapshot.consumer,'OFF');
 assert.equal(snapshot.items.length,3);
 assert.equal(snapshot.withdrawn.length,0);
 const root=fileURLToPath(new URL('../',import.meta.url));
 const byUrl=new Map(images.map(i=>[new URL(pathFor(i.sha256),base).href,
  readFileSync(join(root,'static',pathFor(i.sha256)))]));
 const requests=[];
 const fetch=async(url,{method,redirect})=>{
  requests.push([url,method]);assert.equal(redirect,'manual');
  const buf=byUrl.get(url);assert(buf,'unapproved image URL');
  return new Response(method==='GET'?buf:null,{status:200,
   headers:{'content-type':'image/webp','content-length':String(buf.length)}});
 };
 const result=await verifyLive(snapshot,base,fetch);
 assert.deepEqual(result,{publicItems:3,withdrawn:0});
 assert.equal(requests.length,6);
 for(const item of images){
  const url=new URL(pathFor(item.sha256),base).href;
  assert(requests.some(x=>x[0]===url&&x[1]==='GET'));
  assert(requests.some(x=>x[0]===url&&x[1]==='HEAD'));
 }
});
