// 04 QR-W independent new-HEAD ONLY QA for 01D PR615 own-ItemID repair.
// Source-only synthetic rows. Private P1G and game art MUST NOT enter shared CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 R39_IMAGE_SOURCE_CONTRACT,R39_SOURCE_SHA,R39_IMAGE_TARGETS,
 inspectR39ItemImageCandidate,R39_IMAGE_CURRENT_TARGET_READY
} from '../src/lib/ddv/core/items/r39-image-source-contract.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const OLD='e6b77061350277c63705ea4eb3d6bff667b4f68c';
const FIX='c7d64020c8eab7b87aaa4b626fb01a7cb2a059a4';
const SOURCE=[
 'docs/core/01d-r39-real-asset-source-20261105.md',
 'src/lib/ddv/core/items/r39-image-source-contract.mjs',
 'tests/01d-r39-item-media-source-contract.test.mjs'
].sort();
const DIFF=[
 'src/lib/ddv/core/items/r39-image-source-contract.mjs',
 'tests/01d-r39-item-media-source-contract.test.mjs'
].sort();
const QA=[
 'tests/04qr-w-pr615-c7-own-row-delta.test.mjs',
 '.github/workflows/04qr-w-pr615-c7-own-row-delta.yml'
].sort();
test('original Source3, only modified Source2, QA2 and accepted cumulative WEP ancestor pinned',()=>{
 assert.equal(git('merge-base',MAIN,OLD),MAIN);
 assert.equal(git('merge-base',OLD,FIX),OLD);
 assert.equal(git('merge-base',FIX,'HEAD'),FIX);
 assert.deepEqual(git('diff','--name-only',MAIN,FIX).split('\n').sort(),SOURCE);
 assert.deepEqual(git('diff','--name-only',OLD,FIX).split('\n').sort(),DIFF);
 const cur=git('diff','--name-only',FIX,'HEAD').split('\n').sort();
 const wep='scripts/wep-decorate-stage1-browser-acceptance.mjs';
 if(cur.includes(wep))assert.equal(git('rev-parse','HEAD:'+wep),
  '405e5d236038efa0004e5be870c334db09fd896d','only accepted protected-main WEP one blob allowed');
 assert.deepEqual(cur.filter(p=>p!==wep),QA);
 for(const [path,sha] of Object.entries({
  'docs/core/01d-r39-real-asset-source-20261105.md':'f2c58039dea630722ca6a17513f2103060fe0745',
  'src/lib/ddv/core/items/r39-image-source-contract.mjs':'6ba8e08899e90ec674ecd4f9902bb214a51076c5',
  'tests/01d-r39-item-media-source-contract.test.mjs':'afdd044909d2eb6da076850ff73335f1a66ee555'
 }))assert.equal(git('rev-parse',FIX+':'+path),sha);
 console.log('QR615_FIX_C7_ORIGINAL3_DELTA2_QA2_PINNED_PASS');
});
const png='46a7a0017aa52efe957a953d6c3002d9b352059ff110d35184955eaba134bfec';
const row=()=>({
 sourceVersion:'1.24.13',identityStatus:'SOURCE_VERIFIED_R39_ONLY',
 currentVersionEquivalent:null,releasedPlayerFacingInTarget:null,
 sourceIconAddressGuid:'guid:01c3f7e50ed8c4a4ca3809dcc2687d93',
 sourcePngSha256:png,sourceRawPayloadSha256:'f5d754f8af640493d738b3583912cde37e72c257867bfd09fb22364f159180b6',
 webpPath:'ddv/item-images/v1.24.13/08/'+png
});
const attested=()=>({
 schema:R39_IMAGE_SOURCE_CONTRACT,status:'SOURCE_ONLY_R39_NO_CURRENT_VERSION_DEPLOY_PERMISSION',
 source:{
  platform:'Nintendo Switch',gameVersion:'1.24.13',generation:'R39',
  queryFoundationZipSha256:R39_SOURCE_SHA.queryFoundation,
  queryIndexGzipSha256:R39_SOURCE_SHA.queryIndex,
  portablePngManifestGzipSha256:R39_SOURCE_SHA.portableManifest,
  webpDerivativeManifestSha256:R39_SOURCE_SHA.derivativeManifest
 },
 target:{bindingAccepted:false,verifiedItems:0},additionalTarget:{bindingAccepted:false,verifiedItems:0},
 counts:{querySourceItems:16930,itemsWithSourceIcon:14601,uniqueWebpVerified:12082},
 items:{'10000002':row()}
});
const check=(p=attested(),id='10000002',target=R39_IMAGE_TARGETS[0])=>
 inspectR39ItemImageCandidate({provenance:p,itemId:id,target});
