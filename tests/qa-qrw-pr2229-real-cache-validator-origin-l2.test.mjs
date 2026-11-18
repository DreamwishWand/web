// 04 QR-W existing ACT-20261118-04QRW-PR2229-REAL-ON-CACHE-VAL-L2
// Independent actual 07 DBK verifier. Synthetic bytes/anchors isolated in /tmp;
// do not modify public image3, real CDN, producer or protected trust file.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {verifySteamLiveImagePhase,liveTargets,receiptDigest} from '../scripts/07dbk-steam-image-live-receipt.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const id='40300045',variant='steam-1.25.3-schema626-lossless160-v1';
const raw=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBPVP8L'),Buffer.alloc(20,0x56)]);
const ETag='"6afd8e3c-3bce"';
const date='Wed, 18 Nov 2026 11:38:36 GMT';
const spec={baseUrl:'https://dreamwishwand.github.io/web/',ids:[id],
 pins:{[id]:{webpSha256:sha(raw),rgba160Sha256:'f'.repeat(64),bytes:raw.length,width:160,height:160,
  codec:'WEBP_LOSSLESS_RGBA_EXACT',visibility:'RELEASED_PLAYER_FACING'}},variant,
 manifestPath:'ddv/item-images/'+variant+'/manifest.json',clock:()=> '2026-11-18T12:00:00Z'};
const targets=liveTargets(spec);
function fixture(phase='ON',options={}){
 const requests=[];
 const fetchImpl=async(url,{method,headers,redirect})=>{
  requests.push({url,method,headers,redirect});
  const manifest=url===targets.manifestUrl;
  if(manifest)return new Response(JSON.stringify(phase==='ON'
   ? {schema:'wand.item-images.steam-primary-release@1',assetVariant:variant,
      publication:{gate:'MEDIA_PUBLIC_SCOPED_ON'},items:{[id]:{webpSha256:sha(raw)}}}
   : {schema:'wand.item-images.steam-primary-release@1',assetVariant:variant,items:{}}),
   {status:200,headers:{'content-type':'application/json'}});
  if(phase==='WITHDRAW'){
   if(options.retained==='etag'&&headers['If-None-Match']===ETag)return new Response(null,{status:304});
   if(options.retained==='date'&&headers['If-Modified-Since']===date)return new Response(null,{status:304});
   return new Response(method==='HEAD'?null:'Not Found',{status:404,headers:{'content-type':'text/plain'}});
  }
  const incoming=(method==='HEAD'&&options.head)||options;
  const cache={etag:incoming.etag===undefined?ETag:incoming.etag,
    'last-modified':incoming.date===undefined?date:incoming.date};
  if(cache.etag===null)delete cache.etag;
  if(cache['last-modified']===null)delete cache['last-modified'];
  const hdr={'content-type':'image/webp',...cache};
  if(method==='HEAD')return new Response(null,{status:200,headers:{...hdr,'content-length':String(raw.length)}});
  return new Response(raw,{status:200,headers:hdr});
 };
 return {fetchImpl,requests};
}
async function published(options={}){const f=fixture('ON',options);
 const publication=await verifySteamLiveImagePhase({...spec,phase:'ON',fetchImpl:f.fetchImpl});
 return {...publication,requests:f.requests};
}
const originalScript=fileURLToPath(new URL('../scripts/07dbk-steam-image-live-receipt.mjs',import.meta.url));
const sandbox=mkdtempSync(join(tmpdir(),'wand-qrw2229-'));
after(()=>rmSync(sandbox,{force:true,recursive:true}));
async function anchorIsolated(pub){
 const dir=mkdtempSync(join(sandbox,'single-'));
 copyFileSync(originalScript,join(dir,'verifier.mjs'));
 const record={schema:'wand.dbk.protected-on-origin@1',records:[{
  scope:'STEAM_ITEM_IMAGES_LIVE_HTTP',receiptSha256:pub.sha256,
  targetSetSha256:receiptDigest(targets.targets),base:targets.base,
  manifestUrl:targets.manifestUrl,releaseState:'SIGNED_PAGES_ON_OBSERVED',
  recordedBy:'09_INT_PROTECTED_MAIN',protectedReleaseCommit:'a'.repeat(40),
  protectedPagesRunId:1,liveObserverRunId:2,signedArtifactAttestationSha256:'b'.repeat(64)
 }]};
 writeFileSync(join(dir,'07dbk-steam-image-trusted-on-anchors.json'),JSON.stringify(record));
 return (await import(pathToFileURL(join(dir,'verifier.mjs')).href)).verifySteamLiveImagePhase;
}
const withdrawal=(pub,fetchImpl)=>({...spec,phase:'WITHDRAW',priorOnReceipt:pub.receipt,
 expectedOnReceiptSha256:pub.sha256,fetchImpl});

