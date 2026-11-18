// 07 DBK — first Item/bounded batch live delivery and withdrawal evidence.
// Read-only HTTP verifier. NEVER uploads, publishes, purges, deploys, or signs.
// A prepublication 404 is NOT a withdrawal: WITHDRAW requires a pinned,
 // previously observed successful ON receipt for these exact canonical URLs.
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const hex=/^[0-9a-f]{64}$/i;
const gitSha=/^[0-9a-f]{40}$/i;
const digest=b=>createHash("sha256").update(b).digest("hex");
// Trust root is an immutable FILE from the protected product build, not a
// JSON hash supplied by the HTTP verifier's caller. 09 INT may fill an
// entry ONLY after the signed Pages artifact and independent real hosted
// ON observer have been verified. Source repository default is EMPTY/OFF.
// Local QA may exercise the positive HTTP path in an isolated temp copy
// with synthetic anchors; the committed product file must never include one.
const protectedOnAnchors=JSON.parse(readFileSync(
  new URL("./07dbk-steam-image-trusted-on-anchors.json",import.meta.url),"utf8"));
if(protectedOnAnchors?.schema!=="wand.dbk.protected-on-origin@1"||
   !Array.isArray(protectedOnAnchors?.records)||
   protectedOnAnchors.records.length>25)
  throw Error("PROTECTED_ON_ANCHOR_REGISTRY_INVALID");
const fail=(code)=>{throw Error(code);};
const allowedHost=h=>h==="dreamwishwand.github.io"||h==="dreamwishwand.com"||
  h.endsWith(".dreamwishwand.com");
export function liveBase(url){
  if(typeof url!=="string")fail("BASE_URL_NOT_STRING");
  let u;try{u=new URL(url);}catch{fail("BASE_URL_INVALID");}
  if(u.protocol!=="https:"||!allowedHost(u.hostname)||u.username||u.password||
      u.port||u.search||u.hash||!u.pathname.endsWith("/")||
      (u.hostname==="dreamwishwand.github.io"&&u.pathname!=="/web/"))
    fail("PUBLIC_HOST_OR_BASE_NOT_ALLOWED");
  return u.toString();
}
const pinValid=p=>p&&hex.test(p.webpSha256??"")&&hex.test(p.rgba160Sha256??"")&&
  Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.width===160&&p.height===160&&
  p.codec==="WEBP_LOSSLESS_RGBA_EXACT"&&p.visibility==="RELEASED_PLAYER_FACING";
