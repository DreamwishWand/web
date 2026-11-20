// 04 QR-W independent 07 DBK PR2381 fixed Source / LIVE_ON validator fail-closed L2.
// Synthetic HTTP only. Neither genuine hosted CDN observation nor 09INT signer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifySteamLiveImagePhase,receiptDigest} from '../scripts/07dbk-steam-image-live-receipt.mjs';

const SHA=b=>createHash('sha256').update(b).digest('hex');
const ids=['40300045','40300046'];
const assetBodies=ids.map((_,i)=>Buffer.concat([
 Buffer.from('RIFF','ascii'),Buffer.alloc(4),
 Buffer.from('WEBPVP8L','ascii'),Buffer.alloc(14,0x31+i)]));
const pins=Object.fromEntries(ids.map((id,i)=>[id,{
 webpSha256:SHA(assetBodies[i]),rgba160Sha256:'f'.repeat(64),
 bytes:assetBodies[i].length,width:160,height:160,
 codec:'WEBP_LOSSLESS_RGBA_EXACT',visibility:'RELEASED_PLAYER_FACING'
}]));
const variant='steam-1.25.3-schema626-lossless160-v1';
const opts={phase:'ON',baseUrl:'https://dreamwishwand.github.io/web/',
 ids,pins,variant,manifestPath:'ddv/item-images/'+variant+'/manifest.json',
 clock:()=>'2026-11-20T01:00:00.000Z'};
const DATE='Wed, 18 Nov 2026 11:38:36 GMT';
const etag=i=>'"asset-'+String(i)+'-observed"';
function harness({which=-1,method='',field='',different=false,malformed=false,
 brokenStatus=false,wrongMime=false,wrongBytes=false}={}){
 const calls=[];
 const fetchImpl=async (url,{method:m,redirect,headers}={})=>{
  calls.push({url,method:m,redirect,headers});
  assert.equal(redirect,'manual');
  assert.equal(headers['Cache-Control'],'no-cache, max-age=0');
  const isManifest=url.endsWith('manifest.json');
  if(isManifest){
   assert.equal(m,'GET');
   return new Response(JSON.stringify({
    schema:'wand.item-images.steam-primary-release@1',assetVariant:variant,
    publication:{gate:'MEDIA_PUBLIC_SCOPED_ON'},
    items:Object.fromEntries(ids.map((id,i)=>[id,{webpSha256:SHA(assetBodies[i])}]))
   }),{status:200,headers:{'content-type':'application/json'}});
  }
  const index=ids.findIndex((id,i)=>url.endsWith('/'+SHA(assetBodies[i])+'.webp'));
  assert.ok(index>=0,'no foreign URLs');
  let tag=etag(index),date=DATE;
  if(index===which&&m===method&&different)tag='"wrong-generation"';
  if(index===which&&m===method&&malformed)date='Wed, 31 Nov 2026 11:38:36 GMT';
  const h={'content-type':wrongMime&&index===which&&m===method?'text/html':'image/webp',
   'content-length':String(assetBodies[index].length)};
  if(!(index===which&&m===method&&field==='etag'))h.etag=tag;
  if(!(index===which&&m===method&&field==='last-modified'))h['last-modified']=date;
  if(brokenStatus&&index===which&&m===method)return new Response(null,{status:304,headers:h});
  if(m==='HEAD')return new Response(null,{status:200,headers:h});
  const bytes=wrongBytes&&index===which&&m===method?Buffer.from('bad'):assetBodies[index];
  return new Response(bytes,{status:200,headers:h});
 };
 return {fetchImpl,calls};
}

test('two independent real-style GET/HEAD generations produce only one complete read-only ON receipt',async()=>{
 const f=harness();
 const x=await verifySteamLiveImagePhase({...opts,fetchImpl:f.fetchImpl});
 assert.equal(x.receipt.result,'SCOPED_PASS');
 assert.equal(x.receipt.phase,'ON');
 assert.deepEqual(x.receipt.checks.map(c=>[c.method,c.status]),[
  ['GET',200],['GET',200],['HEAD',200],['GET',200],['HEAD',200]]);
 assert.deepEqual(x.receipt.targets.map(c=>c.id),ids);
 assert.equal(x.receipt.checks[1].cacheValidators.etag,etag(0));
 assert.equal(x.receipt.checks[3].cacheValidators.etag,etag(1));
 assert.notEqual(x.receipt.checks[1].cacheValidators.etag,
  x.receipt.checks[3].cacheValidators.etag);
 assert.equal(x.receipt.sha256,undefined);
 assert.equal(x.sha256,receiptDigest(x.receipt));
 assert.equal(x.receipt.fullGlobalCdnPurge,'NOT_PROVED');
 assert.equal(x.receipt.providerPurgeAction,'NOT_PERFORMED');
 assert.equal('signedDeploymentAuthorized' in x.receipt,false);
 assert.equal(f.calls.length,5);
});

