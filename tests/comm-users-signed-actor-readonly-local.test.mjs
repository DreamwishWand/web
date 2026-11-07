// 03 COMM / W-ENTITY-016 / R16: LOCAL SIGNED ACTOR DIAGNOSTIC ONLY.
// A fresh ephemeral ES256 test key signs synthetic JWT-shaped messages.
// This is NOT a Supabase GoTrue token, managed-stage JWT acceptance, DB/RLS,
// browser/public profile resolver, or new product auth implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { inspectPublicProfileHandleSegment } from '../src/lib/community/public-profile-handle-syntax.mjs';
import { readFileSync } from 'node:fs';

const MAIN_EDGE = readFileSync(new URL('../supabase/functions/community-command/index.ts', import.meta.url),'utf8');
const OLD_DOMAIN = readFileSync(new URL('../src/lib/community/domain.ts', import.meta.url),'utf8');

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const TEST_KID = 'local-test-ephemeral-es256-only';
const ISSUER = 'urn:wand:synthetic-local-actor-not-gotrue';
const AUDIENCE = 'wand-local-diagnostic';
const CLOCK = 1800000000;
const A_SUB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_SUB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A_ACCOUNT = '11111111-1111-4111-8111-111111111111';
const B_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const A_PROFILE = '33333333-3333-4333-8333-333333333333';
const B_PROFILE = '44444444-4444-4444-8444-444444444444';
const A_SESSION = '55555555-5555-4555-8555-555555555555';
const B_SESSION = '66666666-6666-4666-8666-666666666666';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

function syntheticToken(overrides={},header={}) {
  const payload = {
    iss: ISSUER, aud: AUDIENCE, sub: A_SUB, iat: CLOCK-100,
    nbf: CLOCK-100, exp: CLOCK+3600, session_id: A_SESSION,
    jti: 'local-synthetic-0001', ...overrides
  };
  const signingInput = b64({typ:'JWT',alg:'ES256',kid:TEST_KID,...header})+'.'+b64(payload);
  const signature = sign(null, Buffer.from(signingInput), {
    key: privateKey, dsaEncoding:'ieee-p1363'
  }).toString('base64url');
  return signingInput+'.'+signature;
}
function deny(reason) {
  return Object.freeze({status:'LOCAL_DENY_'+reason, allowedPublic:false,
    allowedRedirect:false, allowedAliasWrite:false, allowedPrivateLibrary:false,
    httpStatus:null, url:null, actorAccountId:null, creatorProfileId:null});
}

