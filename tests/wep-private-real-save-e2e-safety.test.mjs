import test from 'node:test';
import assert from 'node:assert/strict';
import {
 requireOwnerPrivateScope, inspectExternallyAttestedSaveProfile,
 classify626ReferenceIndex, checkPrivateCandidateSource,
 ensurePrivateSourceOutsideCheckout,
 WEP_PRIVATE_624_BID, WEP_PRIVATE_626_BID
} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';

// This is PURE policy/synthetic data only. The owner-private executor MUST
// NEVER run under CI, nor may any real P1G/source SHA enter this test/fixture.
const env={
 WEP_PRIVATE_P1G_PATH:'/owner-private/outside-project/profile',
 WEP_PRIVATE_BUILD_ID:WEP_PRIVATE_624_BID,
 WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED:'YES',
 WEP_PRIVATE_LOCAL_ONLY_ACK:'YES'
};
const scope=(patch={})=>requireOwnerPrivateScope({env:{...env,...patch}});
const profile=(version, device='DeviceType_Windows')=>({
 GameInfo:{Version:version,LastSaveDeviceInfo:{deviceType:device}},
 Player:{},World:{GridCollection:{Grids:{
   '42':{ID:42,Objects:{'7':{ID:7,ItemID:40000047,X:3,Y:5}}}
 }}}
});

test('read-only local source accepts only explicit owner source + external BID, not device last-save field',()=>{
 const s=scope();
 assert.equal(s.status,'READY');
 assert.equal(s.bid,WEP_PRIVATE_624_BID);
 assert.equal(s.url.href,'http://127.0.0.1:4197/editor/world/');
 const bound=inspectExternallyAttestedSaveProfile(profile(624,'DeviceType_Windows'),WEP_PRIVATE_624_BID);
 assert.equal(bound.schema,624);
 assert.equal(bound.gameVersion,'1.25.0');
 assert.equal(bound.lastSaveDeviceTypeIsAuthority,false);
 const alt=inspectExternallyAttestedSaveProfile(profile(626,'DeviceType_Windows'),WEP_PRIVATE_626_BID);
 assert.equal(alt.gameVersion,'1.25.3');
});

test('CI or GitHub runner refuses even absent private P1G and even when owner ack claims YES',()=>{
 for(const patch of [{CI:'true'},{CI:'1',WEP_PRIVATE_P1G_PATH:''},{GITHUB_ACTIONS:'true'}]) {
  assert.throws(()=>scope(patch),/PRIVATE_SAVE_CI_FORBIDDEN/);
 }
});

test('no file/consent/unrecognized external BID remain NOT_RUN',()=>{
 assert.equal(scope({WEP_PRIVATE_P1G_PATH:''}).status,'NOT_RUN_PRIVATE_SOURCE_NOT_AVAILABLE');
 assert.equal(scope({WEP_PRIVATE_LOCAL_ONLY_ACK:'NO'}).status,'NOT_RUN_EXTERNAL_BUILD_CONSENT_REQUIRED');
 assert.equal(scope({WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED:''}).status,'NOT_RUN_EXTERNAL_BUILD_CONSENT_REQUIRED');
 assert.equal(scope({WEP_PRIVATE_BUILD_ID:'0'.repeat(16)}).status,'NOT_RUN_EXACT_BUILD_UNSUPPORTED');
});

test('the actual local browser may contact only localhost exact World route, no userinfo',()=>{
 for(const url of ['http://127.0.0.1:4197/editor/world/',
   'http://localhost:4197/editor/world/','http://[::1]:4197/editor/world/']){
  assert.equal(scope({WEP_PRIVATE_LOCAL_URL:url}).status,'READY');
 }
 for(const url of [
  'https://127.0.0.1:4197/editor/world/',
  'http://127.0.0.2:4197/editor/world/',
  'http://example.com/editor/world/',
  'file:///editor/world/',
  'http://127.0.0.1:4197/evil/editor/world/',
  'http://127.0.0.1:4197/editor/world/?payload=123',
  'http://user:pass@127.0.0.1:4197/editor/world/'
 ]){
  assert.throws(()=>scope({WEP_PRIVATE_LOCAL_URL:url}),/LOCALHOST_ONLY/,url);
 }
});

test('wrong schema/BID pairs never borrow another platform-version Native geometry',()=>{
 for(const [ver,bid] of [[624,WEP_PRIVATE_626_BID],[626,WEP_PRIVATE_624_BID],[627,WEP_PRIVATE_626_BID]]){
  assert.throws(()=>inspectExternallyAttestedSaveProfile(profile(ver),bid),/SCHEMA_BUILD_BOUNDARY/);
 }
 assert.throws(()=>inspectExternallyAttestedSaveProfile({GameInfo:{Version:624}},WEP_PRIVATE_624_BID),/REQUIRED_SECTIONS/);
});

