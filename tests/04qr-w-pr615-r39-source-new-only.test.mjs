// 04 QR-W independent fixed HEAD 01D source-provenance QA (Source-only).
// No original icon bytes; never treats R39 mapping as current Native target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
 R39_IMAGE_SOURCE_CONTRACT, R39_SOURCE_SHA,R39_IMAGE_TARGETS,
 inspectR39ItemImageCandidate,R39_IMAGE_CURRENT_TARGET_READY
} from '../src/lib/ddv/core/items/r39-image-source-contract.mjs';

const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a',SRC='e6b77061350277c63705ea4eb3d6bff667b4f68c';
const own=[
 'docs/core/01d-r39-real-asset-source-20261105.md',
 'src/lib/ddv/core/items/r39-image-source-contract.mjs',
 'tests/01d-r39-item-media-source-contract.test.mjs'
].sort(),qa=['tests/04qr-w-pr615-r39-source-new-only.test.mjs','.github/workflows/04qr-w-pr615-r39-source-new-only.yml'].sort();
const hex='46a7a0017aa52efe957a953d6c3002d9b352059ff110d35184955eaba134bfec';
const row=()=>({
 sourceVersion:'1.24.13',identityStatus:'SOURCE_VERIFIED_R39_ONLY',
 currentVersionEquivalent:null,releasedPlayerFacingInTarget:null,
 sourceIconAddressGuid:'guid:01c3f7e50ed8c4a4ca3809dcc2687d93',
 sourcePngSha256:hex,sourceRawPayloadSha256:'f5d754f8af640493d738b3583912cde37e72c257867bfd09fb22364f159180b6',
 webpPath:'ddv/item-images/v1.24.13/08/'+hex+'.webp'
});
const proof=()=>({
 schema:R39_IMAGE_SOURCE_CONTRACT,status:'SOURCE_ONLY_R39_NO_CURRENT_VERSION_DEPLOY_PERMISSION',
 source:{platform:'Nintendo Switch',gameVersion:'1.24.13',generation:'R39',
  queryFoundationZipSha256:R39_SOURCE_SHA.queryFoundation,
  queryIndexGzipSha256:R39_SOURCE_SHA.queryIndex,
  portablePngManifestGzipSha256:R39_SOURCE_SHA.portableManifest,
  webpDerivativeManifestSha256:R39_SOURCE_SHA.derivativeManifest},
 target:{bindingAccepted:false,verifiedItems:0},
 additionalTarget:{bindingAccepted:false,verifiedItems:0},
 counts:{querySourceItems:16930,itemsWithSourceIcon:14601,uniqueWebpVerified:12082},
 items:{'10000002':row()}
});
const inspect=(p=proof(),id='10000002',target=R39_IMAGE_TARGETS[0])=>
 inspectR39ItemImageCandidate({provenance:p,itemId:id,target});
const denied=r=>{
 assert.equal(r.canPublishImage,false);
 assert.equal(r.targetVersionVerified,false);
 assert.equal(r.canShowPersonalOwned,false);
 assert.equal(r.releaseManifestEntry,null);
 assert.equal(r.assetHref,null);
};
test('PR615 exact 3 original Source paths, their Git blobs pinned, QA exactly 2',()=>{
 assert.equal(git('merge-base',MAIN,SRC),MAIN);
 assert.equal(git('merge-base',SRC,'HEAD'),SRC);
 assert.deepEqual(git('diff','--name-only',MAIN,SRC).split('\n').sort(),own);
 assert.deepEqual(git('diff','--name-only',SRC,'HEAD').split('\n').sort(),qa);
 for(const [p,sha] of Object.entries({
  'docs/core/01d-r39-real-asset-source-20261105.md':'f2c58039dea630722ca6a17513f2103060fe0745',
  'src/lib/ddv/core/items/r39-image-source-contract.mjs':'5ef04e0b9d8933974b234cd127a66586092fb6d4',
  'tests/01d-r39-item-media-source-contract.test.mjs':'b679ca263125ba117396bcd068225e825be78582'
 }))assert.equal(git('rev-parse',SRC+':'+p),sha,p);
 console.log('QR615_EXACT_SOURCE3_QA2_PINNED_PASS');
});
test('R39 external SHA/source-only valid no current 1.25.0 or 1.25.3 image release',()=>{
 assert.equal(R39_IMAGE_CURRENT_TARGET_READY,false);
 for(const target of R39_IMAGE_TARGETS){
  const r=inspect(proof(),'10000002',target);
  assert.equal(r.status,'R39_SOURCE_ONLY');
  assert.equal(r.reason,'TARGET_SAME_VERSION_ICON_GUID_AND_VISIBILITY_UNVERIFIED');
  denied(r);
 }
 console.log('QR615_HISTORIC_SOURCE_ONLY_CURRENT_TARGET_NO_RELEASE_PASS');
});
test('Forged target/current/rights/Owner flags cannot elevate; wrong BID, path, id fail closed',()=>{
 let p=proof();
 p.publication={gate:'OWNER_GO_FOR_DDV_GAME_IMAGES',rightsLicense:'APPROVED'};
 p.nativeVerified=true;p.items['10000002'].targetVersionVerified=true;
 denied(inspect(p));
 for(const mod of [
  x=>{x.target.verifiedItems=1;},
  x=>{x.items['10000002'].sourcePngSha256='f'.repeat(64);},
  x=>{x.items['10000002'].webpPath='https://out.example/x.webp';},
  x=>{x.items['10000002'].currentVersionEquivalent=true;},
  x=>{x.items['10000002'].releasedPlayerFacingInTarget=true;},
  x=>{x.source.webpDerivativeManifestSha256='b'.repeat(64);}
 ]){
  p=proof();mod(p);const r=inspect(p);assert.equal(r.status,'BLOCKED');denied(r);
 }
 for(const id of ['00010000002','999999999999999999','1e7','__proto__',0]){
  const r=inspect(proof(),id);assert.equal(r.status,'BLOCKED');denied(r);
 }
 for(const target of [{...R39_IMAGE_TARGETS[0],schema:626},{...R39_IMAGE_TARGETS[1],buildID:'52BD625D9B4E0053'}]){
  const r=inspect(proof(),'10000002',target);assert.equal(r.status,'BLOCKED');denied(r);
 }
 console.log('QR615_WRONG_VERSION_BID_FORGED_RIGHTS_ITEM_SHA_PATH_NEGATIVE_PASS');
});
test('Provenance ItemID MUST be own row: inherited synthetic spoof cannot claim R39_SOURCE_ONLY',()=>{
 const p=proof();
 const spoofed=Object.create({'10000002':row()});
 p.items=spoofed;
 const result=inspect(p);
 assert.equal(result.status,'BLOCKED',
  'no own ItemID row in attested source index: inherited JS property is not original GameDB membership');
 denied(result);
 console.log('QR615_INHERITED_ITEMID_NO_OWN_PROVENANCE_FAILCLOSED_PASS');
});
