// Contract/self-tests are offline only. They never create Auth sessions or Media.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  STAGING_URL, BACKEND_SHA, PNG_BYTES, sha256, validateLiveConfig,
  assertBinary, assertSignedUploadUrl, verifySubjectCatalog, runSignedGallery
} from '../scripts/community-gallery-signed-acceptance.mjs';

const actorId = {
  A:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  M:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
};
const approvedEnv = () => ({
  DREAMWISH_SUPABASE_URL:STAGING_URL,
  DREAMWISH_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_OFFLINE_FAKE_NO_REAL_KEY',
  DREAMWISH_GALLERY_E2E_APPROVAL:'APPROVED_DISPOSABLE_GALLERY_STAGING_ONLY',
  DREAMWISH_GALLERY_BACKEND_SHA:BACKEND_SHA,
  DREAMWISH_GALLERY_SUBJECT_ID:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  DREAMWISH_GALLERY_DB_MIGRATION:'20261025002200',
  DREAMWISH_GALLERY_EDGE_VERSIONS:'community-media:v16;community-public-media:v6;community-query:v14;community-command:v30',
  DREAMWISH_GALLERY_M_MODERATOR_APPROVED:'true',
  ...Object.fromEntries(['A','B','M'].flatMap((actor) => [
    ['DREAMWISH_GALLERY_' + actor + '_EMAIL','offline-' + actor + '@example.invalid'],
    ['DREAMWISH_GALLERY_' + actor + '_PASSWORD','offline-placeholder'],
    ['DREAMWISH_GALLERY_' + actor + '_ACCOUNT_ID',actorId[actor]]
  ]))
});
test('preflight without credentials is network-free, explicitly NOT real E2E', () => {
  const script=fileURLToPath(new URL('../scripts/community-gallery-signed-acceptance.mjs',import.meta.url));
  const output=spawnSync(process.execPath,[script,'--preflight'],{
    encoding:'utf8',env:{PATH:process.env.PATH}
  });
  assert.equal(output.status,0);
  const data=JSON.parse(output.stdout);
  assert.equal(data.networkRequests,0);
  assert.equal(data.liveAcceptance,'NOT_EXECUTED');
});
test('live rejects missing approval/credentials before any network call', async () => {
  let calls=0;
  await assert.rejects(runSignedGallery({},async () => { calls++; throw Error('NETWORK_NOT_EXPECTED'); }),
    /EXTERNAL_ENVIRONMENT/);
  assert.equal(calls,0);
  const missing={...approvedEnv(),DREAMWISH_GALLERY_M_MODERATOR_APPROVED:'false'};
  await assert.rejects(runSignedGallery(missing,async () => { calls++; throw Error('NETWORK_NOT_EXPECTED'); }),
    /MODERATOR_SCOPE_NOT_APPROVED/);
  assert.equal(calls,0);
});
test('prod target, unreviewed backend, missing role and actor collision fail closed',()=>{
  assert.throws(()=>validateLiveConfig({...approvedEnv(),DREAMWISH_SUPABASE_URL:'https://unapproved.supabase.co'}),/STAGING_TARGET/);
  assert.throws(()=>validateLiveConfig({...approvedEnv(),DREAMWISH_GALLERY_BACKEND_SHA:'0'.repeat(40)}),/BACKEND_SHA/);
  assert.throws(()=>validateLiveConfig({...approvedEnv(),DREAMWISH_GALLERY_B_ACCOUNT_ID:actorId.A}),/COLLISION/);
  assert.throws(()=>validateLiveConfig({...approvedEnv(),CI:'true',GITHUB_REF:'refs/heads/main'}),/INTEGRATION_BRANCH/);
  assert.doesNotThrow(()=>validateLiveConfig(approvedEnv()));
});
test('signed upload targets staging owner and private staging bucket ONLY',()=>{
  const s=STAGING_URL+'/storage/v1/object/upload/sign/community-media-staging/'+actorId.A+'/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png?token=FAKE';
  assert.equal(assertSignedUploadUrl(s,actorId.A),s);
  assert.throws(()=>assertSignedUploadUrl(s.replace('ptpdoxhrqopvczpclcij','attacker'),actorId.A),/EXTERNAL_ORIGIN/);
  assert.throws(()=>assertSignedUploadUrl(s.replace('community-media-staging','other-bucket'),actorId.A),/BUCKET_OR_PATH/);
  assert.throws(()=>assertSignedUploadUrl(s,actorId.B),/OWNER_PATH/);
});
test('real byte SHA-256 and length enforce same-object consistency',()=>{
  const expected={checksumSha256:sha256(PNG_BYTES),byteSize:PNG_BYTES.length};
  assertBinary(PNG_BYTES,expected);
  assert.throws(()=>assertBinary(Buffer.from(PNG_BYTES.map((v,i)=>i===30?v^1:v)),expected),/SHA256/);
  assert.throws(()=>assertBinary(PNG_BYTES,{...expected,byteSize:PNG_BYTES.length+1}),/SIZE/);
});
test('never ship privileged / destructive or credential-printing code paths', async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../scripts/community-gallery-signed-acceptance.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/service_role['"]|\.remove\(\[storageKey\]\)|physical_orphan_cleanup_accepted\s*=\s*true/);
  assert.match(source,/galleryPrepare/);
  assert.match(source,/galleryFinalize/);
  assert.match(source,/publishGalleryPhoto/);
  assert.match(source,/galleryReadBytes/);
  assert.match(source,/galleryRetirementPreflight/);
  assert.match(source,/galleryAbort/);
  assert.match(source,/SIGNED_GALLERY_E2E_FAILED/);
});


test('real deployed verified subjects contract enforces Switch 1.25.0/624 and verified state',()=>{
  const subject='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const row={subjectId:subject,galleryKind:'outdoor',verificationState:'verified',
    platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
  const catalog={contract:'ddv.gallery-verified-subject-public-lookup@1',subjects:[row]};
  assert.equal(verifySubjectCatalog(catalog,subject),subject);
  assert.throws(()=>verifySubjectCatalog({...catalog,subjects:[]},subject),/NOT_VERIFIED/);
  assert.throws(()=>verifySubjectCatalog({...catalog,subjects:[{...row,profileSchema:626}]},subject),/NOT_VERIFIED/);
  assert.throws(()=>verifySubjectCatalog({...catalog,subjects:[{...row,platform:'steam'}]},subject),/NOT_VERIFIED/);
  assert.throws(()=>verifySubjectCatalog({...catalog,contract:'wrong'},subject),/CATALOG_CONTRACT/);
});
test('moderator authorization uses invalid-filter no-row probe not case listing',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../scripts/community-gallery-signed-acceptance.mjs',import.meta.url),'utf8');
  assert.match(source,/qr_probe_invalid_state_no_rows/);
  assert.match(source,/ADMIN_OPERATION_FAILED/);
  assert.match(source,/NONMODERATOR_ROLE_PROOF_CONTRACT_MISMATCH/);
  assert.doesNotMatch(source,/payload:\{limit:0\}/);
});
