import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R39_IMAGE_SOURCE_CONTRACT, R39_IMAGE_SOURCE_COUNTS, R39_SOURCE_SHA,
  R39_IMAGE_TARGETS, R39_IMAGE_CURRENT_TARGET_READY, inspectR39ItemImageCandidate
} from '../src/lib/ddv/core/items/r39-image-source-contract.mjs';

const sourceSha='46a7a0017aa52efe957a953d6c3002d9b352059ff110d35184955eaba134bfec';
const webPath='ddv/item-images/v1.24.13/08/'+sourceSha+'.webp';
const candidate=Object.freeze({
  sourceVersion:'1.24.13',
  identityStatus:'SOURCE_VERIFIED_R39_ONLY',
  currentVersionEquivalent:null,
  releasedPlayerFacingInTarget:null,
  sourceIconAddressGuid:'guid:01c3f7e50ed8c4a4ca3809dcc2687d93',
  sourcePngSha256:sourceSha,
  sourceRawPayloadSha256:'f5d754f8af640493d738b3583912cde37e72c257867bfd09fb22364f159180b6',
  webpPath:webPath
});
const proof=()=>({
  schema:R39_IMAGE_SOURCE_CONTRACT,
  status:'SOURCE_ONLY_R39_NO_CURRENT_VERSION_DEPLOY_PERMISSION',
  source:{
    platform:'Nintendo Switch',gameVersion:'1.24.13',generation:'R39',
    queryFoundationZipSha256:R39_SOURCE_SHA.queryFoundation,
    queryIndexGzipSha256:R39_SOURCE_SHA.queryIndex,
    portablePngManifestGzipSha256:R39_SOURCE_SHA.portableManifest,
    webpDerivativeManifestSha256:R39_SOURCE_SHA.derivativeManifest
  },
  target:{bindingAccepted:false,verifiedItems:0},
  additionalTarget:{bindingAccepted:false,verifiedItems:0},
  counts:{
    querySourceItems:16930,itemsWithSourceIcon:14601,uniqueWebpVerified:12082
  },
  items:{'10000002':{...candidate}}
});
const inspect=(input=proof(),itemId=10000002,target=R39_IMAGE_TARGETS[0])=>
  inspectR39ItemImageCandidate({provenance:input,itemId,target});
const neverEnabled=r=>{
  assert.equal(r.canPublishImage,false);
  assert.equal(r.targetVersionVerified,false);
  assert.equal(r.canShowPersonalOwned,false);
  assert.equal(r.releaseManifestEntry,null);
  assert.equal(r.assetHref,null);
};

test('R39 original identity maps ItemID, GUID and content SHA but can NEVER grant a current-version image',()=>{
  assert.equal(R39_IMAGE_CURRENT_TARGET_READY,false);
  assert.equal(R39_IMAGE_SOURCE_COUNTS.uniqueWebp,12082);
  const result=inspect();
  assert.equal(result.status,'R39_SOURCE_ONLY');
  assert.equal(result.source.guid,candidate.sourceIconAddressGuid);
  assert.equal(result.source.webpSourcePath,webPath);
  assert.equal(result.target.buildID,'52BD625D9B4E0053');
  neverEnabled(result);
});

test('Schema626 Switch target remains source-only, not an automatic cross-version projection',()=>{
  const result=inspect(proof(),10000002,R39_IMAGE_TARGETS[1]);
  assert.equal(result.status,'R39_SOURCE_ONLY');
  assert.equal(result.target.schema,626);
  assert.equal(result.reason,'TARGET_SAME_VERSION_ICON_GUID_AND_VISIBILITY_UNVERIFIED');
  neverEnabled(result);
});

test('Wrong BID/version/schema/platform and noncanonical ItemID reject',()=>{
  for(const target of [
    {...R39_IMAGE_TARGETS[0],buildID:'9A239D3DB569756D'},
    {...R39_IMAGE_TARGETS[1],schema:624},
    {...R39_IMAGE_TARGETS[0],gameVersion:'1.24.13'},
    {...R39_IMAGE_TARGETS[0],platform:'Steam'}
  ]) {const r=inspect(proof(),10000002,target);assert.equal(r.status,'BLOCKED');neverEnabled(r);}
  for(const itemId of [0,-1,'010000002','1e8','__proto__',2**60]) {
    const r=inspect(proof(),itemId);assert.equal(r.status,'BLOCKED');neverEnabled(r);
  }
});

test('Unknown old item and damaged source manifest refuse image selection',()=>{
  assert.equal(inspect(proof(),99999999).reason,'R39_SOURCE_ITEM_ICON_NOT_PRESENT');
  for(const f of [
    x=>{x.source.queryIndexGzipSha256='0'.repeat(64);},
    x=>{x.source.gameVersion='1.25.0';},
    x=>{x.counts.uniqueWebpVerified=12081;},
    x=>{x.target.bindingAccepted=true;},
    x=>{x.additionalTarget.verifiedItems=1;},
    x=>{x.status='VERSION_VERIFIED';}
  ]) {const x=proof();f(x);const r=inspect(x);assert.equal(r.status,'BLOCKED');neverEnabled(r);}
});

test('Inherited ItemID map entries cannot impersonate original R39 source data',()=>{
  const x=proof();
  const original=x.items['10000002'];
  x.items=Object.create({'10000002':original});
  let result=inspect(x);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'R39_SOURCE_ITEM_ICON_NOT_PRESENT');
  neverEnabled(result);
  delete x.items;
  const inherited=Object.create({items:{'10000002':original}});
  Object.assign(inherited,x);
  result=inspect(inherited);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'R39_SOURCE_ITEM_ICON_NOT_PRESENT');
  neverEnabled(result);
  const allowed=proof();
  allowed.items=Object.create({toString:original});
  allowed.items['10000002']={...original};
  assert.equal(inspect(allowed).status,'R39_SOURCE_ONLY');
  neverEnabled(inspect(allowed));
});

test('Source row conflicts, forged positive target or unsafe WebP paths fail closed',()=>{
  for(const patch of [
    {sourceVersion:'1.25.0'},
    {identityStatus:'VERSION_VERIFIED'},
    {currentVersionEquivalent:true},
    {releasedPlayerFacingInTarget:true},
    {sourceIconAddressGuid:'guid:bad'},
    {sourcePngSha256:'../escape'},
    {sourceRawPayloadSha256:'0'},
    {webpPath:'https://external.example/icon.webp'},
    {webpPath:'ddv/item-images/v1.25.3/08/'+sourceSha+'.webp'}
  ]) {
    const x=proof();Object.assign(x.items['10000002'],patch);
    const r=inspect(x);assert.equal(r.status,'BLOCKED');neverEnabled(r);
  }
});

test('Claimed owner GO / licence / nativeVerified flags cannot promote old source data',()=>{
  const x=proof();
  x.publication={gate:'OWNER_GO_FOR_DDV_GAME_IMAGES',rightsLicense:'APPROVED'};
  x.nativeVerified=true;
  x.items['10000002'].targetVersionVerified=true;
  const r=inspect(x);
  assert.equal(r.status,'R39_SOURCE_ONLY');
  neverEnabled(r);
});
