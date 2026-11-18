import test from 'node:test';
import assert from 'node:assert/strict';
import {
 STEAM1253_DOOR_ID,STEAM1253_REVIEWED_RELEASE,STEAM1253_MANIFEST_PATH,
 SWITCH1253_REVIEWED_RELEASE,SWITCH1253_MANIFEST_PATH,
 prepareSteam1253ItemImageManifest,prepareSwitch1253ItemImageManifest,
 validateSteam1253ItemImageCatalog,validateSwitch1253ItemImageCatalog,
 scopedSteam1253ItemImageHref,scopedSwitch1253ItemImageHref,
 createSteam1253ManifestController,createSwitch1253ManifestController
} from '../src/lib/item-media/switch1253-public-item-images.mjs';
import {ITEM_IMAGE_OWNER_DECISION_ID} from '../src/lib/item-media/public-item-images.mjs';
import {readFileSync} from 'node:fs';

const shared='COMMON_DISNEY_GAMELOFT_NONAFFILIATION_SUPPORT';
const ownerRisk='OWNER_RESIDUAL_RIGHTS_RISK_ACCEPTED';
const fields=['originalNativeStreamSha256','sourcePngSha256','webpSha256',
 'rightsStatus','publicationDecision','visibility'];
function accepted(kind){
 const steam=kind==='steam',id=steam?STEAM1253_DOOR_ID:'40000047',
  m=steam?prepareSteam1253ItemImageManifest([id]):prepareSwitch1253ItemImageManifest(),
  defaults=steam?STEAM1253_REVIEWED_RELEASE:SWITCH1253_REVIEWED_RELEASE;
 const release={...defaults,mediaPublic:true,rightsReview:ownerRisk,
  receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
  attribution:shared,oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
  operatorReceiptSha256:'b'.repeat(64),items:{}};
 // The existing per-item allowlist denotes inclusion in one scoped signed
 // release; it does not request separate image-by-image Owner approvals.
 const entry=m.items[id];entry.publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
 release.items[id]=Object.fromEntries(fields.map(k=>[k,entry[k]]));
 const {mediaPublic,items,...publication}=release;
 m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
 return {id,release,m};
}
for(const kind of ['steam','switch']){
 const check=kind==='steam'?validateSteam1253ItemImageCatalog:validateSwitch1253ItemImageCatalog,
  defaults=kind==='steam'?STEAM1253_REVIEWED_RELEASE:SWITCH1253_REVIEWED_RELEASE;
 test(kind+' accepts one scoped signed common notice + Owner residual-risk decision, not 8-locale review',()=>{
  const {id,release,m}=accepted(kind);
  assert.equal(defaults.mediaPublic,false,'runtime compiled public gate stays OFF');
  assert.throws(()=>check(m),/GATE_OFF/);
  const cat=check(m,release);
  assert.equal(cat.count,1);
  const url=kind==='steam'?scopedSteam1253ItemImageHref('/web',id,cat):
   scopedSwitch1253ItemImageHref('/web',id,cat);
  assert.match(url,/^\/web\/ddv\/item-images\//);
  assert.equal(kind==='steam'?scopedSteam1253ItemImageHref('/web','40002422',cat):
   scopedSwitch1253ItemImageHref('/web','40006096',cat),null);
  assert.equal(release.rightsHolderLicense,'UNKNOWN','UNKNOWN is not a publication veto by itself');
  // Prior release shape must continue to validate; no manifest migration
  // or second platform resolver is needed.
  const legacy={...release,attribution:'EIGHT_LOCALES_REVIEWED',rightsReview:'OPERATOR_ACCEPTED'};
  const old={...m,publication:{...m.publication,attribution:legacy.attribution,rightsReview:legacy.rightsReview}};
  assert.equal(check(old,legacy).count,1);
 });
 test(kind+' still fails closed for every missing technical/publication acceptance gate',()=>{
  const {release,m}=accepted(kind);
  for(const [key,value] of [
   ['mediaPublic',false],['decisionId','BAD_OWNER_DECISION'],['scope','ALL_ITEMS'],
   ['rightsReview','NOT_RUN'],['attribution','NOT_RUN'],
   ['receivingContact','NOT_RUN'],['takedown','NOT_RUN'],
   ['managedHttps','NOT_RUN'],['oldUrlAndCache','NOT_RUN'],
   ['rollback','NOT_RUN'],['operatorReceiptSha256',null],
   ['rightsHolderLicense','DOCUMENTED_SCOPE_LICENSE'],['licenseEvidenceSha256','a'.repeat(64)]
  ]){
   const bad={...release,[key]:value};
   assert.throws(()=>check(m,bad),undefined,key);
  }
  const untrusted={...m,publication:{...m.publication,attribution:'EIGHT_LOCALES_REVIEWED'}};
  assert.throws(()=>check(untrusted,release),'manifest cannot self-elevate or rewrite signed notice');
  const tampered={...m,items:{...m.items}};
  const id=Object.keys(m.items)[0];
  tampered.items[id]={...m.items[id],webpSha256:'a'.repeat(64)};
  assert.throws(()=>check(tampered,release),'pin SHA may not be substituted');
 });
}
test('production media remains OFF; only shared footer contains owner support and attribution',async()=>{
 const source=readFileSync(new URL('../src/lib/SiteFooter.svelte',import.meta.url),'utf8');
 assert.match(source,/data-image-rights-attribution/);
 assert.match(source,/mailto:support@dreamwishwand\.com/);
 assert.equal(ITEM_IMAGE_OWNER_DECISION_ID.length>0,true);
 const states=[],never=async()=>{throw Error('must not fetch while OFF')};
 const steam=createSteam1253ManifestController(STEAM1253_REVIEWED_RELEASE,
  SWITCH1253_REVIEWED_RELEASE,state=>states.push(state));
 const sw=createSwitch1253ManifestController(SWITCH1253_REVIEWED_RELEASE,state=>states.push(state));
 assert.equal(await steam.load('/web',never),null);
 assert.equal(await sw.load('/web',never),null);
 assert.equal(STEAM1253_MANIFEST_PATH.includes('steam-1.25.3'),true);
 assert.equal(SWITCH1253_MANIFEST_PATH.includes('switch-1.25.3'),true);
 assert(states.every(s=>s.catalog===null));
});
