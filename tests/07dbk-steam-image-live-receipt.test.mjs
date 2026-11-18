import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {liveTargets,receiptDigest,verifySteamLiveImagePhase} from "../scripts/07dbk-steam-image-live-receipt.mjs";

const digest=b=>createHash("sha256").update(b).digest("hex");
const bytes=Buffer.concat([Buffer.from("RIFF","ascii"),Buffer.alloc(4),Buffer.from("WEBPVP8L","ascii"),Buffer.alloc(14,0x12)]);
const id="40300045",variant="steam-1.25.3-schema626-lossless160-v1",
  path="ddv/item-images/"+variant+"/manifest.json",
  base="https://dreamwishwand.github.io/web/";
const pins={[id]:{webpSha256:digest(bytes),rgba160Sha256:"a".repeat(64),
  bytes:bytes.length,width:160,height:160,codec:"WEBP_LOSSLESS_RGBA_EXACT",
  visibility:"RELEASED_PLAYER_FACING"}};
const opts={baseUrl:base,ids:[id],pins,variant,manifestPath:path,
  clock:()=> "2026-11-18T12:00:00.000Z"};
const fake=(state,overrides={})=>{
  const calls=[];
  const fetchImpl=async (url,{method,headers,redirect}={})=>{
    calls.push({url,method,headers,redirect});
    const isManifest=url.endsWith("manifest.json");
    if(state==="ON"){
      if(isManifest)return new Response(JSON.stringify({schema:"wand.item-images.steam-primary-release@1",
        assetVariant:variant,publication:{gate:"MEDIA_PUBLIC_SCOPED_ON"},
        items:{[id]:{webpSha256:digest(bytes)}}}),{
        status:overrides.manifestStatus??200,headers:{"content-type":"application/json"}});
      if(method==="HEAD")return new Response(null,{
        status:overrides.imageHeadStatus??200,
        headers:{"content-type":"image/webp","content-length":String(bytes.length)}});
      return new Response(overrides.bytes??bytes,{
        status:overrides.imageStatus??200,
        headers:{"content-type":overrides.imageMime??"image/webp"}});
    }
    if(isManifest)return new Response(JSON.stringify({schema:"wand.item-images.steam-primary-release@1",assetVariant:variant,items:
      overrides.manifestKeepsItem?{[id]:{webpSha256:digest(bytes)}}:{}}),{
      status:200,headers:{"content-type":"application/json"}});
    const deniedStatus=overrides.deniedStatus??404;
    // Fetch Response forbids an entity body on 304, 204 and 205. Mock the
    // actual wire semantics, so the verifier (not the test fixture) rejects
    // stale 304 cache responses as LIVE_OLD_IMAGE_URL_STILL_SERVES.
    const noBody=method==="HEAD"||[204,205,304].includes(deniedStatus);
    return new Response(noBody?null:(overrides.deniedPayload??"not found"),{
      status:deniedStatus,headers:{"content-type":"text/plain"}});
  };
  return {fetchImpl,calls};
};
async function on(){const f=fake("ON");const result=await verifySteamLiveImagePhase({...opts,phase:"ON",fetchImpl:f.fetchImpl});return {result,f};}
const withdrawArgs=(onResult,fetchImpl)=>({...opts,phase:"WITHDRAW",fetchImpl,
  priorOnReceipt:onResult.receipt,expectedOnReceiptSha256:onResult.sha256});

test("canonical target pins first real-style SHA URL and rejects arbitrary external hosts",()=>{
  const r=liveTargets(opts);
  assert.equal(r.manifestUrl,base+path);
  assert.equal(r.targets[0].url,base+"ddv/item-images/"+variant+"/"+digest(bytes).slice(0,2)+"/"+digest(bytes)+".webp");
  for(const altered of ["http://dreamwishwand.github.io/web/","https://evil.example/web/",
    "https://evil.example/?url=https://dreamwishwand.com",
    "https://dreamwishwand.github.io/","https://dreamwishwand.github.io/web/?x=1",
    "https://evil-dreamwishwand.com/","https://dreamwishwand.github.io:333/web/"]){
    assert.throws(()=>liveTargets({...opts,baseUrl:altered}));
  }
  for(const ids of [[id,id],["1",id],[],Array(26).fill(id)])assert.throws(()=>liveTargets({...opts,ids}));
  assert.throws(()=>liveTargets({...opts,variant:"../escape"}));
});

