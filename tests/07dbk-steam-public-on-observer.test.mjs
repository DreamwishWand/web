import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {observeSteamPublicOn} from '../scripts/07dbk-steam-public-on-observer.mjs';
import {readBatch,pathFor} from '../scripts/int-steam-public-media-signed-batch.mjs';

const BASE='https://dreamwishwand.github.io/web/';
const DATE='Thu, 19 Nov 2026 10:02:33 GMT';
const ORIGINAL=readBatch();
const SHA=b=>createHash('sha256').update(b).digest('hex');
const images=new Map(ORIGINAL.items.map(item=>{
  const file=new URL('../static/'+pathFor(item.sha256),import.meta.url);
  const bytes=readFileSync(file);
  assert.equal(bytes.length,item.bytes);
  assert.equal(SHA(bytes),item.sha256);
  return [new URL(pathFor(item.sha256),BASE).href,{...item,bytes}];
}));
const setup=(mode={})=>{
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,method:opts?.method,headers:opts?.headers});
    const img=images.get(url);
    assert.ok(img,'observer must never request an unpinned subject');
    const statusHeaders=opts?.method==='HEAD'&&mode.headMismatch
      ? {'etag':'"unrelated"','last-modified':DATE}:
      {'etag':'"6afec939-'+img.bytes.length.toString(16)+'"',
        'last-modified':DATE};
    if(mode.noEtag)delete statusHeaders.etag;
    if(mode.wrongWeekday)statusHeaders['last-modified']='Mon, 19 Nov 2026 10:02:33 GMT';
    if(mode.impossibleDate)statusHeaders['last-modified']='Thu, 31 Nov 2026 10:02:33 GMT';
    if(mode.headDateMismatch&&opts?.method==='HEAD')
      statusHeaders['last-modified']='Wed, 18 Nov 2026 11:38:36 GMT';
    const headers={
      'content-type':mode.mimeError?'text/html':'image/webp',
      'content-length':String(img.bytes.length),...statusHeaders
    };
    const ifTag=opts?.headers?.['If-None-Match'];
    const ifDate=opts?.headers?.['If-Modified-Since'];
    if(mode.redirect)return new Response(null,{status:302,headers:{location:'https://elsewhere.invalid/'}});
    if(ifTag||ifDate){
      if(ifTag==='"07dbk-not-a-real-etag"'&&mode.foreign304)
        return new Response(null,{status:304});
      if((ifTag&&ifTag===statusHeaders.etag)||
         (ifDate&&ifDate===statusHeaders['last-modified']))
        return mode.conditionalWrong200
          ?new Response(Buffer.from(img.bytes.map((b,i)=>i===0?b^1:b)),{status:200,headers})
          :new Response(null,{status:304});
    }
    let bytes=img.bytes;
    if(mode.originalWrongBytes&&opts?.method==='GET'&&!opts.headers?.['If-None-Match'])
      bytes=Buffer.from(bytes.map((b,i)=>i===0?b^1:b));
    if(opts?.method==='HEAD')return new Response(null,{status:200,headers});
    return new Response(bytes,{status:200,headers});
  };
  return {fetcher,calls};
};
const opts={claimedProtectedMain:'9ca61bd33fd1c1daacc88b6e8a1b145b817eb8f4',
  observerRunId:'44503716814'};

