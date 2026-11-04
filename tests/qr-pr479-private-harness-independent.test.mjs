import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  requireOwnerPrivateScope, inspectExternallyAttestedSaveProfile,
  classify626ReferenceIndex, checkPrivateCandidateSource,
  ensurePrivateSourceOutsideCheckout, WEP_PRIVATE_624_BID, WEP_PRIVATE_626_BID
} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';

const env={WEP_PRIVATE_P1G_PATH:'/outside-checkout/synthetic-path-not-present',
  WEP_PRIVATE_BUILD_ID:WEP_PRIVATE_624_BID,
  WEP_PRIVATE_LOCAL_ONLY_ACK:'YES',WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED:'YES'};
const scope=patch=>requireOwnerPrivateScope({env:{...env,...patch}});

test('04QR runner/CI and unsafe localhost URLs are denied before any private read',()=>{
  for(const patch of [{CI:'true'},{CI:'false'},{GITHUB_ACTIONS:'true'}])
    assert.throws(()=>scope(patch),/PRIVATE_SAVE_CI_FORBIDDEN/);
  for(const url of [
    'https://localhost:4197/editor/world/',
    'http://127.0.0.1:4197/editor/world/?private=1',
    'http://127.0.0.1:4197/editor/world/#private',
    'http://user:pass@localhost:4197/editor/world/',
    'http://127.0.0.2:4197/editor/world/',
    'http://example.com/editor/world/',
    'http://localhost:4197/editor/world/../private/'
  ])assert.throws(()=>scope({WEP_PRIVATE_LOCAL_URL:url}),/PRIVATE_BROWSER_MUST_BE_LOCALHOST_ONLY/,url);
  assert.equal(scope({WEP_PRIVATE_P1G_PATH:''}).status,'NOT_RUN_PRIVATE_SOURCE_NOT_AVAILABLE');
  assert.equal(scope({WEP_PRIVATE_BUILD_ID:'UNKNOWN'}).status,'NOT_RUN_EXACT_BUILD_UNSUPPORTED');
  assert.equal(scope({WEP_PRIVATE_LOCAL_ONLY_ACK:'NO'}).status,'NOT_RUN_EXTERNAL_BUILD_CONSENT_REQUIRED');
  console.log('QR479_LOCAL_OWNER_ONLY_CI_AND_URL_DENIAL_PASS');
});