function verifyLocalSyntheticJwt(token,now) {
  if (typeof token!=='string') return null;
  const p=token.split('.');
  if (p.length!==3 || p.some(s=>!/^[A-Za-z0-9_-]+$/.test(s))) return null;
  try {
    // No alternate alg, kid, JWK/jku/x5u fallback or unsigned token.
    const head=JSON.parse(Buffer.from(p[0],'base64url').toString('utf8'));
    const claims=JSON.parse(Buffer.from(p[1],'base64url').toString('utf8'));
    if (head?.typ!=='JWT' || head.alg!=='ES256' || head.kid!==TEST_KID ||
        Object.keys(head).some(k=>!['typ','alg','kid'].includes(k))) return null;
    if (!verify(null,Buffer.from(p[0]+'.'+p[1]),
      {key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(p[2],'base64url'))) return null;
    if (claims?.iss!==ISSUER || claims.aud!==AUDIENCE || !UUID.test(claims.sub) ||
        !UUID.test(claims.session_id) ||
        !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
        !Number.isSafeInteger(claims.nbf) ||
        claims.iat>now || claims.nbf>now || claims.exp<=now ||
        claims.exp<=claims.iat || now-claims.iat>3600) return null;
    return claims;
  } catch { return null; }
}

function syntheticState() {
  return {
    accounts: [
      {subject:A_SUB, accountId:A_ACCOUNT, sessionId:A_SESSION, sessionValidAfter:CLOCK-1000,
       revoked:false, status:'active', identityState:'active'},
      {subject:B_SUB, accountId:B_ACCOUNT, sessionId:B_SESSION, sessionValidAfter:CLOCK-1000,
       revoked:false, status:'active', identityState:'active'}
    ],
    profiles: [
      {accountId:A_ACCOUNT, profileId:A_PROFILE, handle:'alice_07',
       historicAliases:['alice_old'], visibility:'public', consent:true,
       minor:false, moderation:'clear', deleted:false},
      {accountId:B_ACCOUNT, profileId:B_PROFILE, handle:'bob_07',
       historicAliases:['bob_old'], visibility:'public', consent:true,
       minor:false, moderation:'clear'}
    ]
  };
}
function syntheticReadOnlyActorBoundHandle(token,rawHandle,fixture=syntheticState(),now=CLOCK) {
  const claims=verifyLocalSyntheticJwt(token,now);
  if (!claims) return deny('UNVERIFIED_LOCAL_SIGNATURE_OR_TIME');
  const actorMatches=fixture.accounts.filter(a=>a.subject===claims.sub);
  if (actorMatches.length!==1) return deny('SUBJECT_AMBIGUOUS_OR_RETIRED');
  const actor=actorMatches[0];
  if (actor.status!=='active' || actor.identityState!=='active' || actor.revoked ||
      actor.sessionId!==claims.session_id || claims.iat<actor.sessionValidAfter) {
    return deny('SESSION_REVOKED_OR_INACTIVE');
  }
  const grammar=inspectPublicProfileHandleSegment(rawHandle);
  if (grammar.status!=='SYNTAX_ONLY_UNVERIFIED') return deny('HANDLE_SYNTAX');
  const handle=grammar.canonicalHandle;
  const matches=fixture.profiles.filter(p=>p.handle===handle || p.historicAliases.includes(handle));
  if (matches.length!==1) return deny('HANDLE_UNKNOWN_OR_COLLISION');
  const profile=matches[0];
  if (profile.accountId!==actor.accountId) return deny('OTHER_ACCOUNT_HANDLE');
  if (profile.deleted || profile.visibility!=='public' || !profile.consent ||
      profile.minor || profile.moderation!=='clear') return deny('PRIVACY_OR_TOMBSTONE');
  if (profile.handle!==handle) return deny('HISTORIC_ALIAS_REQUIRES_MANAGED_AUTH');
  // Local diagnostic only. A correctly signed synthetic actor NEVER becomes a
  // public read, actual DB authorization, redirect or mutation permission.
  return Object.freeze({
    status:'LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED',
    allowedPublic:false, allowedRedirect:false, allowedAliasWrite:false,
    allowedPrivateLibrary:false, httpStatus:null, url:null,
    actorAccountId:null, creatorProfileId:null
  });
}
function checkDenial(result) {
  assert.equal(result.allowedPublic,false);
  assert.equal(result.allowedRedirect,false);
  assert.equal(result.allowedAliasWrite,false);
  assert.equal(result.allowedPrivateLibrary,false);
  assert.equal(result.httpStatus,null);
  assert.equal(result.url,null);
  assert.equal(result.actorAccountId,null);
  assert.equal(result.creatorProfileId,null);
  assert.equal(Object.isFrozen(result),true);
}
const run = (rawHandle,fixture=syntheticState(),token=syntheticToken()) =>
  syntheticReadOnlyActorBoundHandle(token,rawHandle,fixture);

test('R16 accepted Edge trusts verified userClaims.id and issuedAt, not payload actor',()=>{
  assert.match(MAIN_EDGE,/withSupabase\(\{ auth: 'user' \}/);
  assert.match(MAIN_EDGE,/ctx\.userClaims\?\.id/);
  assert.match(MAIN_EDGE,/ctx\.jwtClaims\?\.iat/);
  assert.match(MAIN_EDGE,/community_authorize_session/);
  assert.doesNotMatch(MAIN_EDGE,/payload\.actorAccountId/);
  assert.match(OLD_DOMAIN,/normalize\('NFKC'\)/);
});
test('ephemeral real EC P-256 ES256 signature binds one synthetic subject, still no access grant',()=>{
  const result=run('ALICE_07');
  assert.equal(result.status,'LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED');
  checkDenial(result);
});
test('OTHER account signed actor cannot resolve owner A current or retired alias',()=>{
  const t=syntheticToken({sub:B_SUB,session_id:B_SESSION,jti:'local-b'});
  for(const name of ['alice_07','alice_old']) {
    const result=run(name,syntheticState(),t);
    assert.equal(result.status,'LOCAL_DENY_OTHER_ACCOUNT_HANDLE',name);
    checkDenial(result);
  }
});
test('A own historical alias holds; no redirect inferred from prior ownership',()=>{
  const result=run('alice_old');
  assert.equal(result.status,'LOCAL_DENY_HISTORIC_ALIAS_REQUIRES_MANAGED_AUTH');
  checkDenial(result);
});
test('expired, not-before future, old issuedAt, wrong issuer/audience/alg/kid all denied',()=>{
  const tokens=[
    syntheticToken({exp:CLOCK-1}),
    syntheticToken({nbf:CLOCK+1}),
    syntheticToken({iat:CLOCK-4000,nbf:CLOCK-4000}),
    syntheticToken({iss:'urn:forged'}),
    syntheticToken({aud:'other'}),
    syntheticToken({}, {alg:'none'}),
    syntheticToken({}, {alg:'HS256'}),
    syntheticToken({}, {kid:'untrusted'}),
    syntheticToken({}, {jku:'https://invalid.example/jwk'}),
  ];
  for(const t of tokens) {
    const result=run('alice_07',syntheticState(),t);
    assert.equal(result.status,'LOCAL_DENY_UNVERIFIED_LOCAL_SIGNATURE_OR_TIME');
    checkDenial(result);
  }
});
test('tampered signed claim, token truncation and unsigned JWT are denied',()=>{
  const token=syntheticToken();
  const [head,body,sig]=token.split('.');
  const tampered=Buffer.from(JSON.stringify({sub:B_SUB,iat:CLOCK-100,exp:CLOCK+3600,iss:ISSUER,aud:AUDIENCE,
    session_id:B_SESSION,nbf:CLOCK-100})).toString('base64url');
  for(const t of [head+'.'+tampered+'.'+sig, head+'.'+body+'.',token.slice(0,-4), 'a.b.c',null]) {
    const result=run('alice_07',syntheticState(),t);
    assert.equal(result.status,'LOCAL_DENY_UNVERIFIED_LOCAL_SIGNATURE_OR_TIME');
    checkDenial(result);
  }
});
test('logout, session rotation, revoked identity, inactive account and signed refresh IAT cutoffs fail closed',()=>{
  const cases=[
    x=>{x.accounts[0].revoked=true;},
    x=>{x.accounts[0].sessionId=B_SESSION;},
    x=>{x.accounts[0].sessionValidAfter=CLOCK-50;},
    x=>{x.accounts[0].identityState='retired';},
    x=>{x.accounts[0].status='deleted';},
    x=>{x.accounts[0].status='suspended';},
  ];
  for(const mutation of cases) {
    const fixture=syntheticState(); mutation(fixture);
    const result=run('alice_07',fixture);
    assert.equal(result.status,'LOCAL_DENY_SESSION_REVOKED_OR_INACTIVE');
    checkDenial(result);
  }
  // Re-signing a "refreshed" token is not proof of a live GoTrue session.
  const refreshed=syntheticToken({iat:CLOCK-40,nbf:CLOCK-40,jti:'local-refreshed'});
  const fixture=syntheticState(); fixture.accounts[0].revoked=true;
  assert.equal(run('alice_07',fixture,refreshed).status,'LOCAL_DENY_SESSION_REVOKED_OR_INACTIVE');
});
test('duplicate historic/current alias and duplicate subject identity fail closed, not take over',()=>{
  const fixture=syntheticState(); fixture.profiles[1].historicAliases.push('alice_07');
  assert.equal(run('alice_07',fixture).status,'LOCAL_DENY_HANDLE_UNKNOWN_OR_COLLISION');
  const s=syntheticState();s.accounts.push({...s.accounts[0]});
  assert.equal(run('alice_07',s).status,'LOCAL_DENY_SUBJECT_AMBIGUOUS_OR_RETIRED');
});
test('current and old alias withdrawal, minors, moderation, deletion never return content',()=>{
  const changes=[
    p=>{p.consent=false;},
    p=>{p.visibility='private';},
    p=>{p.visibility='unlisted';},
    p=>{p.minor=true;},
    p=>{p.moderation='removed';},
    p=>{p.deleted=true;}
  ];
  for(const mutation of changes) {
    const fixture=syntheticState();mutation(fixture.profiles[0]);
    const r=run('alice_07',fixture);
    assert.equal(r.status,'LOCAL_DENY_PRIVACY_OR_TOMBSTONE');
    checkDenial(r);
  }
});
test('encoded/Unicode/forged handle cannot bind otherwise valid synthetic actor',()=>{
  for(const handle of ['alice%2f07','alice/07','аlice_07','alice\u202e','library','__proto__']) {
    const r=run(handle);
    assert.equal(r.status,'LOCAL_DENY_HANDLE_SYNTAX');
    checkDenial(r);
  }
});
test('no refresh, old alias or fake payload approval provides public rights',()=>{
  const t=syntheticToken({actorAccountId:A_ACCOUNT,profileId:A_PROFILE,
    isModerator:true,mayRedirect:true,profileConsent:'public'});
  const r=run('alice_07',syntheticState(),t);
  assert.equal(r.status,'LOCAL_SIGNED_ACTOR_PROFILE_PAIR_SYNTHETIC_NOT_AUTHORIZED');
  checkDenial(r);
});
