// Independent 04 QR-W Source-fixed PR2243 Web/Media Consumer owner policy trust.
// Synthetic catalog/receipt only, no actual game art, Save, signing or grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STEAM1253_DOOR_ID,STEAM1253_REVIEWED_RELEASE,SWITCH1253_REVIEWED_RELEASE,
 prepareSteam1253ItemImageManifest,prepareSwitch1253ItemImageManifest,
 validateSteam1253ItemImageCatalog,validateSwitch1253ItemImageCatalog,
 scopedSteam1253ItemImageHref,scopedSwitch1253ItemImageHref,
 createSteam1253ManifestController,createSwitch1253ManifestController
} from '../src/lib/item-media/switch1253-public-item-images.mjs';
const common='COMMON_DISNEY_GAMELOFT_NONAFFILIATION_SUPPORT',risk='OWNER_RESIDUAL_RIGHTS_RISK_ACCEPTED';
function releaseFixture(platform){
 const steam=platform==='steam',id=steam?STEAM1253_DOOR_ID:'40000047';
 const m=steam?prepareSteam1253ItemImageManifest([id]):prepareSwitch1253ItemImageManifest();
 const defaults=steam?STEAM1253_REVIEWED_RELEASE:SWITCH1253_REVIEWED_RELEASE;
 const included=m.items[id];
 included.publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
 const release={...defaults,mediaPublic:true,
  attribution:common,rightsReview:risk,receivingContact:'MANAGED_VERIFIED',
  takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
  oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
  operatorReceiptSha256:'c'.repeat(64),items:{[id]:{
   originalNativeStreamSha256:included.originalNativeStreamSha256,
   sourcePngSha256:included.sourcePngSha256,webpSha256:included.webpSha256,
   rightsStatus:included.rightsStatus,
   publicationDecision:included.publicationDecision,visibility:included.visibility
  }}};
 const {mediaPublic,items,...fields}=release;
 m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...fields};
 return {id,m,release,check:steam?validateSteam1253ItemImageCatalog:validateSwitch1253ItemImageCatalog,
  href:steam?scopedSteam1253ItemImageHref:scopedSwitch1253ItemImageHref,defaults};
}
for(const platform of ['steam','switch']){
 test(platform+' accepts shared notice Owner residual-rights risk without eight human locale gate, preserves legacy',()=>{
  const f=releaseFixture(platform);
  assert.equal(f.defaults.mediaPublic,false);
  assert.throws(()=>f.check(f.m),/GATE_OFF/);
  for(const attr of [common,'EIGHT_LOCALES_REVIEWED']){
   for(const rr of [risk,'OPERATOR_ACCEPTED']){
    const release={...f.release,attribution:attr,rightsReview:rr};
    const m={...f.m,publication:{...f.m.publication,attribution:attr,rightsReview:rr}};
    const catalog=f.check(m,release);
    assert.equal(catalog.count,1);
    assert.match(f.href('/web',f.id,catalog),/^\/web\/ddv\/item-images\//);
    assert.equal(release.rightsHolderLicense,'UNKNOWN');
   }
  }
 });
 test(platform+' denies forged signed publication fields or unauthorized rights/host/cache flags',()=>{
  const f=releaseFixture(platform);
  for(const [key,value] of [
   ['mediaPublic',false],['decisionId','MISMATCH'],['scope','ALL_OWNERSHIP'],
   ['attribution','WIKI_SOURCE_ACCEPTED'],['rightsReview','DLC_AUTO_UNLOCK'],
   ['operatorReceiptSha256','z'.repeat(64)],['oldUrlAndCache','NOT_RUN'],
   ['rollback','NOT_RUN'],['takedown','NOT_RUN'],['receivingContact','NOT_RUN'],
   ['managedHttps','NOT_RUN'],['rightsHolderLicense','DOCUMENTED_SCOPE_LICENSE']]){
   assert.throws(()=>f.check(f.m,{...f.release,[key]:value}),undefined,key);
  }
  for(const [key,val] of [
   ['attribution','EIGHT_LOCALES_REVIEWED'],['rightsReview','OPERATOR_ACCEPTED'],
   ['operatorReceiptSha256','a'.repeat(64)],['oldUrlAndCache','NOT_RUN'],
   ['managedHttps','NOT_RUN'],['rollback','NOT_RUN']]){
   const m={...f.m,publication:{...f.m.publication,[key]:val}};
   assert.throws(()=>f.check(m,f.release),undefined,key);
  }
  assert.throws(()=>f.check({...f.m,publicOn:true},f.release),/UNKNOWN|UNVERIFIED/);
 });
 test(platform+' cannot treat unapproved Item/variant hashes as signed inclusion',()=>{
  const f=releaseFixture(platform);
  const other={...f.m,items:{...f.m.items,[f.id]:{...f.m.items[f.id],webpSha256:'d'.repeat(64)}}};
  assert.throws(()=>f.check(other,f.release),/UNVERIFIED/);
  const duplicateForeign={...f.m,items:{...f.m.items,['99999999']:{...f.m.items[f.id]}}};
  assert.throws(()=>f.check(duplicateForeign,f.release),/UNVERIFIED|NOT_PINNED/);
  assert.equal(f.href('/web','99999999',f.check(f.m,f.release)),null);
 });
}
test('Cross-platform manifest confusion denied, compiler default OFF resists untrusted manifest and pre-existing footer unchanged',async()=>{
 const sw=releaseFixture('switch'),st=releaseFixture('steam');
 assert.throws(()=>st.check(sw.m,st.release));
 assert.throws(()=>sw.check(st.m,sw.release));
 const footer=readFileSync(new URL('../src/lib/SiteFooter.svelte',import.meta.url),'utf8');
 assert.match(footer,/data-image-rights-attribution/);
 assert.match(footer,/mailto:support@dreamwishwand\.com/);
 let network=0;const fetchImpl=async()=>{network++;throw Error('UNSAFE_REMOTE_FETCH')};
 const a=createSteam1253ManifestController(STEAM1253_REVIEWED_RELEASE,SWITCH1253_REVIEWED_RELEASE,()=>{});
 const b=createSwitch1253ManifestController(SWITCH1253_REVIEWED_RELEASE,()=>{});
 assert.equal(await a.load('/web',fetchImpl),null);
 assert.equal(await b.load('/web',fetchImpl),null);
 assert.equal(network,0);
});
