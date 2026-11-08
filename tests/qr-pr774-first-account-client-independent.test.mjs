// 04 QR-S / PR774 independent NEW_ONLY security QA.
// Invokes the FROZEN Source test's actual CommunityLabClient and synthetic ES256
// fixture, but independently challenges it. NO GoTrue, SQL, managed HTTP or real DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sourceFile=join(root,'tests/comm-first-account-existing-client-local-signup.test.mjs');
const source=readFileSync(sourceFile,'utf8');
const SOURCE_HEAD='7d28ac27dfb29a9da92ec01c6b03859db3bcebfb';
const BASE_MAIN='b7d86d47125f1764919b67898c39badaf35976d8';
const BLOB='89ab15832856c486708f792db6922b2672498373';
const CLIENT_BLOB='4d988aee5a94f8184c1ec2e8fe831be3013436b3';
const HISTORIC82_BLOB='bbf9bc830440d964c5da8b3c3cac7e926d281881';
const require=createRequire(import.meta.url);
const typeScriptUrl=pathToFileURL(require.resolve('typescript')).href;
const clientUrl=pathToFileURL(join(root,'src/lib/community/staging-http-client.ts')).href;
const syntaxUrl=pathToFileURL(join(root,'src/lib/community/public-profile-handle-syntax.mjs')).href;

function git(...args){return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();}
function mark(s){console.log('QR774_'+s+'_PASS');}
const anchor=source.indexOf("\ntest('Q01");
assert.ok(anchor>6000,'frozen owner source marker missing');
// Export ONLY from a read-only in-memory copy, not from a new product Auth layer.
// Load the real existing TypeScript CommunityLabClient exactly as Source does.
let loadable=source.slice(0,anchor)
  .replace("from 'typescript'", "from '"+typeScriptUrl+"'")
  .replace("from '../src/lib/community/public-profile-handle-syntax.mjs'",
           "from '"+syntaxUrl+"'")
  .replace("new URL('../src/lib/community/staging-http-client.ts', import.meta.url)",
           "new URL('"+clientUrl+"')");
loadable+='\nexport {installFixture,makeFixture,signedAccess,verifySyntheticAccess,'+
  'A_ID,B_ID,A_ACCOUNT,B_ACCOUNT,A_PROFILE,B_PROFILE,ORIGIN,KEY,PASSWORD,ISSUER,'+
  'CommunityLabClient,CommunityHttpError};';
const fx=await import('data:text/javascript;base64,'+Buffer.from(loadable).toString('base64'));
const {installFixture,makeFixture,signedAccess,verifySyntheticAccess,
  A_ID,B_ID,A_ACCOUNT,B_ACCOUNT,A_PROFILE,B_PROFILE,ORIGIN,KEY,PASSWORD,ISSUER,
  CommunityLabClient,CommunityHttpError}=fx;
const queryUrl=ORIGIN+'/functions/v1/community-query';
const cmdUrl=ORIGIN+'/functions/v1/community-command';
const payload=(query,params={})=>JSON.stringify({query,command:query,payload:params});
const req=(url,token,body)=>({method:'POST',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(body)});
const isCode=(code)=>(err)=>err instanceof CommunityHttpError && err.status===code;