test('uses existing true signed product GET+HEAD SHA verification and replays actual current ETag/date for all three original WebPs',async()=>{
  const {fetcher,calls}=setup();
  const result=await observeSteamPublicOn({...opts,fetcher});
  assert.equal(result.schema,'wand.dbk.unsigned-live-on-observation@1');
  assert.equal(result.provenance,'UNTRUSTED_OBSERVER_NOT_SIGNED_ON_ORIGIN');
  assert.equal(result.issuer,'NOT_09_INT_PROTECTED_MAIN');
  assert.equal(result.releaseState,'NOT_ATTESTED');
  assert.equal(result.signedPagesRunId,null);
  assert.equal(result.signedBundleSha256,null);
  assert.equal(result.protectedPriorOnReceiptSha256,null);
  assert.equal(result.withdrawal,'NOT_PERFORMED');
  assert.equal(result.cdnPurge,'NOT_PERFORMED');
  assert.equal(result.consumer,'OFF');
  assert.equal(result.items.length,3);
  assert.equal(result.items.length,ORIGINAL.items.length);
  assert.deepEqual(result.items.map(x=>x.itemId),ORIGINAL.items.map(x=>x.itemId));
  assert.equal(calls.length,15,'two product verifier methods plus 3 conditionals per original item');
  for(const item of result.items){
    assert.equal(item.sha256,ORIGINAL.items.find(x=>x.itemId===item.itemId).sha256);
    assert.equal(item.etag,'"6afec939-'+item.bytes.toString(16)+'"');
    assert.equal(item.lastModified,DATE);
    assert.equal(item.getStatus,200);
    assert.equal(item.headStatus,200);
    assert.equal(item.conditionalEtagStatus,'304_WHILE_ON');
    assert.equal(item.conditionalDateStatus,'304_WHILE_ON');
    assert.equal(item.foreignEtagStatus,'200_SHA_PINNED_WHILE_ON');
    assert.equal(calls.filter(c=>c.url===item.url).length,5);
    assert.ok(calls.some(c=>c.url===item.url&&c.headers?.['If-None-Match']===item.etag));
    assert.ok(calls.some(c=>c.url===item.url&&c.headers?.['If-Modified-Since']===DATE));
  }
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.items));
  assert.ok(Object.isFrozen(result.items[0]));
});

test('wrong observed GET/HEAD ETag/date, missing real ETag, impossible date, wrong weekday fail CLOSED',async()=>{
  for(const mode of [{headMismatch:true},{headDateMismatch:true},{noEtag:true},
    {wrongWeekday:true},{impossibleDate:true}]){
    const f=setup(mode);
    await assert.rejects(observeSteamPublicOn({...opts,fetcher:f.fetcher}),
      /LIVE_OBSERVER_(GET_HEAD_ETAG_MISMATCH|GET_HEAD_DATE_MISMATCH|REAL_ETAG_REQUIRED|REAL_IMF_DATE_REQUIRED)/,
      JSON.stringify(mode));
  }
});

test('current CDN must reject forged unrelated ETag; 304 on foreign validator is not accepted',async()=>{
  const f=setup({foreign304:true});
  await assert.rejects(observeSteamPublicOn({...opts,fetcher:f.fetcher}),
    /LIVE_OBSERVER_FOREIGN_ETAG_FALSE_304/);
});

test('conditionally returned 200 must carry original signed SHA, not just MIME or size',async()=>{
  const f=setup({conditionalWrong200:true});
  await assert.rejects(observeSteamPublicOn({...opts,fetcher:f.fetcher}),
    /LIVE_OBSERVER_CONDITIONAL_SHA_MISMATCH/);
});
test('original signed product image SHA, host and MIME gate cannot be bypassed',async()=>{
  for(const mode of [{originalWrongBytes:true},{mimeError:true},{redirect:true}]){
    const f=setup(mode);
    await assert.rejects(observeSteamPublicOn({...opts,fetcher:f.fetcher}),
      /LIVE_IMAGE_SHA256|MEDIA_PUBLIC_WRONG_MIME|MEDIA_PUBLIC_NOT_OK_302/,
      JSON.stringify(mode));
  }
});

test('caller cannot use observation to claim signed Pages run/issuer/withdraw or arbitrary Build',async()=>{
  const f=setup();
  for(const args of [
    {batch:{...ORIGINAL,items:[]}},
    {batch:{...ORIGINAL,withdrawn:[{itemId:'123',sha256:'a'.repeat(64)}]}},
    {batch:{...ORIGINAL,consumer:'ON'}},
    {claimedProtectedMain:'not-a-protected-commit'},
    {observerRunId:'not-a-run'}
  ]){
    await assert.rejects(observeSteamPublicOn({...opts,...args,fetcher:f.fetcher}));
  }
  assert.equal(f.calls.length,0,'invalid scope rejected before any network request');
});