test('actual ON records precise GET/HEAD cache validators, exact SHA, no operator grant',async()=>{
 const a=await published();
 assert.deepEqual(a.receipt.checks.map(x=>x.method),['GET','GET','HEAD']);
 assert.deepEqual(a.receipt.checks.slice(1).map(x=>x.cacheValidators),[
  {etag:ETag,lastModified:date},{etag:ETag,lastModified:date}]);
 assert.equal(a.sha256,receiptDigest(a.receipt));
 assert.equal(a.receipt.fullGlobalCdnPurge,'NOT_PROVED');
});

test('actual product source trust registry remains empty, self-hashed prior cannot authorize network',async()=>{
 const trusted=JSON.parse(readFileSync(new URL('../scripts/07dbk-steam-image-trusted-on-anchors.json',import.meta.url)));
 assert.deepEqual(trusted.records,[]);
 const pub=await published(),f=fixture('WITHDRAW');
 await assert.rejects(verifySteamLiveImagePhase(withdrawal(pub,f.fetchImpl)),/SIGNED_ON_ORIGIN_PROVENANCE_REQUIRED/);
 assert.equal(f.requests.length,0);
});

test('isolated protected ON anchor: ordinary full old-URL withdrawal checks genuine validators',async()=>{
 const pub=await published(),verify=await anchorIsolated(pub),f=fixture('WITHDRAW');
 const out=await verify(withdrawal(pub,f.fetchImpl));
 assert.deepEqual(out.receipt.checks.map(x=>x.status),[200,404,404,404,404]);
 assert.deepEqual(f.requests.slice(1).map(x=>x.method),['GET','HEAD','GET','GET']);
 assert.equal(f.requests[3].headers['If-None-Match'],ETag);
 assert.equal(f.requests[4].headers['If-Modified-Since'],date);
 assert.equal(out.receipt.providerPurgeAction,'NOT_PERFORMED');
});

test('isolated protected ON anchor must reject CDN stale 304 to actual ETag or date',async()=>{
 const pub=await published(),verify=await anchorIsolated(pub);
 for(const retained of ['etag','date']){
  const f=fixture('WITHDRAW',{retained});
  await assert.rejects(verify(withdrawal(pub,f.fetchImpl)),/LIVE_OLD_IMAGE_URL_STILL_SERVES/,retained);
  assert.equal(f.requests.some(x=>retained==='etag'
    ? x.headers['If-None-Match']===ETag:x.headers['If-Modified-Since']===date),true,retained);
 }
});

test('forged, missing and conflicting prior ON validators are rejected before HTTP even with attacker-computed receipt SHA',async()=>{
 const pub=await published(),verify=await anchorIsolated(pub);
 const malicious=[
  c=>{delete c[1].cacheValidators},
  c=>{c[1].cacheValidators.etag='unquoted'},
  c=>{c[1].cacheValidators.lastModified='not-a-date'},
  c=>{c[2].cacheValidators.etag='"other"'},
  c=>{c[2].cacheValidators.lastModified='Tue, 17 Nov 2026 11:38:36 GMT'},
  c=>{c[1].cacheValidators.etag='"inject\\r\\nHeader: X"'},
 ];
 for(const mutate of malicious){
  const receipt=structuredClone(pub.receipt);
  mutate(receipt.checks);
  const f=fixture('WITHDRAW');
  await assert.rejects(verify({...withdrawal(pub,f.fetchImpl),priorOnReceipt:receipt,
    expectedOnReceiptSha256:receiptDigest(receipt)}),
    /PRIOR_REAL_CACHE_VALIDATORS_REQUIRED|SIGNED_ON_ORIGIN_PROVENANCE_REQUIRED/);
  assert.equal(f.requests.length,0);
 }
});

test('actual ON rejects mismatched GET/HEAD tags or dates, before accepting a fabricated publication',async()=>{
 for(const head of [{etag:'"different"'},{date:'Tue, 17 Nov 2026 11:38:36 GMT'}]){
  const f=fixture('ON',{head});
  await assert.rejects(verifySteamLiveImagePhase({...spec,phase:'ON',fetchImpl:f.fetchImpl}),
    /LIVE_GET_HEAD_CACHE_VALIDATORS_MISMATCH/);
 }
});

test('IMF-fixdate must represent the actual calendar day and weekday, not just Date.parse finite',async()=>{
 // Neither is a genuine IMF-fixdate. Native JS Date.parse accepts both by
 // silently ignoring wrong weekdays and normalizing Nov 31 to Dec 1.
 for(const bad of ['Mon, 18 Nov 2026 11:38:36 GMT','Wed, 31 Nov 2026 11:38:36 GMT']){
  const f=fixture('ON',{date:bad});
  await assert.rejects(verifySteamLiveImagePhase({...spec,phase:'ON',fetchImpl:f.fetchImpl}),
    /LIVE_CACHE_VALIDATOR_INVALID/,bad);
 }
});