test('04QR external Switch BID and Save schema are bound; LastSaveDevice is no authority',()=>{
  const p={GameInfo:{Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
    Player:{},World:{GridCollection:{Grids:{}}}};
  const v=inspectExternallyAttestedSaveProfile(p,WEP_PRIVATE_624_BID);
  assert.equal(v.gameVersion,'1.25.0');
  assert.equal(v.lastSaveDeviceTypeIsAuthority,false);
  assert.throws(()=>inspectExternallyAttestedSaveProfile(p,WEP_PRIVATE_626_BID),/SCHEMA_BUILD_BOUNDARY_MISMATCH/);
  assert.throws(()=>inspectExternallyAttestedSaveProfile({...p,GameInfo:{Version:626}},WEP_PRIVATE_624_BID),/SCHEMA_BUILD_BOUNDARY_MISMATCH/);
  console.log('QR479_EXTERNAL_BUILD_AND_SCHEMA_NEGATIVE_PASS');
});

test('04QR schema626 DiffGrid Default unresolved is PARTIAL not Native V3 or Writer',()=>{
  const index={version:{schema:626},status:'REFERENCE_ERRORS_FAIL_CLOSED',
    issues:[{code:'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED',gridId:11}],
    grids:[],objects:[],geometryFor2d:'NOT_VERIFIED',
    persistentWriteAuthorized:false,productApplyAuthorized:false};
  assert.equal(classify626ReferenceIndex(index).checkStatus,'PARTIAL');
  for(const patch of [{persistentWriteAuthorized:true},{geometryFor2d:'NATIVE_ACCEPTED'},{productApplyAuthorized:true}])
    assert.throws(()=>classify626ReferenceIndex({...index,...patch}),/READONLY_REFERENCE_CONTRACT_INVALID/);
  console.log('QR479_626_DIFFONLY_AND_FORGED_WRITER_DENIAL_PASS');
});

test('04QR native GridObject original map-key and coordinate provenance rejects invented IDs',()=>{
  const p={World:{GridCollection:{Grids:{'42':{ID:42,Objects:{
    '7':{ID:7,ItemID:40000047,X:2,Y:3}
  }}}}}};
  assert.equal(checkPrivateCandidateSource(p,'g42:o7').objectId,7);
  for(const id of ['g42:o999','g42:o07','g042:o7','g42:o-1','g99:o7','g42:o9007199254740993'])
    assert.equal(checkPrivateCandidateSource(p,id),null,id);
  p.World.GridCollection.Grids['42'].Objects['7'].ID=8;
  assert.equal(checkPrivateCandidateSource(p,'g42:o7'),null);
  p.World.GridCollection.Grids['42'].Objects['7'].ID=7;
  p.World.GridCollection.Grids['42'].Objects['7'].X=0.5;
  assert.equal(checkPrivateCandidateSource(p,'g42:o7'),null);
  console.log('QR479_ORIGINAL_NATIVE_ID_AND_RAW_COORDINATE_DENIAL_PASS');
});

test('04QR path must resolve outside checkout, including symlink targets',()=>{
  assert.equal(ensurePrivateSourceOutsideCheckout('/owner/private/profile','/owner/wand-web'),true);
  assert.equal(ensurePrivateSourceOutsideCheckout('/owner/wand-web-copy/profile','/owner/wand-web'),true);
  for(const path of ['/owner/wand-web','/owner/wand-web/profile','/owner/wand-web/.artifacts/save'])
    assert.throws(()=>ensurePrivateSourceOutsideCheckout(path,'/owner/wand-web'),/PRIVATE_SOURCE_PATH_INSIDE_REPOSITORY_FORBIDDEN/);
  console.log('QR479_PRIVATE_SYMLINK_AND_REPO_EXCLUSION_PASS');
});

test('04QR static safety: no private executor in CI, no network exfiltration or source change',()=>{
  const script=readFileSync('scripts/wep-private-real-save-2d-local-only-20261104.mjs','utf8');
  const ui=readFileSync('src/routes/editor/world/+page.svelte','utf8');
  const before=(a,b)=>{
    const i=script.indexOf(a),j=script.indexOf(b);
    assert.ok(i>=0&&j>i,a+' must precede '+b);
  };
  before('if (process.env.CI||process.env.GITHUB_ACTIONS)','const data=await readFile(approvedSourcePath)');
  before('ensurePrivateSourceOutsideCheckout(approvedSourcePath,await realpath(process.cwd()))','const data=await readFile(approvedSourcePath)');
  assert.match(script,/serviceWorkers:'block'/);
  assert.match(script,/routeWebSocket\('\*\*\/\*'/);
  assert.match(script,/\['GET','HEAD'\]\.includes\(route\.request\(\)\.method\(\)\)/);
  assert.match(script,/acceptDownloads:false/);
  assert.match(script,/mode:0o600/);
  assert.match(script,/const delta=page\.locator\('\[data-wep-spatial-delta=/);
  assert.match(ui,/data-wep-spatial-delta=\{change\.editorId\}/);
  assert.match(ui,/class="toolbar-actions"/);
  assert.match(ui,/aria-disabled=\{!primaryJobAvailability\.commands\.move\.enabled\}/);
  assert.doesNotMatch(script,/page\.screenshot\(|uploadArtifact|supabase\.storage\.upload/);
  console.log('QR479_LOCAL_RECEIPT_NO_CI_EXECUTOR_NO_CLOUD_PASS');
});