const alwaysOff=r=>{
 assert.equal(r.canPublishImage,false);
 assert.equal(r.canShowPersonalOwned,false);
 assert.equal(r.targetVersionVerified,false);
 assert.equal(r.releaseManifestEntry,null);
 assert.equal(r.assetHref,null);
};
test('old RED: inherited ItemID prototype row is NOT the actual original GameDB own mapping',()=>{
 const original=attested();
 original.items=Object.create({'10000002':row()});
 for(const target of R39_IMAGE_TARGETS){
  const result=check(original,'10000002',target);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'R39_SOURCE_ITEM_ICON_NOT_PRESENT');
  alwaysOff(result);
 }
 console.log('QR615_FIX_INHERITED_ITEMID_PROTO_SOURCE_REJECTED_PASS');
});
test('inherited items container rejected; own row remains historical SOURCE_ONLY, never current',()=>{
 const inherited=attested();
 delete inherited.items;
 Object.setPrototypeOf(inherited,{items:{'10000002':row()}});
 assert.equal(check(inherited).reason,'R39_SOURCE_ITEM_ICON_NOT_PRESENT');
 // The genuine manifest is JSON-equivalent with OWN keys, not a synthetic
 // object carrying a mutated prototype (which the Source may deny safely).
 const own=attested();
 assert.equal(Object.hasOwn(own.items,'10000002'),true);
 assert.equal(R39_IMAGE_CURRENT_TARGET_READY,false);
 for(const target of R39_IMAGE_TARGETS){
  const r=check(own,'10000002',target);
  assert.equal(r.status,'R39_SOURCE_ONLY','unexpected block reason='+r.reason);
  assert.equal(r.source.sourcePngSha256,png);
  alwaysOff(r);
 }
 console.log('QR615_FIX_OWN_ROW_HISTORICAL_SOURCE_ONLY_TARGET_UNVERIFIED_PASS');
});
test('no forged current version, user-owned, release / wrong BID / unknown IDs or external url',()=>{
 for(const target of [
  {...R39_IMAGE_TARGETS[0],schema:626},
  {...R39_IMAGE_TARGETS[1],buildID:'52BD625D9B4E0053'},
  {...R39_IMAGE_TARGETS[1],platform:'Steam'}
 ]){
  const r=check(attested(),'10000002',target);assert.equal(r.status,'BLOCKED');alwaysOff(r);
 }
 for(const id of ['__proto__','constructor','00010000002','999999999999999999']){
  const r=check(attested(),id);assert.equal(r.status,'BLOCKED');alwaysOff(r);
 }
 const spoof=attested();spoof.publication={gate:'OWNER_GO_FOR_DDV_GAME_IMAGES',rightsLicense:'APPROVED'};
 spoof.items['10000002'].targetVersionVerified=true;
 alwaysOff(check(spoof));
 const pathSpoof=attested();pathSpoof.items['10000002'].webpPath='https://foreign.example/asset.webp';
 assert.equal(check(pathSpoof).status,'BLOCKED');
 console.log('QR615_FIX_CURRENT_TARGET_RIGHTS_OWNED_PATH_STILL_FAILCLOSED_PASS');
});
