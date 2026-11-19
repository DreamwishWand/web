// 07 DBK — read-only real Steam public ON cache validator observer.
// NOT a release signer, rights grant, prior ON origin receipt, or a CDN purge.
// Only 09 INT may authenticate and register historical signed Pages provenance.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readBatch,validateBatch,verifyLive,pathFor} from './int-steam-public-media-signed-batch.mjs';

const BASE='https://dreamwishwand.github.io/web/';
const HEX40=/^[0-9a-f]{40}$/;
const ETAG=/^(?:W\/)?"[\x21\x23-\x7e]{1,128}"$/;
const IMF=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const validDate=value=>typeof value==='string'&&IMF.test(value)&&
  Number.isFinite(Date.parse(value))&&
  new Date(Date.parse(value)).toUTCString()===value;
function httpHeaders(response){
  assert.ok(response.headers,'LIVE_OBSERVER_HTTP_HEADERS_REQUIRED');
  const etag=response.headers.get('etag');
  const lastModified=response.headers.get('last-modified');
  assert.ok(typeof etag==='string'&&ETAG.test(etag),'LIVE_OBSERVER_REAL_ETAG_REQUIRED');
  assert.ok(validDate(lastModified),'LIVE_OBSERVER_REAL_IMF_DATE_REQUIRED');
  return {
    etag,lastModified,
    contentType:response.headers.get('content-type'),
    contentLength:response.headers.get('content-length')
  };
}
function mediaHeaders(headers,item){
  assert.match(headers.contentType||'',/^image\/webp(?:\s*;|$)/i,'LIVE_OBSERVER_MIME_MISMATCH');
  if(headers.contentLength!==null){
    assert.ok(/^[0-9]+$/.test(headers.contentLength),'LIVE_OBSERVER_CONTENT_LENGTH_INVALID');
    assert.equal(Number(headers.contentLength),item.bytes,'LIVE_OBSERVER_CONTENT_LENGTH_MISMATCH');
  }
}
async function conditional(url,header,value,item,fetcher,observed){
  const response=await fetcher(url,{
    method:'GET',redirect:'manual',
    headers:{'Cache-Control':'no-cache, max-age=0',Pragma:'no-cache',[header]:value},
    signal:AbortSignal.timeout(20000)
  });
  if(response.status===304){
    const body=Buffer.from(await response.arrayBuffer());
    assert.equal(body.length,0,'LIVE_OBSERVER_304_WITH_BODY');
    // A 304 may omit validators, but any validator it returns must refer to
    // the SAME 200 GET/HEAD generation. A stale CDN edge is not a receipt.
    const tag=response.headers.get('etag');
    const date=response.headers.get('last-modified');
    if(tag!==null)assert.equal(tag,observed.etag,'LIVE_OBSERVER_304_ETAG_GENERATION_MISMATCH');
    if(date!==null)assert.equal(date,observed.lastModified,'LIVE_OBSERVER_304_DATE_GENERATION_MISMATCH');
    return '304_WHILE_ON';
  }
  assert.equal(response.status,200,'LIVE_OBSERVER_CONDITIONAL_NOT_200_OR_304');
  const headers=httpHeaders(response);
  mediaHeaders(headers,item);
  assert.equal(headers.etag,observed.etag,'LIVE_OBSERVER_200_ETAG_GENERATION_MISMATCH');
  assert.equal(headers.lastModified,observed.lastModified,'LIVE_OBSERVER_200_DATE_GENERATION_MISMATCH');
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length,item.bytes,'LIVE_OBSERVER_CONDITIONAL_LENGTH_MISMATCH');
  assert.equal(sha(bytes),item.sha256,'LIVE_OBSERVER_CONDITIONAL_SHA_MISMATCH');
  return '200_SHA_PINNED_WHILE_ON';
}

/**
 * Returns an UNTRUSTED observation of actual already-public images.
 * The claimedProtectedMain and observerRunId are caller-supplied correlation
 * hints ONLY; none of this function's output can authorize a later withdrawal.
 * The signed Pages issuer/artifact identity is deliberately NOT minted here.
 */
