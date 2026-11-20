// 04 QR-W independent changed-invariant L2 tests, Source PR2336.
// Mocked CDN responses over actual signed Steam3 public WebP bytes. NO real
// network, rights change, signed-origin claim, CDN purge or Save Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {observeSteamPublicOn} from '../scripts/07dbk-steam-public-on-observer.mjs';
import {readBatch,pathFor} from '../scripts/int-steam-public-media-signed-batch.mjs';
const BASE='https://dreamwishwand.github.io/web/';
const DATE='Thu, 19 Nov 2026 10:02:33 GMT';
const OLD_DATE='Wed, 18 Nov 2026 11:38:36 GMT';
const BATCH=readBatch();
const sha=b=>createHash('sha256').update(b).digest('hex');
const originals=new Map(BATCH.items.map(item=>{
  const bytes=readFileSync(new URL('../static/'+pathFor(item.sha256),import.meta.url));
  assert.equal(bytes.length,item.bytes);
  assert.equal(sha(bytes),item.sha256);
  return [new URL(pathFor(item.sha256),BASE).href,{item,bytes}];
}));
assert.equal(originals.size,3,'fixed publicly signed Steam WebP3');
const claim={claimedProtectedMain:'a'.repeat(40),observerRunId:'234567890'};
function site(spec={}){
  const calls=[];
  const fetcher=async(url,req)=>{
    assert(originals.has(url),'observer accessed unpinned CDN URL');
    assert.equal(req.redirect,'manual');
    const {item,bytes}=originals.get(url);
    const tag='"trusted-'+item.bytes.toString(16)+'"';
    const orig={etag:tag,'last-modified':DATE,'content-type':'image/webp',
      'content-length':String(bytes.length)};
    const incoming=req.headers?.['If-None-Match'];
    const incomingDate=req.headers?.['If-Modified-Since'];
    const phase=incoming==='"07dbk-not-a-real-etag"'?'foreign'
      :incoming===tag?'tag':incomingDate===DATE?'date':null;
    calls.push({phase,url,method:req.method});
    if(phase){
      const override=spec[phase];
      const status=override?.status??(phase==='foreign'?200:304);
      let headers=override?.headers??(status===304?{}:orig);
      if(headers==='@both-matching')headers={etag:tag,'last-modified':DATE};
      else if(headers?.etag==='@original')headers={...headers,etag:tag};
      if(status===304)return new Response(null,{status:304,headers});
      return new Response(bytes,{status:200,headers});
    }
    return req.method==='HEAD'
      ?new Response(null,{status:200,headers:orig})
      :new Response(bytes,{status:200,headers:orig});
  };
  return {fetcher,calls};
}
async function observe(spec={}){
  const s=site(spec);
  const observation=await observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher});
  return {...s,observation};
}
function unsigned(o){
  assert.equal(o.provenance,'UNTRUSTED_OBSERVER_NOT_SIGNED_ON_ORIGIN');
  assert.equal(o.releaseState,'NOT_ATTESTED');
  assert.equal(o.issuer,'NOT_09_INT_PROTECTED_MAIN');
  assert.equal(o.signedPagesRunId,null);
  assert.equal(o.protectedPriorOnReceiptSha256,null);
  assert.equal(o.signedBundleSha256,null);
  assert.equal(o.consumer,'OFF');
  assert.equal(o.withdrawal,'NOT_PERFORMED');
  assert.equal(o.cdnPurge,'NOT_PERFORMED');
  assert.equal(o.items.length,3);
}
test('two matching explicit 304 validators are accepted but cannot sign prior ON',async()=>{
  const {observation,calls}=await observe({
    tag:{status:304,headers:'@both-matching'},
    date:{status:304,headers:'@both-matching'}
  });
  unsigned(observation);
  assert.equal(calls.length,15);
  assert.equal(calls.filter(c=>c.phase==='tag').length,3);
  assert.equal(calls.filter(c=>c.phase==='date').length,3);
  assert.deepEqual(observation.items.map(i=>i.conditionalDateStatus),Array(3).fill('304_WHILE_ON'));
});
test('304 matching Date but stale ETag rejects the same original generation',async()=>{
  const s=site({tag:{status:304,headers:{etag:'"stale-generation"','last-modified':DATE}}});
  await assert.rejects(observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher}),
    /LIVE_OBSERVER_304_ETAG_GENERATION_MISMATCH/);
  assert(s.calls.some(c=>c.phase==='tag'));
});
test('304 matching ETag but stale Date rejects the same original generation',async()=>{
  const s=site({date:{status:304,headers:{etag:'@original','last-modified':OLD_DATE}}});
  await assert.rejects(observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher}),
    /LIVE_OBSERVER_304_DATE_GENERATION_MISMATCH/);
  assert(s.calls.some(c=>c.phase==='date'));
});
test('foreign-validator 200 with original SHA but drifted ETag or Date denies',async()=>{
  for(const [headers,reason] of [
    [{etag:'"foreign-generation"','last-modified':DATE,'content-type':'image/webp'},
      /LIVE_OBSERVER_200_ETAG_GENERATION_MISMATCH/],
    [{etag:'@original','last-modified':OLD_DATE,'content-type':'image/webp'},
      /LIVE_OBSERVER_200_DATE_GENERATION_MISMATCH/]
  ]){
    const s=site({foreign:{status:200,headers}});
    await assert.rejects(observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher}),reason);
    assert(s.calls.some(c=>c.phase==='foreign'));
  }
});
test('foreign-validator 200 with impossible IMF date denies even with SHA-identical original bytes',async()=>{
  const s=site({foreign:{status:200,headers:{etag:'"other"',
    'last-modified':'Thu, 31 Nov 2026 10:02:33 GMT','content-type':'image/webp'}}});
  await assert.rejects(observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher}),
    /LIVE_OBSERVER_REAL_IMF_DATE_REQUIRED/);
});
test('304 supplied empty ETag or date is different from absent validators',async()=>{
  for(const [phase,headers,reason] of [
    ['tag',{etag:''},/LIVE_OBSERVER_304_ETAG_GENERATION_MISMATCH/],
    ['date',{'last-modified':''},/LIVE_OBSERVER_304_DATE_GENERATION_MISMATCH/]
  ]){
    const s=site({[phase]:{status:304,headers}});
    await assert.rejects(observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher}),reason);
  }
});
test('coherent same-generation 200 fallback stays accepted, still unsigned',async()=>{
  const s=site({tag:{status:200},date:{status:200}});
  const o=await observeSteamPublicOn({...claim,batch:BATCH,fetcher:s.fetcher});
  unsigned(o);
  assert.deepEqual(o.items.map(i=>i.conditionalEtagStatus),Array(3).fill('200_SHA_PINNED_WHILE_ON'));
  assert.deepEqual(o.items.map(i=>i.conditionalDateStatus),Array(3).fill('200_SHA_PINNED_WHILE_ON'));
});
test('304 without validators is legal, but not a signed ON issuer',async()=>{
  const {observation}=await observe();
  unsigned(observation);
  assert.deepEqual(observation.items.map(i=>i.conditionalEtagStatus),Array(3).fill('304_WHILE_ON'));
});