test("ON requires actual GET/HEAD MIME exact SHA/size and scoped published manifest, no CDN grant",async()=>{
  const {result,f}=await on();
  assert.equal(result.receipt.result,"SCOPED_PASS");
  assert.equal(result.receipt.phase,"ON");
  assert.equal(result.receipt.checks.length,3);
  assert.deepEqual(result.receipt.checks.map(x=>x.status),[200,200,200]);
  assert.deepEqual(f.calls.map(x=>x.method),["GET","GET","HEAD"]);
  assert.equal(f.calls.every(x=>x.redirect==="manual"),true);
  assert.equal(result.receipt.fullGlobalCdnPurge,"NOT_PROVED");
  assert.equal(result.receipt.providerPurgeAction,"NOT_PERFORMED");
  assert.equal(receiptDigest(result.receipt),result.sha256);
});
test("WITHDRAW cannot be inferred from prepublication 404 without immutable pinned prior ON receipt",async()=>{
  const f=fake("WITHDRAW");
  await assert.rejects(verifySteamLiveImagePhase({...opts,phase:"WITHDRAW",fetchImpl:f.fetchImpl}),
    /PINNED_PRIOR_REAL_ON_RECEIPT_REQUIRED/);
  assert.equal(f.calls.length,0,"must not touch network before validating past publication proof");
  const {result:onResult}=await on();
  await assert.rejects(verifySteamLiveImagePhase({...withdrawArgs(onResult,f.fetchImpl),
    expectedOnReceiptSha256:"a".repeat(64)}),/PINNED_PRIOR_REAL_ON_RECEIPT_REQUIRED/);
  assert.equal(f.calls.length,0);
  const forged={...onResult.receipt,result:"SCOPED_PASS",phase:"ON",
    targets:[{...onResult.receipt.targets[0],webpSha256:"b".repeat(64)}]};
  await assert.rejects(verifySteamLiveImagePhase({...withdrawArgs(onResult,f.fetchImpl),
    priorOnReceipt:forged,expectedOnReceiptSha256:receiptDigest(forged)}),
    /PRIOR_PUBLIC_URL_SET_MISMATCH/);
  assert.equal(f.calls.length,0);
});

test("published ON proof allows scoped postwithdraw manifest absence and 4 old URL denial probes",async()=>{
  const {result:published}=await on(),f=fake("WITHDRAW");
  const {receipt,sha256}=await verifySteamLiveImagePhase(withdrawArgs(published,f.fetchImpl));
  assert.equal(receipt.phase,"WITHDRAW");
  assert.equal(receipt.checks.length,5);
  assert.deepEqual(receipt.checks.map(x=>x.status),[200,404,404,404,404]);
  assert.deepEqual(receipt.checks.slice(1).map(x=>x.method),
    ["GET","HEAD","GET_IF_NONE_MATCH","GET_IF_MODIFIED_SINCE"]);
  assert.equal(f.calls.some(c=>c.headers["If-None-Match"]),true);
  assert.equal(f.calls.some(c=>c.headers["If-Modified-Since"]),true);
  assert.equal(receipt.priorOnReceiptSha256,published.sha256);
  assert.equal(sha256,receiptDigest(receipt));
  assert.equal(receipt.fullGlobalCdnPurge,"NOT_PROVED");
});
test("withdrawal fails on retained manifest, any cached 200/304/redirect or image signature",async()=>{
  const {result:published}=await on();
  for(const overrides of [{manifestKeepsItem:true},{deniedStatus:200},{deniedStatus:304},
    {deniedStatus:302},{deniedPayload:bytes}]){
    const f=fake("WITHDRAW",overrides);
    await assert.rejects(verifySteamLiveImagePhase(withdrawArgs(published,f.fetchImpl)),
      /WITHDRAW_MANIFEST_RETAINS_ITEM|LIVE_OLD_IMAGE_URL_STILL_SERVES|WITHDRAW_REPLY_CONTAINS_IMAGE_BYTES/);
  }
});
test("ON fails if public bytes, status, content type or manifest are not the pinned release",async()=>{
  for(const overrides of [{imageStatus:404},{imageStatus:302},{imageHeadStatus:304},
    {imageMime:"text/html"},{bytes:Buffer.from("RIFF not the pinned image")},{manifestStatus:404}]){
    const f=fake("ON",overrides);
    await assert.rejects(verifySteamLiveImagePhase({...opts,phase:"ON",fetchImpl:f.fetchImpl}),
      /LIVE_/);
  }
});