test('626 reference-only clean index never promotes 2D Native semantics or Writer',()=>{
 const index={version:{schema:626},geometryFor2d:'NOT_VERIFIED',persistentWriteAuthorized:false,
   productApplyAuthorized:false,objects:[{gridId:42}],grids:[],issues:[],status:'READ_ONLY_REFERENCE_INDEX'};
 const r=classify626ReferenceIndex(index);
 assert.equal(r.status,'SOURCE_626_REFERENCE_INDEX_ONLY_2D_NOT_RUN');
 assert.equal(r.checkStatus,'PASS');
});

test('626 unresolved DefaultLayout/DiffGrid/parent must be PARTIAL, not V1 PASS',()=>{
 const index={version:{schema:626},geometryFor2d:'NOT_VERIFIED',persistentWriteAuthorized:false,
   productApplyAuthorized:false,objects:[],grids:[],
   issues:[{code:'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED'}],
   status:'REFERENCE_ERRORS_FAIL_CLOSED'};
 const r=classify626ReferenceIndex(index);
 assert.equal(r.checkStatus,'PARTIAL');
 assert.equal(r.issueCount,1);
 assert.match(r.status,/PARTIAL_/);
});

test('626 spoofed Writer authority or native geometry must fail before any receipt',()=>{
 for(const patch of [{persistentWriteAuthorized:true},{geometryFor2d:'VERIFIED'},{productApplyAuthorized:true}]) {
  const index={version:{schema:626},geometryFor2d:'NOT_VERIFIED',persistentWriteAuthorized:false,
    productApplyAuthorized:false,objects:[],grids:[],issues:[],status:'READ_ONLY_REFERENCE_INDEX',...patch};
  assert.throws(()=>classify626ReferenceIndex(index),/READONLY_REFERENCE_CONTRACT_INVALID/);
 }
});

test('Native Grid/Object keys are checked against the original source map, not UI claim',()=>{
 const p=profile(624);
 const v=checkPrivateCandidateSource(p,'g42:o7');
 assert.deepEqual(v,{editorId:'g42:o7',gridId:42,objectId:7,itemId:40000047,x:3,y:5});
 assert.equal(checkPrivateCandidateSource(p,'g42:o999'),null);
 assert.equal(checkPrivateCandidateSource(p,'g43:o7'),null);
 assert.equal(checkPrivateCandidateSource(p,'g042:o7'),null);
 assert.equal(checkPrivateCandidateSource(p,'g42:o07'),null);
 assert.equal(checkPrivateCandidateSource(p,'g42:oInfinity'),null);
});

test('raw map key/ID mismatch and unsafe XY are never a verified native candidate',()=>{
 const p=profile(624);
 p.World.GridCollection.Grids['42'].Objects['7'].ID=8;
 assert.equal(checkPrivateCandidateSource(p,'g42:o7'),null);
 p.World.GridCollection.Grids['42'].Objects['7'].ID=7;
 p.World.GridCollection.Grids['42'].Objects['7'].X=1.5;
 assert.equal(checkPrivateCandidateSource(p,'g42:o7'),null);
});

test('owner genuine source must be outside checkout, including resolved symlink targets',()=>{
 assert.equal(ensurePrivateSourceOutsideCheckout('/home/owner/private/profile','/home/owner/wand-web'),true);
 assert.equal(ensurePrivateSourceOutsideCheckout('/home/owner/wand-webs/private','/home/owner/wand-web'),true);
 for(const target of ['/home/owner/wand-web','/home/owner/wand-web/profile',
   '/home/owner/wand-web/.artifacts/copied-profile']){
  assert.throws(()=>ensurePrivateSourceOutsideCheckout(target,'/home/owner/wand-web'),/INSIDE_REPOSITORY_FORBIDDEN/);
 }
 assert.throws(()=>ensurePrivateSourceOutsideCheckout('relative/profile','/home/owner/wand-web'),/ABSOLUTE_PATH_REQUIRED/);
});
test('local genuine browser forbids HTTP POST/PUT/DELETE and offhost requests by explicit code guard',async()=>{
 // This is a source-level safety assertion, not a real P1G browser invocation.
 const {readFileSync}=await import('node:fs');
 const script=readFileSync(new URL('../scripts/wep-private-real-save-2d-local-only-20261104.mjs',import.meta.url),'utf8');
 assert.match(script,/\['GET','HEAD'\]\.includes\(route\.request\(\)\.method\(\)\)/);
 assert.match(script,/ensurePrivateSourceOutsideCheckout\(await realpath\(sourcePath\),await realpath\(process\.cwd\(\)\)\)/);
 assert.match(script,/serviceWorkers:'block'/);
 assert.match(script,/routeWebSocket\('\*\*\/\*'/);
 assert.match(script,/PRIVATE_SAVE_CI_FORBIDDEN/);
});
