// 03 COMM / W-ENTITY-016 / R16: REAL existing TS client against an in-memory,
// controlled, synthetic signed Auth response fixture. NO actual GoTrue/2PG/RLS/SQL.
// All keys/identifiers below are generated or fixed synthetic test-only values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import ts from 'typescript';
import { inspectPublicProfileHandleSegment } from '../src/lib/community/public-profile-handle-syntax.mjs';

const clientSource = readFileSync(
  new URL('../src/lib/community/staging-http-client.ts', import.meta.url), 'utf8'
);
const compiled = ts.transpileModule(clientSource, {
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  reportDiagnostics:true
});
assert.equal(compiled.diagnostics?.length, 0, 'existing accepted client must transpile');
const {CommunityLabClient, CommunityHttpError} = await import(
  'data:text/javascript;base64,'+Buffer.from(compiled.outputText).toString('base64')
);
const ORIGIN='https://local-go-true-synthetic.invalid';
const KEY='sb_publishable_synthetic_local_only';
const PASSWORD='SyntheticLongPassword-2026!';
const A_ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A_ACCOUNT='11111111-1111-4111-8111-111111111111';
const B_ACCOUNT='22222222-2222-4222-8222-222222222222';
const A_PROFILE='33333333-3333-4333-8333-333333333333';
const B_PROFILE='44444444-4444-4444-8444-444444444444';
const ISSUER='urn:wand:synthetic-go-true-fixture-not-real';
const keyPair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const json=(body,status=200)=>new Response(JSON.stringify(body),
  {status,headers:{'content-type':'application/json'}});
const authErr=(message,status=401)=>json({error:'AUTH_DENIED',message},status);
const now=()=>Math.floor(Date.now()/1000);

