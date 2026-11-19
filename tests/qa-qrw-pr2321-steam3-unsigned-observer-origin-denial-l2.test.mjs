// 04 QR-W changed-only L2 against real signed-batch Steam3 bytes and actual
// new unsigned read-only cache observer. No network in CI; synthetic origin
// responses cannot mint signed Pages, ON authorization, or withdrawal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {observeSteamPublicOn} from '../scripts/07dbk-steam-public-on-observer.mjs';
import {readBatch,pathFor} from '../scripts/int-steam-public-media-signed-batch.mjs';
const BASE='https://dreamwishwand.github.io/web/';
const batch=readBatch();
const sha=b=>createHash('sha256').update(b).digest('hex');
const signed=new Map(batch.items.map(item=>{
 const bytes=readFileSync(new URL('../static/'+pathFor(item.sha256),import.meta.url));
 assert.equal(sha(bytes),item.sha256);
 assert.equal(bytes.length,item.bytes);
 return [new URL(pathFor(item.sha256),BASE).href,{item,bytes}];
}));
assert.equal(signed.size,3,'fixed original public Steam WebP exact3; no hidden/untrusted media');
const expectedPaths=new Set(signed.keys());
const TIME='Thu, 19 Nov 2026 10:02:33 GMT';
const claim=Object.freeze({claimedProtectedMain:'f'.repeat(40),observerRunId:'987654321'});
function server(mode={}){
 const calls=[];
 const fetcher=async(url,req)=>{
  calls.push({url,method:req.method,headers:req.headers});
  assert(expectedPaths.has(url),'observer may request ONLY signed original WebP path');
  assert.equal(req.redirect,'manual','never follow CDN/foreign redirects');
  const entry=signed.get(url),tag=mode.tag??('"observation-'+entry.item.bytes.toString(16)+'"');
  const date=mode.date??TIME;
  const head=req.method==='HEAD';
  const headers={
   'content-type':mode.mime??'image/webp',
   'content-length':String(mode.lengthIncorrect?entry.item.bytes+1:entry.item.bytes),
   'last-modified':mode.headDifferentDate&&head?'Wed, 18 Nov 2026 10:02:33 GMT':date
  };
  if(!mode.omitEtag)headers.etag=(mode.headDifferentEtag&&head)?'"unrelated-head"':tag;
  const incomingTag=req.headers?.['If-None-Match'];
  const incomingDate=req.headers?.['If-Modified-Since'];
  if(mode.redirect)return new Response(null,{status:302,headers:{location:'https://foreign.example/'}});
  if(incomingTag || incomingDate){
   if(incomingTag==='"07dbk-not-a-real-etag"'&&mode.foreign304)
    return new Response(null,{status:304});
   if(incomingTag===tag||incomingDate===date){
    if(mode.bad304body)
      return {status:304,headers:new Headers(),arrayBuffer:async()=>Uint8Array.from([99]).buffer};
    if(!mode.dateReturns200 && !mode.mutatedConditional)
      return new Response(null,{status:304});
    const bytes=mode.mutatedConditional
      ?Buffer.from(entry.bytes.map((b,i)=>i===5?b^1:b)):entry.bytes;
    return new Response(bytes,{status:200,headers});
   }
  }
  if(head)return new Response(null,{status:200,headers});
  return new Response(entry.bytes,{status:200,headers});
 };
 return {fetcher,calls};
}
function unsigned(obs){
 assert.equal(obs.schema,'wand.dbk.unsigned-live-on-observation@1');
 assert.equal(obs.provenance,'UNTRUSTED_OBSERVER_NOT_SIGNED_ON_ORIGIN');
 assert.equal(obs.issuer,'NOT_09_INT_PROTECTED_MAIN');
 assert.equal(obs.releaseState,'NOT_ATTESTED');
 assert.equal(obs.signedPagesRunId,null);
 assert.equal(obs.signedBundleSha256,null);
 assert.equal(obs.protectedPriorOnReceiptSha256,null);
 assert.equal(obs.consumer,'OFF');
 assert.equal(obs.withdrawal,'NOT_PERFORMED');
 assert.equal(obs.cdnPurge,'NOT_PERFORMED');
 assert.equal(Object.hasOwn(obs,'writerAuthorized'),false);
}
test('forged but well-formed protected SHA/run and unsolicited auth fields remain UNSIGNED despite real pinned Steam3 SHA',async()=>{
 const s=server();
 const obs=await observeSteamPublicOn({
  ...claim,fetcher:s.fetcher,
  signedPagesRunId:44526354119,
  signedBundleSha256:'a'.repeat(64),
  releaseState:'SIGNED_PAGES_ON_OBSERVED',
  issuer:'09_INT_PROTECTED_MAIN',
  writerAuthorized:true
 });
 unsigned(obs);
 assert.equal(obs.claimedProtectedMain,claim.claimedProtectedMain);
 assert.equal(obs.observerRunId,claim.observerRunId);
 assert.equal(obs.items.length,3);
 assert.equal(s.calls.length,15);
 assert.equal(Object.isFrozen(obs),true);
 assert.equal(Object.isFrozen(obs.items),true);
 for(const item of obs.items){
  assert.equal(Object.isFrozen(item),true);
  assert.equal(item.etag,'"observation-'+item.bytes.toString(16)+'"');
  assert.equal(item.lastModified,TIME);
  assert.equal(item.conditionalEtagStatus,'304_WHILE_ON');
  assert.equal(item.conditionalDateStatus,'304_WHILE_ON');
  assert.equal(item.foreignEtagStatus,'200_SHA_PINNED_WHILE_ON');
  assert.equal(item.sha256,signed.get(item.url).item.sha256);
 }
 assert.throws(()=>{obs.releaseState='SIGNED_PAGES_ON_OBSERVED'},TypeError);
 assert.equal(obs.releaseState,'NOT_ATTESTED');
});
test('HTTP 200 while replaying old IMF-Date is fine ONLY with original SHA; observation still cannot be protected old ON receipt',async()=>{
 const s=server({dateReturns200:true});
 const obs=await observeSteamPublicOn({...claim,fetcher:s.fetcher});
 unsigned(obs);
 assert.deepEqual(obs.items.map(x=>x.conditionalDateStatus),Array(3).fill('200_SHA_PINNED_WHILE_ON'));
 assert.deepEqual(obs.items.map(x=>x.conditionalEtagStatus),Array(3).fill('200_SHA_PINNED_WHILE_ON'));
 assert.equal(s.calls.length,15);
});
test('malformed or impossible origin ETag/LastModified and inconsistent GET/HEAD deny without emitting signed output',async()=>{
 const invalid=[
  [{tag:'not-quoted'},/LIVE_OBSERVER_REAL_ETAG_REQUIRED/],
  [{tag:'"bad"trailer'},/LIVE_OBSERVER_REAL_ETAG_REQUIRED/],
  [{date:'Mon, 19 Nov 2026 10:02:33 GMT'},/LIVE_OBSERVER_REAL_IMF_DATE_REQUIRED/],
  [{date:'Thu, 31 Nov 2026 10:02:33 GMT'},/LIVE_OBSERVER_REAL_IMF_DATE_REQUIRED/],
  [{date:'Thu, 19 Nov 2026 25:02:33 GMT'},/LIVE_OBSERVER_REAL_IMF_DATE_REQUIRED/],
  [{headDifferentDate:true},/LIVE_OBSERVER_GET_HEAD_DATE_MISMATCH/],
  [{headDifferentEtag:true},/LIVE_OBSERVER_GET_HEAD_ETAG_MISMATCH/]
 ];
 for(const [mode,reason] of invalid){
  const s=server(mode);
  await assert.rejects(observeSteamPublicOn({...claim,fetcher:s.fetcher}),reason,JSON.stringify(mode));
  assert(s.calls.length>0,'fail happens only after actual signed image GET/HEAD');
 }
});
test('304 may not carry hidden bytes, forged ETag 304 is denied, conditional 200 changed SHA is denied',async()=>{
 for(const [mode,re] of [
  [{bad304body:true},/LIVE_OBSERVER_304_WITH_BODY/],
  [{foreign304:true},/LIVE_OBSERVER_FOREIGN_ETAG_FALSE_304/],
  [{mutatedConditional:true},/LIVE_OBSERVER_CONDITIONAL_SHA_MISMATCH/]
 ]){
  const s=server(mode);
  await assert.rejects(observeSteamPublicOn({...claim,fetcher:s.fetcher}),re);
  assert(s.calls.length>=3);
 }
});
test('original GET/HEAD length, MIME and unexpected redirect fail prior to any privilege or cache claim',async()=>{
 for(const [mode,re] of [
  [{lengthIncorrect:true},/LIVE_LENGTH_HEADER|LIVE_OBSERVER_CONTENT_LENGTH_MISMATCH/],
  [{mime:'text/html'},/MEDIA_PUBLIC_WRONG_MIME/],
  [{redirect:true},/MEDIA_PUBLIC_NOT_OK_302|LIVE_OBSERVER_PRIOR_ON_MUST_BE_200/]
 ]){
  const s=server(mode);
  await assert.rejects(observeSteamPublicOn({...claim,fetcher:s.fetcher}),re);
 }
});
test('invalid supplied run/commit and forged public batch rights/withdrawal reject BEFORE any CDN contact',async()=>{
 const badCases=[
  {claimedProtectedMain:'b'.repeat(39)},
  {claimedProtectedMain:'A'.repeat(40)},
  {observerRunId:'000123'},
  {observerRunId:'1e12'},
  {batch:{...batch,consumer:'ON'}},
  {batch:{...batch,withdrawn:[{itemId:'1',sha256:'b'.repeat(64)}]}},
  {batch:{...batch,ownerDecision:'NOT_OWNER_GO'}},
  {batch:{...batch,items:[]}}
 ];
 for(const bad of badCases){
  const s=server();
  await assert.rejects(observeSteamPublicOn({...claim,...bad,fetcher:s.fetcher}));
  assert.equal(s.calls.length,0,JSON.stringify(bad));
 }
});