test('fixed Source one-file only and immutable client/Auth/legacy historical migration',()=>{
  assert.equal(git('rev-parse',SOURCE_HEAD),SOURCE_HEAD);
  assert.deepEqual(git('diff','--name-only',BASE_MAIN,SOURCE_HEAD).split('\n'),
    ['tests/comm-first-account-existing-client-local-signup.test.mjs']);
  assert.equal(git('hash-object','tests/comm-first-account-existing-client-local-signup.test.mjs'),BLOB);
  assert.equal(git('hash-object','src/lib/community/staging-http-client.ts'),CLIENT_BLOB);
  assert.equal(git('hash-object','supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),
    HISTORIC82_BLOB);
  assert.equal(git('diff','--name-only',BASE_MAIN,SOURCE_HEAD,'src','supabase','scripts','docs'),'');
  assert.match(source,/synthetic-go-true-fixture-not-real/);
  assert.doesNotMatch(source,/\b(?:console\.log|console\.debug|console\.info)\s*\(/);
  mark('PIN_SOURCE_ONE_CLIENT_ORIGINAL82_AND_NO_CREDENTIAL_LOGS');
});

test('actual signup does not create a preconfirmed session or write; unknown and duplicate stay gated',async t=>{
  const {fixture,client,store}=installFixture(t);
  const a=client();
  const email='fresh-first@example.invalid';
  assert.equal(fixture.users.has(email),false);
  const result=await a.signUpWithPassword(email,PASSWORD);
  assert.equal(result.requiresEmailConfirmation,true);
  assert.equal(result.userId,A_ID);
  assert.equal(fixture.users.get(email)?.confirmed,false);
  assert.equal(a.session,null);
  assert.equal(store.size,0);
  assert.equal(fixture.writes,0);
  await assert.rejects(a.command('ensureAccountCreator',{actorAccountId:A_ACCOUNT}),
    /Sign in before calling Community APIs/);
  await assert.rejects(a.signInWithPassword(email,PASSWORD),isCode(400));
  // Repeat signup: user already exists, but no session token is created.
  const repeated=await a.signUpWithPassword(email,PASSWORD);
  assert.equal(repeated.requiresEmailConfirmation,true);
  assert.equal(a.session,null);
  assert.equal(fixture.users.get(email)?.confirmed,false);
  assert.equal(fixture.events.filter(x=>x.path.startsWith('/functions/')).length,0);
  assert.equal(fixture.writes,0);
  mark('REAL_CLIENT_UNCONFIRMED_REPEAT_SIGNUP_ZERO_SESSION_ZERO_WRITES');
});

test('confirmed first actor maps to server fixture IDs, B signed actor never inherits A',async t=>{
  const {fixture,client}=installFixture(t);
  const a=client();const b=client();
  await a.signUpWithPassword('first-owner@example.invalid',PASSWORD);
  assert.equal(a.session,null);
  fixture.confirm('first-owner@example.invalid');
  const aa=await a.signInWithPassword('first-owner@example.invalid',PASSWORD);
  assert.equal(aa.userId,A_ID);
  assert.equal(a.session?.userId,A_ID);
  assert.equal((await a.query('getMe',{accountId:B_ACCOUNT,creatorProfileId:B_PROFILE}))
    .data.accountId,A_ACCOUNT);
  assert.equal((await a.command('ensureAccountCreator',
    {actorAccountId:B_ACCOUNT,creatorProfileId:B_PROFILE})).data.creatorProfileId,A_PROFILE);
  await b.signInWithPassword('other@example.invalid',PASSWORD);
  assert.equal((await b.query('getMe',{accountId:A_ACCOUNT})).data.accountId,B_ACCOUNT);
  assert.equal((await b.command('ensureAccountCreator',{actorAccountId:A_ACCOUNT}))
    .data.creatorProfileId,B_PROFILE);
  for(const [actor,alias] of [[a,'firstowner'],[a,'alice_old'],[b,'alice_07'],[b,'alice_old']])
    await assert.rejects(actor.query('publicProfileByHandle',{handle:alias}),isCode(404));
  // Fixture-only command writes are NOT database proof.
  assert.equal(fixture.writes,2);
  mark('REAL_CLIENT_CONFIRMED_OWNER_OTHER_ACCOUNT_FORGED_ID_AND_ALIAS_DENIED');
});

test('locally signed forged subject, separate P256 signer, expired and replay tokens never mutate fixture',async()=>{
  const fixture=makeFixture();
  fixture.users.set('first@example.invalid',{id:A_ID,accountId:A_ACCOUNT,profileId:A_PROFILE,
    email:'first@example.invalid',confirmed:true,revoked:false,password:PASSWORD});
  const token=fixture.makeSession(fixture.users.get('first@example.invalid')).access_token;
  const base=fixture.writes;
  const [h,p,s]=token.split('.');
  const c=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const tampered=h+'.'+encode({...c,sub:B_ID})+'.'+s;
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const untrusted=h+'.'+p+'.'+sign(null,Buffer.from(h+'.'+p),
    {key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const expired=signedAccess(A_ID,c.session_id,-100);
  const unknownSession=signedAccess(A_ID,'synthetic-session-nonexistent');
  for(const jwt of [tampered,untrusted,expired,unknownSession,'','a.b.c']){
    if(jwt===unknownSession)assert.ok(verifySyntheticAccess(jwt), 'valid synthetic signature but unknown session must still deny');
    else assert.equal(verifySyntheticAccess(jwt),null,'tampered/expired/mismatched signature must be invalid');
    const response=await fixture.handle(cmdUrl,req(cmdUrl,jwt,
      {command:'ensureAccountCreator',payload:{actorAccountId:B_ACCOUNT}}));
    assert.equal(response.status,401);
    assert.equal(fixture.writes,base);
  }
  mark('REAL_EPHEMERAL_ES256_TAMPER_UNTRUSTED_KEY_EXPIRED_REPLAY_ZERO_WRITE');
});

test('logout and revoked refresh cannot restore A Session or write on previously valid token',async t=>{
  const {fixture,client,store}=installFixture(t);
  const a=client();const email='first-revoked@example.invalid';
  await a.signUpWithPassword(email,PASSWORD);fixture.confirm(email);
  const s=await a.signInWithPassword(email,PASSWORD);
  const oldJwt=s.accessToken;
  assert.ok(oldJwt?.length>40);
  fixture.revoke(email);
  const pre=fixture.writes;
  await assert.rejects(a.command('ensureAccountCreator',{}),isCode(401));
  assert.equal(fixture.writes,pre);
  assert.ok(fixture.refreshCount>=1);
  assert.equal((await fixture.handle(cmdUrl,req(cmdUrl,oldJwt,
    {command:'ensureAccountCreator'}))).status,401);
  assert.equal(fixture.writes,pre);
  // A distinct clean actor must remain unaffected by the revoked A session.
  const other=client();const verified=await other.signInWithPassword('other@example.invalid',PASSWORD);
  assert.equal(verified.userId,B_ID);
  assert.equal((await other.query('getMe')).data.accountId,B_ACCOUNT);
  await other.signOut();
  assert.equal(other.session,null);
  const count=fixture.writes;
  assert.equal((await fixture.handle(queryUrl,req(queryUrl,verified.accessToken,
    {query:'getMe'}))).status,401);
  assert.equal(fixture.writes,count);
  // Do not assert one client's logout clears another client's storage: browser
  // fixture shares global sessionStorage; this synthetic test is NOT real multi-device.
  mark('REVOKED_REFRESH_DIRECT_BEARER_AND_LOGOUT_NO_POSTREVOKE_WRITES');
});

test('weak credentials and arbitrary origin blocked before fixture network; never print token or password',async t=>{
  const {fixture,client}=installFixture(t);
  const a=client();
  for(const pw of ['', 'short','a'.repeat(14)]){
    await assert.rejects(a.signUpWithPassword('weak@example.invalid',pw),/at least 15 characters/);
  }
  await assert.rejects(a.signUpWithPassword('',PASSWORD),/Email is required/);
  assert.equal(fixture.events.length,0);
  assert.equal(fixture.writes,0);
  assert.throws(()=>new CommunityLabClient({
    supabaseUrl:'http://bad.external.invalid',publishableKey:KEY}),/https/);
  await assert.rejects(fixture.handle('https://external.invalid/auth/v1/signup',
    {method:'POST',body:JSON.stringify({email:'p@example.invalid',password:PASSWORD})}),
    /LOCAL_FIXTURE_NO_EXTERNAL_FETCH/);
  assert.equal(fixture.events.length,0);
  for(const item of fixture.events){
    assert.deepEqual(Object.keys(item).sort(),['grant','method','path']);
    assert.ok(!JSON.stringify(item).includes(PASSWORD));
  }
  assert.ok(!source.includes('https://supabase.co'));
  assert.ok(!source.includes('https://api.supabase.com'));
  mark('PASSWORD_MIN_15_HTTPS_ONLY_ORIGIN_DENIED_NO_SECRET_EVENT_LOG');
});
