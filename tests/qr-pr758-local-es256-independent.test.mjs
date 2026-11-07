// 04 QR-S new-only independent adversarial QA for Source PR758.
// The source under test is a test-only local synthetic ES256 harness, NOT product Auth.
// Build an in-memory read-only export from the frozen source test module without writing
// to it, then challenge actual source verifier/fixture with separately authored cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const sourcePath = join(root, 'tests/comm-users-signed-actor-readonly-local.test.mjs');
const edgePath = join(root, 'supabase/functions/community-command/index.ts');
const domainPath = join(root, 'src/lib/community/domain.ts');
const srcHead = '1eb2ad96b46bf9ad10a722455307636769b4da6a';
const baseMain = '069b47d4fc32fe947ca652328de8cbba72421504';
const sourceBlob = '20074b19832ef8e142c44107691601f60996301d';
const previousGrammar = '48009ce9b52ad568b9759b1d9158e4b1f4ccffb1';
const original82 = 'bbf9bc830440d964c5da8b3c3cac7e926d281881';
const sourceText = readFileSync(sourcePath, 'utf8');

function git(...args) {
  return execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
}
function mark(s) {console.log('QR758_' + s + '_PASS');}
function denied(result) {
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.allowedPublic, false);
  assert.equal(result.allowedRedirect, false);
  assert.equal(result.allowedAliasWrite, false);
  assert.equal(result.allowedPrivateLibrary, false);
  assert.equal(result.httpStatus, null);
  assert.equal(result.url, null);
  assert.equal(result.actorAccountId, null);
  assert.equal(result.creatorProfileId, null);
  assert.ok(/^LOCAL_DENY_|^LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED$/.test(result.status));
}
const checkpoint = sourceText.indexOf("\ntest('R16 accepted Edge");
assert.ok(checkpoint > 5000, 'Owner test-only source export anchor missing');
// Only append exports in memory; never modify the original test fixture or product source.
let loadableSource = sourceText.slice(0, checkpoint);
const handleUrl = pathToFileURL(join(root,'src/lib/community/public-profile-handle-syntax.mjs')).href;
const edgeUrl = pathToFileURL(edgePath).href;
const domainUrl = pathToFileURL(domainPath).href;
loadableSource = loadableSource.replace(
  "from '../src/lib/community/public-profile-handle-syntax.mjs'",
  "from '" + handleUrl + "'"
).replace(
  "new URL('../supabase/functions/community-command/index.ts', import.meta.url)",
  "new URL('" + edgeUrl + "')"
).replace(
  "new URL('../src/lib/community/domain.ts', import.meta.url)",
  "new URL('" + domainUrl + "')"
);
loadableSource += '\nexport { syntheticToken, syntheticState, syntheticReadOnlyActorBoundHandle, verifyLocalSyntheticJwt, deny, checkDenial, A_SUB, B_SUB, A_ACCOUNT, B_ACCOUNT, A_PROFILE, B_PROFILE, A_SESSION, B_SESSION, CLOCK, ISSUER, AUDIENCE, TEST_KID, privateKey, publicKey };';
const fixture = await import('data:text/javascript;base64,' + Buffer.from(loadableSource).toString('base64'));

const {
  syntheticToken, syntheticState, syntheticReadOnlyActorBoundHandle: run,
  verifyLocalSyntheticJwt: verifyJwt, A_SUB, B_SUB, A_ACCOUNT, B_ACCOUNT, A_PROFILE,
  B_PROFILE, A_SESSION, B_SESSION, CLOCK, ISSUER, AUDIENCE, TEST_KID
} = fixture;

