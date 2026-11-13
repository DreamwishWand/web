// Independent changed-risk QA only. Synthetic review metadata; no media bytes or private Save.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {get} from 'svelte/store';
import {chromium} from 'playwright-core';
import * as M from '../src/lib/item-media/switch1253-public-item-images.mjs';
import {ITEM_IMAGE_OWNER_DECISION_ID as DECISION} from '../src/lib/item-media/public-item-images.mjs';
const S='e94dbfb7eeb303b4e738d202f8ec0733ac34cd2d',B='3b8fa25f5961e97789245544a0eb04c932ee7c31';
const pins={'src/lib/item-media/switch1253-public-item-images.mjs':'52596b3a6e149aa1f95e67da6f3c87aa6a4ca3e2','tests/web-switch1253-item-thumb-contract.test.mjs':'76708e72e279b859ca8301008db638399b08e21e','.github/workflows/web-shared-catalog-detail.yml':'21cbeb651341a144de700691f25802a25b5ed403'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',S,'HEAD'),S);
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>'M\t'+p).sort());
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr1016-issue604-media-policy-20261113.yml','A\tscripts/04qr-w-pr1016-issue604-media-policy-independent-20261113.mjs'].sort());
for(const [p,h] of Object.entries(pins)){assert.equal(git('rev-parse',S+':'+p),h);assert.equal(git('hash-object',p),h)}
for(const p of ['src/lib/ui/ItemThumb.svelte','src/lib/ui/ItemImagePreferences.svelte','src/lib/item-media/public-item-images.mjs','scripts/web-shared-catalog-e2e-chrome.mjs'])assert.equal(git('rev-parse',B+':'+p),git('rev-parse','HEAD:'+p));
assert.equal(DECISION,'OWNER_GO_FOR_DDV_GAME_IMAGES_20261105');assert.equal(M.SWITCH1253_OWNER_SCOPE,'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS');
const id='40006096',pin=M.SWITCH1253_NATIVE_PINS[id],copy=x=>JSON.parse(JSON.stringify(x));
const target={platform:'Nintendo Switch',gameVersion:'1.25.3',buildID:'9A239D3DB569756D',schema:626};
const shaFields={originalNativeStreamSha256:pin.originalNativeStreamSha256,sourcePngSha256:pin.sourcePngSha256,webpSha256:pin.webpSha256};
function pair(licensed=false){
 const pub={decisionId:'OWNER_GO_FOR_DDV_GAME_IMAGES_20261105',scope:'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS',
 rightsHolderLicense:licensed?'DOCUMENTED_SCOPE_LICENSE':'UNKNOWN',licenseEvidenceSha256:licensed?'a1'.repeat(32):null,
 rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',
 managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'b2'.repeat(32)};
 const item={...shaFields,rightsStatus:licensed?'DOCUMENTED_LICENSE_APPROVED':'UNKNOWN',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',visibility:'RELEASED_PLAYER_FACING'};
 return {r:{mediaPublic:true,...pub,items:{[id]:{...item}}},m:{schema:M.SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:M.SWITCH1253_ITEM_IMAGE_VARIANT,codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,source:{...target,originalBundleSha256:M.SWITCH1253_ORIGINAL_BUNDLE_SHA256},target:{...target},publication:{gate:'MEDIA_PUBLIC_SCOPED_ON',...pub},items:{[id]:{...item,rasterStatus:pin.rasterStatus,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'}}}};
}
const expectedPath='/web/ddv/item-images/switch-1.25.3-schema626-lossless160-v1/'+shaFields.originalNativeStreamSha256.slice(0,2)+'/'+Object.values(shaFields).join('-')+'.webp';
for(const licensed of [false,true]){
 const {r,m}=pair(licensed);const c=M.validateSwitch1253ItemImageCatalog(m,r);
 assert.equal(c.count,1);assert.equal(M.scopedSwitch1253ItemImageHref('/web',id,c),expectedPath);
 assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.items)&&Object.isFrozen(c.items[id]));
 assert.deepEqual(Object.keys(c.items[id]).sort(),Object.keys(shaFields).sort());
 m.items[id].webpSha256='0'.repeat(64);r.items[id].publicationDecision='REVOKED';
 assert.equal(M.scopedSwitch1253ItemImageHref('/web',id,c),expectedPath,'validated catalog immutable snapshot, not live revocation proof');
}
console.log('QRW1016_SYNTHETIC_UNKNOWN_AND_DOCUMENTED_DISTINCT_POSITIVE_PASS');
let count=0;
function deny(label,mutate,licensed=false){
 const {m,r}=pair(licensed);mutate(m,r);
 assert.throws(()=>M.validateSwitch1253ItemImageCatalog(m,r),/SWITCH1253_ITEM_IMAGE_/,label);count++;
}
for(const licensed of [false,true]){
 const {m}=pair(licensed);
 for(const k of Object.keys(m.publication)){
  deny('manifest missing '+k,(m)=>delete m.publication[k],licensed);
  deny('manifest wrong '+k,m=>{m.publication[k]='forged-'+k},licensed);
 }
 for(const k of ['decisionId','scope','rightsReview','receivingContact','takedown','managedHttps','attribution','oldUrlAndCache','rollback','operatorReceiptSha256']){
  deny('both agree invalid '+k,(m,r)=>{m.publication[k]=r[k]='NOT_RUN'},licensed);
  deny('compiled missing '+k,(m,r)=>delete r[k],licensed);
 }
 for(const k of ['publicationDecision','visibility','rightsStatus']){
  deny('compiled missing '+k,(m,r)=>delete r.items[id][k],licensed);
  deny('manifest missing '+k,m=>delete m.items[id][k],licensed);
  deny('compiled vs manifest '+k,(m,r)=>{r.items[id][k]='REVOKED'},licensed);
 }
 for(const vis of ['HIDDEN','UNRELEASED','PRIVATE','UGC','THIRD_PARTY_WIKI','UNKNOWN']){
  deny('matching disallowed visibility '+vis,(m,r)=>{m.items[id].visibility=r.items[id].visibility=vis},licensed);
 }
 for(const decision of ['OWNER_GO_FOR_DDV_GAME_IMAGES_20261105','APPROVED','LICENSED','REVOKED','WAIT']){
  deny('matching non-per-item decision '+decision,(m,r)=>{m.items[id].publicationDecision=r.items[id].publicationDecision=decision},licensed);
 }
 deny('manifest cannot add unreviewed item',(m,r)=>{r.items={}},licensed);
 deny('unknown native ID even if reviewed',(m,r)=>{m.items['40002422']=m.items[id];r.items['40002422']=r.items[id]},licensed);
 deny('inherited review entry',(m,r)=>{r.items=Object.create(r.items)},licensed);
 deny('extra receipt field',m=>{m.publication.operatorReceipt={accepted:true}},licensed);
 deny('extra per-item scope field',(m,r)=>{r.items[id].scope='ALL'},licensed);
 deny('different matching source pin',(m,r)=>{m.items[id].sourcePngSha256=r.items[id].sourcePngSha256='f'.repeat(64)},licensed);
 deny('compiled OFF manifest ON',(m,r)=>{r.mediaPublic=false},licensed);
}
for(const v of ['',false,0,{},'A'.repeat(64),'f'.repeat(63),'g'.repeat(64),null]){
 deny('documented invalid digest '+String(v),(m,r)=>{m.publication.licenseEvidenceSha256=r.licenseEvidenceSha256=v},true);
}
deny('documented mismatched valid digest',m=>{m.publication.licenseEvidenceSha256='c'.repeat(64)},true);
deny('documented manifest downgrade',m=>{m.publication.rightsHolderLicense='UNKNOWN';m.publication.licenseEvidenceSha256=null;m.items[id].rightsStatus='UNKNOWN'},true);
deny('unknown manifest upgrade',m=>{m.publication.rightsHolderLicense='DOCUMENTED_SCOPE_LICENSE';m.publication.licenseEvidenceSha256='c'.repeat(64);m.items[id].rightsStatus='DOCUMENTED_LICENSE_APPROVED'});
deny('UNKNOWN must not claim licence digest',(m,r)=>{m.publication.licenseEvidenceSha256=r.licenseEvidenceSha256='a'.repeat(64)});
deny('UNKNOWN does not permit documented status',(m,r)=>{m.items[id].rightsStatus=r.items[id].rightsStatus='DOCUMENTED_LICENSE_APPROVED'});
deny('valid receipt but wrong reviewed digest',m=>{m.publication.operatorReceiptSha256='d'.repeat(64)});
deny('JSON prototype item key',m=>{m.items=JSON.parse('{"__proto__":{}}')});
assert.equal(M.SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);assert.equal(M.SWITCH1253_REVIEWED_RELEASE.rightsHolderLicense,'UNKNOWN');assert.deepEqual(M.SWITCH1253_REVIEWED_RELEASE.items,{});
let fetches=0;const fake=async()=>{fetches++;return {ok:true,json:async()=>pair().m}};
assert.deepEqual(await Promise.all(['/web','','https://outside.invalid'].map(b=>M.loadSwitch1253PublicItemImageSource(b,fake))),[null,null,null]);
assert.equal(fetches,0);assert.deepEqual(get(M.switch1253PublicItemImageSource),{status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'});
assert.throws(()=>M.validateSwitch1253ItemImageCatalog(pair().m),/MEDIA_RIGHTS_OPERATOR_HOST_GATE_OFF/);
console.log('QRW1016_CHANGED_POLICY_NEGATIVES_PASS '+count+'; compiled OFF zero fetch');
const origin='http://127.0.0.1:4315';
const bin=['google-chrome-stable','google-chrome','chromium'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);assert.ok(bin);
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:320,height:844},serviceWorkers:'block',acceptDownloads:false});
 const p=await ctx.newPage(),media=[],bad=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!==origin||!['GET','HEAD'].includes(req.method())){bad.push(req.method()+' '+u.origin);return route.abort()}
  if(u.pathname.includes('/ddv/item-images/')){
   media.push(u.pathname);
   // A matching synthetic manifest would be offered if requested. OFF must never ask.
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pair().m)});
  }
  return route.continue();
 });
 const url=origin+'/ja/'+id+'/';
 await p.goto(url,{waitUntil:'domcontentloaded'});
 await p.locator('[data-shared-discovery="READY"]').waitFor({timeout:40000});
 const thumb=p.locator('[data-item-thumb-id="'+id+'"]').first();
 await thumb.waitFor();assert.equal(await thumb.getAttribute('data-media-status'),'unavailable');assert.equal(await thumb.locator('img').count(),0);
 await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-shared-discovery="READY"]').waitFor({timeout:40000});
 assert.equal(await thumb.getAttribute('data-media-status'),'unavailable');assert.equal(await thumb.locator('img').count(),0);
 assert.deepEqual(media,[]);assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);
 console.log('QRW1016_REAL_CHROME_OFF_FORGED_MANIFEST_NOT_REQUESTED_RELOAD_PASS');
 await ctx.close();
}finally{await browser.close()}