export function liveTargets({baseUrl,ids,pins,variant,manifestPath}){
  const base=liveBase(baseUrl);
  if(!Array.isArray(ids)||!ids.length||ids.length>25||new Set(ids).size!==ids.length||
     ids.some(id=>typeof id!=="string"||!/^[1-9][0-9]{0,15}$/.test(id)))
    fail("ITEM_SCOPE_INVALID");
  if(typeof variant!=="string"||!/^steam-[a-z0-9.-]+$/.test(variant)||
    manifestPath!=="ddv/item-images/"+variant+"/manifest.json")
    fail("MANIFEST_VARIANT_UNVERIFIED");
  const targets=ids.map(id=>{
    const pin=Object.hasOwn(pins??{},id)?pins[id]:null;
    if(!pinValid(pin))fail("ITEM_PIN_INVALID:"+id);
    const path="ddv/item-images/"+variant+"/"+pin.webpSha256.slice(0,2)+"/"+
      pin.webpSha256+".webp";
    return Object.freeze({id,url:new URL(path,base).toString(),webpSha256:pin.webpSha256.toLowerCase(),bytes:pin.bytes});
  });
  return Object.freeze({base,manifestUrl:new URL(manifestPath,base).toString(),
    targets:Object.freeze(targets)});
}
export function receiptDigest(receipt){
  return digest(Buffer.from(JSON.stringify(receipt),"utf8"));
}
async function request(fetchImpl,url,method,headers={}){
  const res=await fetchImpl(url,{method,redirect:"manual",
    headers:{"Cache-Control":"no-cache, max-age=0",Pragma:"no-cache",...headers},
    signal:AbortSignal.timeout(20000)});
  if(!Number.isSafeInteger(res?.status))fail("HTTP_RESPONSE_MISSING");
  return res;
}
const contentType=(r)=>String(r.headers?.get("content-type")??"").split(";")[0].trim().toLowerCase();
const ensureStatus=(r,n,code)=>{if(r.status!==n)fail(code+":"+r.status);};
function ensureImage(bytes,target){
  if(bytes.byteLength!==target.bytes||digest(bytes)!==target.webpSha256)
    fail("LIVE_WEBP_LENGTH_OR_SHA_MISMATCH:"+target.id);
  if(bytes.byteLength<16||bytes.toString("ascii",0,4)!=="RIFF"||
     bytes.toString("ascii",8,12)!=="WEBP"||bytes.toString("ascii",12,16)!=="VP8L")
    fail("LIVE_WEBP_NOT_LOSSLESS:"+target.id);
}
function pinnedOnReceipt(prior,expectedSha,urls){
  if(!hex.test(expectedSha??"")||!prior||receiptDigest(prior)!==expectedSha.toLowerCase()||
      prior.phase!=="ON"||prior.result!=="SCOPED_PASS"||
      prior.scope!=="STEAM_ITEM_IMAGES_LIVE_HTTP"||prior.base!==urls.base)
    fail("PINNED_PRIOR_REAL_ON_RECEIPT_REQUIRED");
  if(!Array.isArray(prior.targets)||prior.targets.length!==urls.targets.length||
    prior.targets.some((p,i)=>p.id!==urls.targets[i].id||
      p.url!==urls.targets[i].url||p.webpSha256!==urls.targets[i].webpSha256||
      p.bytes!==urls.targets[i].bytes))
    fail("PRIOR_PUBLIC_URL_SET_MISMATCH");
  // Hash-pinning alone cannot attest the history: the prior ON proof must
  // name the exact manifest/asset URLs and the actual GET and HEAD methods.
  // A forged receipt with all status=200 is not a publication observation.
  const expectedChecks=[
    {url:urls.manifestUrl,method:"GET"},
    ...urls.targets.flatMap(t=>[
      {url:t.url,method:"GET"},{url:t.url,method:"HEAD"}])
  ];
  if(prior.manifestUrl!==urls.manifestUrl||
     !Array.isArray(prior.checks)||prior.checks.length!==expectedChecks.length||
     prior.checks.some((c,i)=>!c||c.url!==expectedChecks[i].url||
       c.method!==expectedChecks[i].method||c.status!==200))
    fail("PRIOR_ON_EVIDENCE_NOT_COMPLETE");
  // Integrity of caller-supplied JSON is NOT provenance. A self-calculated
  // SHA cannot establish that any prior ON HTTP observation actually ran.
  // The recorded SHA is a trust anchor only when 09 INT independently
  // fixes it in the protected release source after signed Pages + live ON.
  // Never accept a caller-injected record, path, digest list or trust callback.
  const targetSetSha256=receiptDigest(urls.targets);
  const anchored=protectedOnAnchors.records.some(a=>a &&
    a.receiptSha256===expectedSha.toLowerCase()&&
    a.targetSetSha256===targetSetSha256&&
    a.base===urls.base&&a.manifestUrl===urls.manifestUrl&&
    a.scope==="STEAM_ITEM_IMAGES_LIVE_HTTP"&&
    a.releaseState==="SIGNED_PAGES_ON_OBSERVED"&&
    a.recordedBy==="09_INT_PROTECTED_MAIN"&&
    gitSha.test(a.protectedReleaseCommit??"")&&
    Number.isSafeInteger(a.protectedPagesRunId)&&a.protectedPagesRunId>0&&
    Number.isSafeInteger(a.liveObserverRunId)&&a.liveObserverRunId>0&&
    hex.test(a.signedArtifactAttestationSha256??""));
  if(!anchored)fail("SIGNED_ON_ORIGIN_PROVENANCE_REQUIRED");
}
export async function verifySteamLiveImagePhase({
  phase,baseUrl,ids,pins,variant,manifestPath,priorOnReceipt=null,
  expectedOnReceiptSha256=null,fetchImpl=fetch,clock=()=>new Date().toISOString()
}){
  if(phase!=="ON"&&phase!=="WITHDRAW")fail("UNKNOWN_PHASE");
  const urls=liveTargets({baseUrl,ids,pins,variant,manifestPath});
  if(phase==="WITHDRAW")pinnedOnReceipt(priorOnReceipt,expectedOnReceiptSha256,urls);
  const checks=[];
  const check=(url,method,status)=>checks.push({url,method,status});
  // The immutable manifest URL remains a mutable authorization index. On
  // withdrawal a 200 is permissible ONLY if it excludes ALL withdrawn IDs.
  const manifest=await request(fetchImpl,urls.manifestUrl,"GET");
  if(phase==="ON"){
    ensureStatus(manifest,200,"LIVE_MANIFEST_NOT_200");
    if(contentType(manifest)!=="application/json")fail("LIVE_MANIFEST_MIME_INVALID");
    const m=await manifest.json();
    if(m?.schema!=="wand.item-images.steam-primary-release@1"||
       m.assetVariant!==variant||m.publication?.gate!=="MEDIA_PUBLIC_SCOPED_ON")
      fail("LIVE_MANIFEST_RELEASE_SCOPE_INVALID");
    for(const target of urls.targets)
      if(m.items?.[target.id]?.webpSha256?.toLowerCase()!==target.webpSha256)
        fail("LIVE_MANIFEST_ITEM_MISMATCH:"+target.id);
  }else if(manifest.status===200){
    if(contentType(manifest)!=="application/json")fail("WITHDRAW_MANIFEST_MIME_INVALID");
    const m=await manifest.json();
    // Only the same typed, version-bound manifest can attest that the
    // previously published ItemIDs were removed. A 200 empty/foreign JSON
    // object is not valid withdrawal evidence.
    if(m?.schema!=="wand.item-images.steam-primary-release@1"||
       m.assetVariant!==variant||!m.items||typeof m.items!=="object"||
       Array.isArray(m.items))
      fail("WITHDRAW_MANIFEST_SCHEMA_OR_VARIANT_INVALID");
    for(const target of urls.targets)
      if(Object.hasOwn(m.items,target.id))
        fail("WITHDRAW_MANIFEST_RETAINS_ITEM:"+target.id);
  }else if(manifest.status!==404&&manifest.status!==410){
    fail("WITHDRAW_MANIFEST_NOT_REMOVED_OR_REWRITTEN:"+manifest.status);
  }
  check(urls.manifestUrl,"GET",manifest.status);
  for(const target of urls.targets){
    if(phase==="ON"){
      const r=await request(fetchImpl,target.url,"GET");
      ensureStatus(r,200,"LIVE_IMAGE_NOT_200:"+target.id);
      if(contentType(r)!=="image/webp")fail("LIVE_IMAGE_MIME_INVALID:"+target.id);
      const b=Buffer.from(await r.arrayBuffer());
      ensureImage(b,target);
      check(target.url,"GET",200);
      const head=await request(fetchImpl,target.url,"HEAD");
      ensureStatus(head,200,"LIVE_IMAGE_HEAD_NOT_200:"+target.id);
      if(contentType(head)!=="image/webp")fail("LIVE_HEAD_MIME_INVALID:"+target.id);
      const len=head.headers.get("content-length");
      if(len!==null&&Number(len)!==target.bytes)fail("LIVE_HEAD_LENGTH_INVALID:"+target.id);
      check(target.url,"HEAD",200);
    }else{
      const variants=[
        ["GET",{},"GET"],
        ["HEAD",{},"HEAD"],
        ["GET",{"If-None-Match":'"prior-visible-image"'},"GET_IF_NONE_MATCH"],
        ["GET",{"If-Modified-Since":"Wed, 01 Jan 2025 00:00:00 GMT"},"GET_IF_MODIFIED_SINCE"]
      ];
      for(const [method,headers,label] of variants){
        const r=await request(fetchImpl,target.url,method,headers);
        if(r.status!==404&&r.status!==410)
          fail("LIVE_OLD_IMAGE_URL_STILL_SERVES:"+target.id+":"+label+":"+r.status);
        if(method==="GET"){
          const b=Buffer.from(await r.arrayBuffer());
          if(b.toString("ascii",0,4)==="RIFF")fail("WITHDRAW_REPLY_CONTAINS_IMAGE_BYTES");
        }
        check(target.url,label,r.status);
      }
    }
  }
  const receipt=Object.freeze({scope:"STEAM_ITEM_IMAGES_LIVE_HTTP",phase,
    result:"SCOPED_PASS",checkedAt:clock(),base:urls.base,manifestUrl:urls.manifestUrl,
    targets:urls.targets,checks,
    priorOnReceiptSha256:phase==="WITHDRAW"?expectedOnReceiptSha256:null,
    fullGlobalCdnPurge:"NOT_PROVED",providerPurgeAction:"NOT_PERFORMED"});
  return {receipt,sha256:receiptDigest(receipt)};
}
async function cli(){
  const args=process.argv.slice(2);
  const phase=args[0]?.toUpperCase();
  const readFlag=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
  const baseUrl=readFlag("--base"),ids=readFlag("--ids")?.split(","),
    output=readFlag("--output");
  if(!["ON","WITHDRAW"].includes(phase)||!baseUrl||!ids||!output)
    fail("USAGE: ON|WITHDRAW --base HTTPS_URL --ids ITEM[,ITEM] --output JSON [--prior-json PATH --prior-sha SHA]");
  const {STEAM1253_NATIVE_PINS,STEAM1253_ITEM_IMAGE_VARIANT,STEAM1253_MANIFEST_PATH,
    STEAM1253_REVIEWED_RELEASE}=await import("../src/lib/item-media/switch1253-public-item-images.mjs");
  // A mutable network JSON must not override compiled rights/operation scope.
  if(phase==="ON"&&(!STEAM1253_REVIEWED_RELEASE.mediaPublic||
    ids.some(id=>!Object.hasOwn(STEAM1253_REVIEWED_RELEASE.items,id))))
    fail("COMPILED_OPERATOR_MEDIA_PUBLIC_OFF");
  // The external SHA is integrity only. WITHDRAW additionally needs a
  // separately recorded 09 INT protected real ON anchor or it fails closed.
  const priorPath=readFlag("--prior-json"),priorSha=readFlag("--prior-sha");
  const prior=priorPath?JSON.parse(readFileSync(priorPath,"utf8")).receipt:null;
  const result=await verifySteamLiveImagePhase({phase,baseUrl,ids,pins:STEAM1253_NATIVE_PINS,
    variant:STEAM1253_ITEM_IMAGE_VARIANT,manifestPath:STEAM1253_MANIFEST_PATH,
    priorOnReceipt:prior,expectedOnReceiptSha256:priorSha});
  writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
  console.log("07DBK_REAL_"+phase+"_SCOPED_PASS checks="+result.receipt.checks.length+
    " sha256="+result.sha256+" globalCdnPurge=NOT_PROVED");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  cli().catch(err=>{console.error("07DBK_LIVE_VERIFY_FAIL",err.message);process.exitCode=1;});
}