test('every GET/HEAD of both image URLs must independently provide ETag AND exact IMF date',async()=>{
 let n=0;
 for(let i=0;i<2;i++)for(const method of ['GET','HEAD'])for(const field of ['etag','last-modified']){
  const f=harness({which:i,method,field});
  await assert.rejects(verifySteamLiveImagePhase({...opts,fetchImpl:f.fetchImpl}),
   /LIVE_ON_CACHE_VALIDATORS_REQUIRED/,
   'missing '+field+' on image '+i+' '+method);
  const url=f.calls.findLast(x=>x.method===method&&x.url.endsWith('.webp'));
  assert.ok(url,'request must actually be made before denying');
  assert.ok(url.url.includes(SHA(assetBodies[i])));
  assert.equal(f.calls.filter(x=>x.url.includes('.webp')).length,i*2+(method==='HEAD'?2:1),
   'stop before subsequent image once missing validator is detected');
  n++;
 }
 assert.equal(n,8);
});

test('a valid earlier image does not produce a partial SCOPED_PASS after later HEAD/GET denial',async()=>{
 for(const [method,field] of [['GET','etag'],['GET','last-modified'],
   ['HEAD','etag'],['HEAD','last-modified']]){
  const f=harness({which:1,method,field});
  let released=false;
  try{await verifySteamLiveImagePhase({...opts,fetchImpl:f.fetchImpl});released=true}
  catch(e){assert.match(String(e),/LIVE_ON_CACHE_VALIDATORS_REQUIRED/)}
  assert.equal(released,false,'partial batch must never be accepted');
  assert.deepEqual(f.calls.filter(c=>c.url.includes(SHA(assetBodies[0]))).map(c=>c.method),
   ['GET','HEAD'],'first target was really checked before final failure');
 }
});

test('matching validators belong to the same URL and request generation, not a different image',async()=>{
 for(const i of [0,1]){
  const f=harness({which:i,method:'HEAD',different:true});
  await assert.rejects(verifySteamLiveImagePhase({...opts,fetchImpl:f.fetchImpl}),
   /LIVE_GET_HEAD_CACHE_VALIDATORS_MISMATCH/);
 }
 for(const i of [0,1])for(const method of ['GET','HEAD']){
  const f=harness({which:i,method,malformed:true});
  await assert.rejects(verifySteamLiveImagePhase({...opts,fetchImpl:f.fetchImpl}),
   /LIVE_CACHE_VALIDATOR_INVALID/);
 }
});

test('no 304, wrong MIME, or mismatched bytes can be laundered as cache-complete ON',async()=>{
 const f1=harness({which:1,method:'HEAD',brokenStatus:true});
 await assert.rejects(verifySteamLiveImagePhase({...opts,fetchImpl:f1.fetchImpl}),
  /LIVE_IMAGE_HEAD_NOT_200/);
 const f2=harness({which:0,method:'GET',wrongMime:true});
 await assert.rejects(verifySteamLiveImagePhase({...opts,fetchImpl:f2.fetchImpl}),
  /LIVE_IMAGE_MIME_INVALID/);
 const f3=harness({which:1,method:'GET',wrongBytes:true});
 await assert.rejects(verifySteamLiveImagePhase({...opts,fetchImpl:f3.fetchImpl}),
  /LIVE_WEBP_LENGTH_OR_SHA_MISMATCH/);
});

test('successful synthetic ON, even self-hashed, cannot mint protected 09INT prior ON withdrawal authority',async()=>{
 const f=harness(),seen=await verifySteamLiveImagePhase({...opts,fetchImpl:f.fetchImpl});
 const withdrawalCalls=[];
 const withdrawFetch=async(url,args)=>{withdrawalCalls.push([url,args]);throw Error('network must not run')};
 await assert.rejects(verifySteamLiveImagePhase({...opts,phase:'WITHDRAW',
  priorOnReceipt:seen.receipt,expectedOnReceiptSha256:seen.sha256,fetchImpl:withdrawFetch}),
  /SIGNED_ON_ORIGIN_PROVENANCE_REQUIRED/);
 assert.equal(withdrawalCalls.length,0);
 const official=JSON.parse(readFileSync(new URL('../scripts/07dbk-steam-image-trusted-on-anchors.json',import.meta.url),'utf8'));
 assert.equal(official.schema,'wand.dbk.protected-on-origin@1');
 assert.deepEqual(official.records,[],'test must never mint a signed operator anchor');
});