export async function observeSteamPublicOn({
  batch=readBatch(),fetcher=fetch,claimedProtectedMain=null,observerRunId=null
}={}){
  validateBatch(batch);
  assert.ok(batch.items.length>0,'LIVE_OBSERVER_NO_PUBLIC_IMAGES');
  assert.deepEqual(batch.withdrawn,[],'LIVE_OBSERVER_WITHDRAWAL_NOT_ALLOWED');
  assert.equal(batch.consumer,'OFF','LIVE_OBSERVER_CONSUMER_FLAG_CHANGED');
  assert.ok(claimedProtectedMain===null||
    typeof claimedProtectedMain==='string'&&HEX40.test(claimedProtectedMain),
    'LIVE_OBSERVER_CLAIM_FORMAT');
  assert.ok(observerRunId===null||
    typeof observerRunId==='string'&&/^[1-9]\d{0,18}$/.test(observerRunId),
    'LIVE_OBSERVER_RUN_ID_FORMAT');
  const expected=new Map(batch.items.map(item=>[new URL(pathFor(item.sha256),BASE).href,item]));
  assert.equal(expected.size,batch.items.length,'LIVE_OBSERVER_URL_DUPLICATE');
  const seen=new Map();
  const monitored=async(url,options)=>{
    assert.ok(expected.has(url),'LIVE_OBSERVER_UNEXPECTED_URL');
    assert.ok(options?.method==='GET'||options?.method==='HEAD','LIVE_OBSERVER_UNEXPECTED_METHOD');
    const response=await fetcher(url,options);
    assert.equal(response.status,200,'LIVE_OBSERVER_PRIOR_ON_MUST_BE_200');
    let byMethod=seen.get(url);
    if(!byMethod){byMethod=new Map();seen.set(url,byMethod);}
    assert.ok(!byMethod.has(options.method),'LIVE_OBSERVER_DUPLICATE_HTTP');
    byMethod.set(options.method,httpHeaders(response));
    return response;
  };
  // Original signed batch verifier owns byte-for-byte GET/HEAD, MIME,
  // original ImageID/SHA, and trusted host checks. Never substitute this wrapper.
  const original=await verifyLive(batch,BASE,monitored);
  assert.deepEqual(original,{publicItems:batch.items.length,withdrawn:0});
  const observations=[];
  for(const [url,item] of expected){
    const headers=seen.get(url);
    assert.ok(headers?.has('GET')&&headers?.has('HEAD')&&headers.size===2,'LIVE_OBSERVER_GET_HEAD_REQUIRED');
    const get=headers.get('GET'),head=headers.get('HEAD');
    assert.equal(get.etag,head.etag,'LIVE_OBSERVER_GET_HEAD_ETAG_MISMATCH');
    assert.equal(get.lastModified,head.lastModified,'LIVE_OBSERVER_GET_HEAD_DATE_MISMATCH');
    mediaHeaders(get,item);mediaHeaders(head,item);
    const etagStatus=await conditional(url,'If-None-Match',get.etag,item,fetcher,get);
    const dateStatus=await conditional(url,'If-Modified-Since',get.lastModified,item,fetcher,get);
    const foreignStatus=await conditional(url,'If-None-Match','"07dbk-not-a-real-etag"',item,fetcher,get);
    assert.equal(foreignStatus,'200_SHA_PINNED_WHILE_ON','LIVE_OBSERVER_FOREIGN_ETAG_FALSE_304');
    observations.push(Object.freeze({
      itemId:item.itemId,sha256:item.sha256,bytes:item.bytes,url,
      etag:get.etag,lastModified:get.lastModified,
      getStatus:200,headStatus:200,
      conditionalEtagStatus:etagStatus,
      conditionalDateStatus:dateStatus,
      foreignEtagStatus:foreignStatus
    }));
  }
  return Object.freeze({
    schema:'wand.dbk.unsigned-live-on-observation@1',
    provenance:'UNTRUSTED_OBSERVER_NOT_SIGNED_ON_ORIGIN',
    claimedProtectedMain,
    observerRunId,
    issuer:'NOT_09_INT_PROTECTED_MAIN',
    signedPagesRunId:null,
    signedBundleSha256:null,
    protectedPriorOnReceiptSha256:null,
    releaseState:'NOT_ATTESTED',
    consumer:'OFF',
    withdrawal:'NOT_PERFORMED',
    cdnPurge:'NOT_PERFORMED',
    observedAt:new Date().toISOString(),
    items:Object.freeze(observations)
  });
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const observation=await observeSteamPublicOn({
    claimedProtectedMain:process.env.WAND_OBSERVER_PROTECTED_BASE||null,
    observerRunId:process.env.GITHUB_RUN_ID||null
  });
  console.log('07DBK_UNSIGNED_ON_OBSERVATION_SUCCESS '+JSON.stringify(observation));
}