function signedAccess(subject,sessionId,ttl=300) {
  const claims={iss:ISSUER,aud:'synthetic',sub:subject,iat:now()-1,
    nbf:now()-1,exp:now()+ttl,session_id:sessionId};
  const head=encode({alg:'ES256',typ:'JWT',kid:'ephemeral-test-only'});
  const body=encode(claims);
  const input=head+'.'+body;
  return input+'.'+sign(null,Buffer.from(input),
    {key:keyPair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
function verifySyntheticAccess(token) {
  if(typeof token!=='string')return null;
  const parts=token.split('.');
  if(parts.length!==3)return null;
  try{
    const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(header.alg!=='ES256'||header.kid!=='ephemeral-test-only'||
       payload.iss!==ISSUER||payload.aud!=='synthetic'||
       payload.iat>now()||payload.exp<=now())return null;
    const valid=verify(null,Buffer.from(parts[0]+'.'+parts[1]),
      {key:keyPair.publicKey,dsaEncoding:'ieee-p1363'},
      Buffer.from(parts[2],'base64url'));
    return valid?payload:null;
  }catch{return null;}
}
function makeFixture() {
  const users=new Map([
    ['owner@example.invalid',{id:A_ID,accountId:A_ACCOUNT,profileId:A_PROFILE,
       email:'owner@example.invalid',confirmed:false,revoked:false,password:PASSWORD}],
    ['other@example.invalid',{id:B_ID,accountId:B_ACCOUNT,profileId:B_PROFILE,
       email:'other@example.invalid',confirmed:true,revoked:false,password:PASSWORD}]
  ]);
  const refreshes=new Map();
  const sessions=new Map();
  const events=[];
  let generation=0;
  let actionWrites=0;
  let refreshCount=0;
  const makeSession=(u,ttl=300)=>{
    const id='synthetic-session-'+(++generation);
    const refresh='synthetic-opaque-refresh-'+generation;
    const access_token=signedAccess(u.id,id,ttl);
    sessions.set(id,{user:u,active:true});
    refreshes.set(refresh,id);
    return {access_token,refresh_token:refresh,expires_in:ttl,
      user:{id:u.id,email:u.email}};
  };
  const readBearer=options=>{
    const token=String(options?.headers?.authorization??'').replace(/^Bearer /,'');
    const claims=verifySyntheticAccess(token);
    const session=claims&&sessions.get(claims.session_id);
    if(!session?.active||!session.user.confirmed||session.user.revoked||
       session.user.id!==claims.sub)return null;
    return {claims,session};
  };
  const handle=async(input,options={})=>{
    const url=new URL(String(input));
    if(url.origin!==ORIGIN)throw new Error('LOCAL_FIXTURE_NO_EXTERNAL_FETCH');
    const body=options.body?JSON.parse(String(options.body)):{};
    const method=options.method??'GET';
    events.push({path:url.pathname,method,grant:url.searchParams.get('grant_type')});
    if(url.pathname==='/auth/v1/signup'){
      if(method!=='POST')return authErr('Method denied',405);
      const email=String(body.email??'').toLowerCase();
      if(users.has(email))return json({user:{id:users.get(email).id}},200);
      const u={id:A_ID,accountId:A_ACCOUNT,profileId:A_PROFILE,email,
        confirmed:false,revoked:false,password:body.password};
      users.set(email,u);
      return json({user:{id:u.id}},200); // no access_token: email confirmation required
    }
    if(url.pathname==='/auth/v1/token'){
      if(method!=='POST')return authErr('Method denied',405);
      const grant=url.searchParams.get('grant_type');
      if(grant==='password'){
        const u=users.get(body.email);
        if(!u||!u.confirmed||u.revoked||body.password!==u.password)
          return authErr('Confirmation or sign-in denied',400);
        return json(makeSession(u));
      }
      if(grant==='refresh_token'){
        refreshCount++;
        const id=refreshes.get(body.refresh_token);
        const active=id&&sessions.get(id);
        if(!active?.active||active.user.revoked||!active.user.confirmed)
          return authErr('Refresh session revoked');
        refreshes.delete(body.refresh_token);
        active.active=false;
        return json(makeSession(active.user,300));
      }
      return authErr('Unsupported grant');
    }
    if(url.pathname==='/auth/v1/logout'){
      const actor=readBearer(options);
      if(!actor)return authErr('Old JWT revoked');
      actor.session.active=false;
      for(const [token,id] of refreshes.entries()){
        if(id===actor.claims.session_id)refreshes.delete(token);
      }
      return json({});
    }
    if(url.pathname==='/functions/v1/community-command'||
       url.pathname==='/functions/v1/community-query'){
      const actor=readBearer(options);
      if(!actor)return authErr('Signed session missing/revoked');
      const u=actor.session.user;
      if(body.command==='ensureAccountCreator'){
        actionWrites++; // synthetic fixture only: no DB, no real write or auth proof.
        return json({ok:true,data:{accountId:u.accountId,creatorProfileId:u.profileId}});
      }
      if(body.query==='getMe'){
        return json({ok:true,data:{accountId:u.accountId,creatorProfileId:u.profileId}});
      }
      if(body.query==='publicProfileByHandle'){
        // No server-authorized aliases/consent/RLS/managed proofs in this fixture.
        const grammar=inspectPublicProfileHandleSegment(body.payload?.handle);
        if(grammar.status!=='SYNTAX_ONLY_UNVERIFIED')return authErr('Bad handle',404);
        return authErr('No authorized public profile projection',404);
      }
      return authErr('Unknown operation',404);
    }
    throw new Error('LOCAL_FIXTURE_UNEXPECTED_ROUTE_'+url.pathname);
  };
  return {users,sessions,events,handle,makeSession,
    confirm:email=>{users.get(email).confirmed=true;},
    revoke:email=>{users.get(email).revoked=true;},
    get writes(){return actionWrites;},
    get refreshCount(){return refreshCount;}
  };
}
function installFixture(t){
  const originalFetch=globalThis.fetch;
  const originalStorage=globalThis.sessionStorage;
  const store=new Map();
  globalThis.sessionStorage={
    getItem:k=>store.get(k)??null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };
  const fixture=makeFixture();
  globalThis.fetch=fixture.handle;
  t.after(()=>{globalThis.fetch=originalFetch;
    if(originalStorage===undefined)delete globalThis.sessionStorage;
    else globalThis.sessionStorage=originalStorage;});
  return {fixture,client:()=>new CommunityLabClient({supabaseUrl:ORIGIN,publishableKey:KEY}),store};
}

test('Q01 actual accepted client sends registration without login; email confirmation gate denies early account',async t=>{
  const {fixture,client}=installFixture(t);
  const a=client();
  const signup=await a.signUpWithPassword('new@example.invalid',PASSWORD);
  assert.equal(signup.requiresEmailConfirmation,true);
  assert.equal(signup.userId,A_ID);
  assert.equal(a.session,null);
  await assert.rejects(a.query('getMe'),/Sign in before calling Community APIs/);
  await assert.rejects(a.signInWithPassword('new@example.invalid',PASSWORD),
    err=>err instanceof CommunityHttpError&&err.status===400);
  assert.equal(a.session,null);
  assert.equal(fixture.writes,0);
  assert.equal(fixture.events.filter(x=>x.path.includes('community-')).length,0);
});

test('Q02 confirmed owner current session receives only own fixture record, not public /users authorization',async t=>{
  const {fixture,client}=installFixture(t);
  fixture.confirm('owner@example.invalid');
  const a=client();
  const s=await a.signInWithPassword('owner@example.invalid',PASSWORD);
  assert.equal(s.userId,A_ID);
  assert.equal(s.email,'owner@example.invalid');
  const created=await a.command('ensureAccountCreator',{actorAccountId:B_ACCOUNT});
  assert.equal(created.data.accountId,A_ACCOUNT);
  assert.equal(created.data.creatorProfileId,A_PROFILE);
  const me=await a.query('getMe',{accountId:B_ACCOUNT});
  assert.equal(me.data.accountId,A_ACCOUNT);
  const candidate=inspectPublicProfileHandleSegment('ALICE_07');
  assert.equal(candidate.status,'SYNTAX_ONLY_UNVERIFIED');
  assert.equal(candidate.mayReadPublicProfile,false);
  await assert.rejects(a.query('publicProfileByHandle',{handle:'alice_07'}),
    err=>err instanceof CommunityHttpError&&err.status===404);
  assert.equal(fixture.writes,1); // synthetic fixture only
});

test('Q03 B verified signed session cannot force A ownership via client-supplied actor or alias',async t=>{
  const {fixture,client}=installFixture(t);
  const b=client();
  const s=await b.signInWithPassword('other@example.invalid',PASSWORD);
  assert.equal(s.userId,B_ID);
  const me=await b.query('getMe',{accountId:A_ACCOUNT});
  assert.equal(me.data.accountId,B_ACCOUNT);
  const own=await b.command('ensureAccountCreator',{actorAccountId:A_ACCOUNT});
  assert.equal(own.data.accountId,B_ACCOUNT);
  for(const handle of ['alice_07','alice_old','ALICE_07']){
    await assert.rejects(b.query('publicProfileByHandle',{handle}),
      err=>err instanceof CommunityHttpError&&err.status===404);
  }
  assert.equal(fixture.writes,1);
});

test('Q04 logout locally clears client and synthetic fixture revokes access and refresh',async t=>{
  const {fixture,client,store}=installFixture(t);
  fixture.confirm('owner@example.invalid');
  const a=client();
  const signed=await a.signInWithPassword('owner@example.invalid',PASSWORD);
  const token=signed.accessToken;
  await a.signOut();
  assert.equal(a.session,null);
  assert.equal(store.size,0);
  const before=fixture.events.length;
  await assert.rejects(a.query('getMe'),/Sign in before calling Community APIs/);
  assert.equal(fixture.events.length,before);
  const response=await fixture.handle(ORIGIN+'/functions/v1/community-query',{
    method:'POST',headers:{authorization:'Bearer '+token},
    body:JSON.stringify({query:'getMe',payload:{}})
  });
  assert.equal(response.status,401);
});

test('Q05 revoked/refreshed identity never yields profile data or fixture write',async t=>{
  const {fixture,client}=installFixture(t);
  fixture.confirm('owner@example.invalid');
  const a=client();
  await a.signInWithPassword('owner@example.invalid',PASSWORD);
  const before=fixture.writes;
  fixture.revoke('owner@example.invalid');
  await assert.rejects(a.query('getMe'),err=>
    err instanceof CommunityHttpError&&err.status===401);
  assert.ok(fixture.refreshCount>=1,'client tried refresh after denied 401');
  assert.equal(fixture.writes,before);
  await assert.rejects(a.command('ensureAccountCreator',{}),err=>
    err instanceof CommunityHttpError&&err.status===401);
  assert.equal(fixture.writes,before);
});

test('Q06 malformed or incomplete credentials and unapproved URLs fail before any Auth request',async t=>{
  const {fixture,client}=installFixture(t);
  const a=client();
  for(const p of ['', 'too-short']){
    await assert.rejects(a.signUpWithPassword('bad@example.invalid',p),
      /at least 15 characters/);
  }
  await assert.rejects(a.signUpWithPassword('',PASSWORD),/Email is required/);
  assert.equal(fixture.events.length,0);
  assert.throws(()=>new CommunityLabClient({
    supabaseUrl:'http://insecure.invalid',publishableKey:KEY}),/https/);
  assert.equal(fixture.writes,0);
});

test('Q07 expired and altered signatures do not prove ownership even if client carries prior token',async t=>{
  const {fixture}=installFixture(t);
  fixture.confirm('owner@example.invalid');
  const fake=fixture.makeSession(fixture.users.get('owner@example.invalid'));
  const [header,payload,sig]=fake.access_token.split('.');
  const claims=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  claims.sub=B_ID; // attacker changed only claim, not signature
  const forged=header+'.'+encode(claims)+'.'+sig;
  for(const bearer of [forged,'a.b.c','',signedAccess(A_ID,'unknown',-1)]){
    const res=await fixture.handle(ORIGIN+'/functions/v1/community-query',{
      method:'POST',headers:{authorization:'Bearer '+bearer},
      body:JSON.stringify({query:'getMe',payload:{}})
    });
    assert.equal(res.status,401);
  }
  assert.equal(fixture.writes,0);
});