test("WITHDRAW rejects hashed-but-forged prior ON checks before any HTTP",async()=>{
  const {result:published}=await on();
  for(const mutate of [
    checks=>checks.map((c,i)=>i===1?{...c,url:"https://foreign.example/forged.webp"}:c),
    checks=>checks.map((c,i)=>i===2?{...c,method:"GET"}:c),
    checks=>checks.map((c,i)=>i===0?{...c,url:liveTargets(opts).targets[0].url}:c),
    checks=>checks.map((c,i)=>i===1?{...c,status:304}:c)
  ]){
    const forged={...published.receipt,checks:mutate(published.receipt.checks)};
    const f=fake("WITHDRAW");
    await assert.rejects(verifySteamLiveImagePhase({...withdrawArgs(published,f.fetchImpl),
      priorOnReceipt:forged,expectedOnReceiptSha256:receiptDigest(forged)}),
      /PRIOR_ON_EVIDENCE_NOT_COMPLETE/);
    assert.equal(f.calls.length,0,"unverified prior ON must fail before network");
  }
});

test("WITHDRAW 200 manifest must retain exact release schema, variant and item map",async()=>{
  const {result:published}=await on();
  const good={schema:"wand.item-images.steam-primary-release@1",
    assetVariant:variant,publication:{gate:"MEDIA_PUBLIC_SCOPED_ON"},items:{}};
  for(const wrong of [{},{items:{}},
    {...good,schema:"foreign.release.manifest"},{...good,assetVariant:"wrong-variant"},
    {...good,items:null},{...good,items:[]}]) {
    const f=fake("WITHDRAW");
    const fetchImpl=(url,args)=>url.endsWith("manifest.json")
      ? Promise.resolve(new Response(JSON.stringify(wrong),{
          status:200,headers:{"content-type":"application/json"}}))
      : f.fetchImpl(url,args);
    await assert.rejects(verifySteamLiveImagePhase({...withdrawArgs(published,fetchImpl)}),
      /WITHDRAW_MANIFEST_SCHEMA_OR_VARIANT_INVALID/);
    assert.equal(f.calls.length,0,"wrong manifest fails before asset checks");
  }
});

test("ON and withdrawal never treat a source-only candidate receipt as an operator deployment",async()=>{
  const {result:published}=await on();
  assert.notEqual(published.receipt.scope,"SIGNED_DEPLOYMENT_AUTHORIZATION");
  assert.equal(published.receipt.fullGlobalCdnPurge,"NOT_PROVED");
  const f=fake("WITHDRAW");
  const result=await verifySteamLiveImagePhase(withdrawArgs(published,f.fetchImpl));
  assert.equal(result.receipt.providerPurgeAction,"NOT_PERFORMED");
  assert.equal(f.calls.every(c=>c.url.startsWith(base)),true);
});