test('pin exact original one-file source and unchanged production edge, legacy and grammar',()=>{
  assert.equal(git('rev-parse',srcHead),srcHead);
  assert.deepEqual(git('diff','--name-only',baseMain,srcHead).split('\n'),[
    'tests/comm-users-signed-actor-readonly-local.test.mjs'
  ]);
  assert.equal(git('hash-object','tests/comm-users-signed-actor-readonly-local.test.mjs'),sourceBlob);
  assert.equal(git('hash-object','src/lib/community/public-profile-handle-syntax.mjs'),previousGrammar);
  assert.equal(git('hash-object','supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),original82);
  assert.equal(git('diff','--name-only',baseMain,srcHead,'src','supabase','docs'),'');
  assert.match(sourceText,/urn:wand:synthetic-local-actor-not-gotrue/);
  assert.match(sourceText,/LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED/);
  assert.equal(Object.keys(fixture).includes('syntheticReadOnlyActorBoundHandle'),true);
  mark('ONE_TEST_ONLY_SHA_AND_PRODUCTION_UNTOUCHED');
});

test('real fresh local ES256 valid and forged claimant remain diagnostic, never authority',()=>{
  const state=syntheticState();
  for(const [token,handle,status] of [
    [syntheticToken(),'Alice_07','LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED'],
    [syntheticToken({actorAccountId:B_ACCOUNT,creatorProfileId:B_PROFILE,ownerApproved:true,isAdmin:true}),'alice_07',
      'LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED'],
    [syntheticToken({sub:B_SUB,session_id:B_SESSION}),'bob_07',
      'LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED'],
    [syntheticToken({sub:B_SUB,session_id:B_SESSION}),'alice_07','LOCAL_DENY_OTHER_ACCOUNT_HANDLE'],
    [syntheticToken(),'bob_07','LOCAL_DENY_OTHER_ACCOUNT_HANDLE'],
    [syntheticToken(),'alice_old','LOCAL_DENY_HISTORIC_ALIAS_REQUIRES_MANAGED_AUTH']
  ]) {
    const snapshot=JSON.stringify(state);
    const r=run(token,handle,state);
    denied(r);
    assert.equal(r.status,status,handle);
    assert.equal(JSON.stringify(state),snapshot,'fixture must remain read only');
  }
  assert.ok(verifyJwt(syntheticToken(),CLOCK));
  mark('SIGNED_A_B_OTHER_ACCOUNT_HISTORIC_ALIAS_NO_POSITIVE_GRANT');
});

test('independent token transformations: alg/key substitution and malformed JWT fail closed',()=>{
  const original=syntheticToken();
  const [h,p,s]=original.split('.');
  const bad=[
    undefined,null,{},new String(original),'',original+'.extra',h+'.'+p+'.',
    h+'.'+p+'.bad',h+'.'+p+'..',h+'.'+p.slice(1)+'.'+s,
    'eyJhbGciOiJub25lIn0.'+p+'.','null.null.null'
  ];
  // A separately issued private key must NOT verify as the source's ephemeral key.
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const sig=sign(null,Buffer.from(h+'.'+p),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  bad.push(h+'.'+p+'.'+sig);
  for(const token of bad){
    const r=run(token,'alice_07');
    denied(r);
    assert.equal(r.status,'LOCAL_DENY_UNVERIFIED_LOCAL_SIGNATURE_OR_TIME');
    assert.equal(verifyJwt(token,CLOCK),null);
  }
  for(const wrong of [
    syntheticToken({iss:'urn:wand:external'}),
    syntheticToken({aud:['wand-local-diagnostic']}),
    syntheticToken({nbf:CLOCK+3}),
    syntheticToken({exp:CLOCK}),
    syntheticToken({iat:CLOCK+2}),
    syntheticToken({}, {jku:'file:///tmp/forged'}),
    syntheticToken({}, {kid:'managed-stage-kid'}),
    syntheticToken({}, {alg:'HS256'})
  ])assert.equal(run(wrong,'alice_07').status,'LOCAL_DENY_UNVERIFIED_LOCAL_SIGNATURE_OR_TIME');
  mark('UNTRUSTED_EC_KEY_MALFORMED_JWT_TIME_ALG_KID_AUD_DENIED');
});

test('session rotation, revoked refresh, stale cutoffs and signed claim impersonation deny',()=>{
  const own=syntheticToken();
  const revived=syntheticToken({iat:CLOCK-30,nbf:CLOCK-30,jti:'synthetic-refresh-not-gotrue'});
  for(const modifier of [
    s=>{s.accounts[0].revoked=true;},
    s=>{s.accounts[0].identityState='retired';},
    s=>{s.accounts[0].status='deleted';},
    s=>{s.accounts[0].sessionValidAfter=CLOCK-10;},
    s=>{s.accounts[0].sessionId=B_SESSION;}
  ]){
    const st=syntheticState();modifier(st);
    for(const jwt of [own,revived]){
      const r=run(jwt,'alice_07',st);
      denied(r);
      assert.equal(r.status,'LOCAL_DENY_SESSION_REVOKED_OR_INACTIVE');
    }
  }
  // A valid signature claiming B Account under A's verified sub cannot grant B's data.
  for(const field of [{accountId:B_ACCOUNT},{creatorProfileId:B_PROFILE},{actorAccountId:B_ACCOUNT}]){
    const r=run(syntheticToken({...field,mayReadPrivateLibrary:true,mayWriteHandle:true}),'bob_07');
    assert.equal(r.status,'LOCAL_DENY_OTHER_ACCOUNT_HANDLE');
    denied(r);
  }
  mark('SESSION_CUTOFF_REFRESH_CLAIM_FORGERY_NO_DB_AUTH');
});

test('duplicate historical aliases and deleted/minor/private/consent account fail closed',()=>{
  const t=syntheticToken();
  for(const change of [
    s=>{s.profiles.push({...s.profiles[0]});},
    s=>{s.profiles[1].historicAliases=['alice_07'];},
    s=>{s.accounts.push({...s.accounts[0]});}
  ]) {
    const st=syntheticState();change(st);
    const r=run(t,'alice_07',st);
    denied(r);
    assert.match(r.status,/COLLISION|AMBIGUOUS/);
  }
  for(const change of [
    s=>{s.profiles[0].visibility='unlisted';},
    s=>{s.profiles[0].visibility='private';},
    s=>{s.profiles[0].consent=false;},
    s=>{s.profiles[0].minor=true;},
    s=>{s.profiles[0].moderation='removed';},
    s=>{s.profiles[0].deleted=true;}
  ]){
    const st=syntheticState();change(st);
    const r=run(t,'alice_07',st);
    denied(r);
    assert.equal(r.status,'LOCAL_DENY_PRIVACY_OR_TOMBSTONE');
  }
  mark('DUPLICATE_ALIAS_TOMBSTONE_MINORS_CONSENT_FAIL_CLOSED');
});

test('Unicode, encoded/prototype handle and no leaked UUID or positive HTTP status',()=>{
  for(const name of ['alice%2f07','%61lice_07','alice%252f07',
    'аlice_07','ａｌｉｃｅ_０７','alice\u202e07','library','__proto__','abc/def',null,{}]){
    const r=run(syntheticToken(),name);
    denied(r);
    assert.equal(r.status,'LOCAL_DENY_HANDLE_SYNTAX');
  }
  for(const key of [A_SUB,B_SUB,A_ACCOUNT,B_ACCOUNT,A_PROFILE,ISSUER,AUDIENCE,TEST_KID])
    assert.ok(!JSON.stringify(run(syntheticToken(),'alice_07')).includes(key),
      'synthetic identifiers/issuer not returned');
  assert.doesNotMatch(sourceText,/\b(?:fetch|XMLHttpRequest|WebSocket|createClient|supabase\.rpc)\s*\(/);
  assert.equal(git('diff','--name-only',baseMain,srcHead,'supabase/functions'),'');
  mark('RAW_HANDLE_ENCODING_PRIVATE_ID_LEAK_NO_RUNTIME_AUTH');
});
