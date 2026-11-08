import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {firstAccountCopy,FIRST_ACCOUNT_COPY} from '../src/lib/account-ui/copy.mjs';
import {
 FIRST_ACCOUNT_UI_OPERATION,FIRST_ACCOUNT_PUBLIC_ENABLED,PUBLIC_PROFILE_RUNTIME_ACCEPTED,
 PRIVATE_LIBRARY_RUNTIME_ACCEPTED,OWNER_DISPOSABLE_STAGING_AUTH_ORIGIN,
 resolveFirstAccountTestGate,registerDisposableFirstAccount,
 signInDisposableFirstAccount,verifyDisposableFirstAccount,signOutDisposableFirstAccount
} from '../src/lib/account-ui/test-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const account=read('src/routes/account/+page.svelte');
const libraryRoute='src/routes/library/+page.svelte';
const key='sb_publishable_12345678';
const gate=(args={})=>resolveFirstAccountTestGate({flag:'OWNER_DISPOSABLE_STAGING_TEST',
 hostname:'localhost',supabaseUrl:OWNER_DISPOSABLE_STAGING_AUTH_ORIGIN,publishableKey:key,...args});

test('first Account/Library production off and staging test gate is exactly scoped',()=>{
 assert.equal(FIRST_ACCOUNT_UI_OPERATION,'WEB_SOURCE_ONLY_FAILCLOSED_SIGNUP_PROFILE_PRIVATE_LIBRARY_UI');
 assert.equal(FIRST_ACCOUNT_PUBLIC_ENABLED,false);
 assert.equal(PUBLIC_PROFILE_RUNTIME_ACCEPTED,false);
 assert.equal(PRIVATE_LIBRARY_RUNTIME_ACCEPTED,false);
 assert.equal(resolveFirstAccountTestGate().allowed,false);
 for(const overrides of [{flag:''},{hostname:'dreamwishwand.com'},{hostname:'evil.example'},
  {supabaseUrl:'https://other.supabase.co'},
  {supabaseUrl:'http://ptpdoxhrqopvczpclcij.supabase.co'},{publishableKey:'secret'},
  {publishableKey:'sb_publishable_x'}]){
  assert.equal(gate(overrides).allowed,false,JSON.stringify(overrides));
 }
 assert.equal(gate().allowed,true);
 assert.equal(gate({hostname:'dreamwishwand.github.io'}).allowed,true,'separate explicit Owner test build only');
 for(const marker of ['VITE_WAND_DISPOSABLE_ACCOUNT_TEST','resolveFirstAccountTestGate(',
  'VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY',
  'new CommunityLabClient','registerDisposableFirstAccount','signInDisposableFirstAccount',
  'signOutDisposableFirstAccount','verifyDisposableFirstAccount']){
  assert.ok(account.includes(marker),marker);
 }
 assert.doesNotMatch(account,/createClient\s*=|new SupabaseClient|service_role|localStorage\./);
});

function fakeClient({confirmation=true,identity='user_owner',expired=false,missing=false,failQuery=false}={}){
 let current=null; const history=[];
 return {
  history,
  get session(){return current;},
  async signUpWithPassword(email,password){history.push('signup');assert.ok(email.includes('@'));assert.ok(password.length>=15);return {requiresEmailConfirmation:confirmation,userId:'user_owner'};},
  async signInWithPassword(){history.push('signin');current={userId:'user_owner',email:'owner@example.invalid',accessToken:'never-render-this',refreshToken:'secret',expiresAt:Date.now()+(expired?-500:3600000)};return current;},
  async query(name){history.push(name);if(failQuery)throw Error('401 revoked');return {ok:true,data:missing?{}:{accountId:identity}};},
  async signOut(){history.push('logout');current=null;}
 };
}

test('disposable signup requires email confirmation and no fake sign-in state',async()=>{
 const ok=fakeClient();
 assert.deepEqual(await registerDisposableFirstAccount(ok,'owner@example.invalid','abcdefghijklmnop'),{status:'WAIT_EMAIL_CONFIRMATION'});
 assert.equal(ok.session,null);
 const unsafe=fakeClient({confirmation:false});
 await assert.rejects(registerDisposableFirstAccount(unsafe,'owner@example.invalid','abcdefghijklmnop'),/EMAIL_CONFIRMATION_POLICY_NOT_MET/);
 assert.ok(unsafe.history.includes('logout'));
});

test('only fresh currently signed owner principal may show disposable identity, never private authorization',async()=>{
 const client=fakeClient();
 const identity=await signInDisposableFirstAccount(client,'owner@example.invalid','abcdefghijklmnop');
 assert.deepEqual(identity,{
  status:'DISPOSABLE_STAGING_IDENTITY_VERIFIED',userId:'user_owner',
  email:'owner@example.invalid',privateLibraryAuthorized:false,publicProfilePublished:false
 });
 assert.equal(identity.accessToken,undefined);
 assert.equal((await verifyDisposableFirstAccount(client)).userId,'user_owner');
 assert.equal((await signOutDisposableFirstAccount(client)).status,'SIGNED_OUT_LOCAL_NO_PRIVATE_DATA');
 assert.equal(client.session,null);
});

test('other Account, stale session, missing profile and revoked token cannot show private data',async()=>{
 for(const config of [{identity:'other_user'},{expired:true},{missing:true},{failQuery:true}]){
  const client=fakeClient(config);
  await assert.rejects(signInDisposableFirstAccount(client,'owner@example.invalid','abcdefghijklmnop'));
  assert.equal(client.session,null);
  assert.ok(client.history.includes('logout'));
 }
 const client=fakeClient();
 await assert.rejects(verifyDisposableFirstAccount(client));
 assert.equal(client.session,null);
});

test('Account and Library 8-locale public OFF/noindex and no private data in static shell',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.equal(Object.keys(FIRST_ACCOUNT_COPY).length,8);
 for(const locale of locales){
  const copy=firstAccountCopy(locale);
  for(const k of ['title','off','test','email','password','register','signIn','signOut',
   'pending','signed','out','failed','library','libraryOff','profileOff','back']){
   assert.ok(typeof copy[k]==='string'&&copy[k].trim().length>0,locale+' '+k);
  }
 }
 assert.match(account,/<meta name="robots" content="noindex,nofollow"/);
 assert.equal(existsSync(new URL('../'+libraryRoute,import.meta.url)),false,
  'No unauthenticated static private Library HTML200 route');
 for(const marker of ['data-account-public="off"','data-private-library="off"',
  'data-first-account-form','data-first-account-register','data-first-account-login',
  'data-first-account-logout','data-account-off','data-first-account-state']){
  assert.ok(account.includes(marker),marker);
 }
 assert.ok(account.includes('data-library-unavailable="true"'));
 assert.doesNotMatch(account,/href=\{base\+'\/library\/\'\}/);
 assert.doesNotMatch(account,/JSON\.stringify\(session|accessToken\}|refreshToken\}|console\.log/);
 assert.doesNotMatch(account,/srcset|<img|cloudUpload|publishGallery|createGalleryDraft/);
});
