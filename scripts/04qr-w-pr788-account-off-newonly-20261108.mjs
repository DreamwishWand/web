// 04 QR-W independent changed-only new PR788 Account OFF + private Library 404.
// This never contacts managed GoTrue or sends a credential or a token.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {
 resolveFirstAccountTestGate,registerDisposableFirstAccount,
 signInDisposableFirstAccount,verifyDisposableFirstAccount,
 FIRST_ACCOUNT_PUBLIC_ENABLED,PUBLIC_PROFILE_RUNTIME_ACCEPTED,
 PRIVATE_LIBRARY_RUNTIME_ACCEPTED, OWNER_DISPOSABLE_STAGING_AUTH_ORIGIN
} from '../src/lib/account-ui/test-contract.mjs';

const SOURCE='ed891d8244c6b628a140b9930fa3fa2b7568050b';
const PARENT='1024d4207245ed99126abedcf3452ef670a44c6a';
const original=new Map([
 ['.github/workflows/web-first-account-ui.yml','8737a6becdfa90d1695eb8abe6c2ac2435daa58e'],
 ['scripts/web-first-account-local-chrome.mjs','56415a88223f0cf4827c16e24d719b63cfa9c296'],
 ['src/lib/account-ui/copy.mjs','d2ee7aae99db8f8754703513e13f7c9d352db6ec'],
 ['src/lib/account-ui/test-contract.mjs','950c5598168b3abeb4f5131e4f11226c6963de93'],
 ['src/routes/account/+page.svelte','4df3cb696cd4ce33523b111628c0909bc914326d'],
 ['tests/web-first-account-local-ui.test.mjs','43a6b5366c63401e80bfdfd1ced2d9718ddd4c96']
]);
const audit=[
 '.github/workflows/04qr-w-pr788-account-off-newonly-20261108.yml',
 'scripts/04qr-w-pr788-account-off-newonly-20261108.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const paths=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
assert.deepEqual(paths(PARENT,SOURCE),[...original.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(paths(SOURCE,'HEAD'),audit);
for(const [path,sha] of original){
 assert.equal(git('rev-parse',SOURCE+':'+path),sha,'fixed original Source blob');
 assert.equal(git('hash-object',path),sha,'Source modified by QA');
}
assert.equal(git('diff','--name-only',PARENT,SOURCE,'--',
 'src/lib/community/','src/routes/community-lab/',
 'src/routes/library/','src/routes/users/','src/routes/+layout.svelte',
 'src/routes/+layout.server.js','.github/workflows/pages.yml','svelte.config.js','supabase/'),'');
console.log('QRW788_EXACT_ORIGINAL_SOURCE6_QA_ONLY2_NO_AUTH_OR_HOST_EDIT_PASS');

// All gate credentials here are deliberately synthetics, never exported or contacted.
const good={flag:'OWNER_DISPOSABLE_STAGING_TEST',hostname:'127.0.0.1',
 supabaseUrl:OWNER_DISPOSABLE_STAGING_AUTH_ORIGIN,
 publishableKey:'sb_publishable_synthetic_test_0123'};
assert.equal(FIRST_ACCOUNT_PUBLIC_ENABLED,false);
assert.equal(PUBLIC_PROFILE_RUNTIME_ACCEPTED,false);
assert.equal(PRIVATE_LIBRARY_RUNTIME_ACCEPTED,false);
assert.equal(resolveFirstAccountTestGate().allowed,false);
for(const input of [
 {...good,flag:''},{...good,flag:'OWNER_DISPOSABLE_STAGING_TEST '},
 {...good,hostname:'dreamwishwand.com'},
 {...good,hostname:'dreamwishwand.github.io.evil.invalid'},
 {...good,hostname:'localhost.evil.invalid'},
 {...good,supabaseUrl:'https://ptpdoxhrqopvczpclcij.supabase.co.evil.invalid'},
 {...good,supabaseUrl:'http://ptpdoxhrqopvczpclcij.supabase.co'},
 {...good,publishableKey:'service_role_sensitive'},
 {...good,publishableKey:'sb_publishable_short'},
 {...good,publishableKey:''}
])assert.equal(resolveFirstAccountTestGate(input).allowed,false,JSON.stringify(input));
assert.equal(resolveFirstAccountTestGate(good).allowed,true);
console.log('QRW788_EXACT_TEST_ORIGIN_HOST_FLAG_KEY_DENY_UNAPPROVED_PRODUCTION_PASS');

const mock=({
 accountId='account_other', sessionId='account_owner', expiration=Date.now()+120000,
 ok=true, signupConfirm=true, queryThrows=false
}={})=>{
 const history=[];let session=null;
 return {
  history,get session(){return session;},
  async signInWithPassword(){history.push('signin');session={
   userId:sessionId,expiresAt:expiration,email:'owner@example.invalid',
   accessToken:'never-publish',refreshToken:'never-publish'
  };return session;},
  async signUpWithPassword(){history.push('signup');return {requiresEmailConfirmation:signupConfirm};},
  async query(q){history.push(q);if(queryThrows)throw Error('401 revoked');return {ok,data:{accountId}};},
  async signOut(){history.push('signout');session=null;}
 };
};
for(const config of [
 {accountId:'other_account'}, {sessionId:'account_owner',expiration:Date.now()-1},
 {accountId:null}, {ok:false},{queryThrows:true},
 {sessionId:'',accountId:''},{expiration:NaN},
 {expiration:'2030-01-01T00:00:00Z'}
]){
 const client=mock(config);
 await assert.rejects(signInDisposableFirstAccount(client,'test@example.invalid','long-synthetic-not-sent'));
 assert.equal(client.session,null,'failure must clear local session');
 assert.ok(client.history.includes('signout'));
}
const unconfirmed=mock({signupConfirm:false});
await assert.rejects(registerDisposableFirstAccount(unconfirmed,'fake@example.invalid','long-synthetic-not-sent'),/EMAIL_CONFIRMATION_POLICY_NOT_MET/);
assert.ok(unconfirmed.history.includes('signout'));
const verified=mock({accountId:'account_owner'});
const identity=await signInDisposableFirstAccount(verified,'fake@example.invalid','long-synthetic-not-sent');
assert.equal(identity.status,'DISPOSABLE_STAGING_IDENTITY_VERIFIED');
assert.equal(identity.privateLibraryAuthorized,false);
assert.equal(identity.publicProfilePublished,false);
assert.equal(JSON.stringify(identity).includes('never-publish'),false);
assert.equal((await verifyDisposableFirstAccount(verified)).userId,'account_owner');
console.log('QRW788_SYNTHETIC_OTHER_ACCOUNT_EXPIRED_REVOKED_MISSING_QUERY_FAILCLOSED_NO_PRIVATE_RIGHTS_PASS');

// HTTP adapter-static status contract: 404 fallback body must retain 404 status.
const build=resolve('build');
const port=4298;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json',
 '.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){
  res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;
 }
 let pathname;
 try{pathname=new URL(req.url||'/', 'http://127.0.0.1').pathname;}
 catch{res.writeHead(400);res.end();return;}
 if(!pathname.startsWith('/web/')||pathname.includes('..')||pathname.includes('//')||pathname.includes('\\')){
  res.writeHead(404);res.end('Not Found');return;
 }
 const tail=pathname.slice('/web/'.length);
 const file=resolve(build,tail+(tail===''||tail.endsWith('/')?'index.html':''));
 if(!file.startsWith(build+sep)){res.writeHead(404);res.end();return;}
 let code=200,buffer;
 try{buffer=await readFile(file);}
 catch{code=404;buffer=await readFile(resolve(build,'404.html'));}
 res.writeHead(code,{'Content-Type':MIME[extname(file)]||'text/html; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD'){res.end();return;}
 res.end(buffer);
});
await new Promise(ok=>server.listen(port,'127.0.0.1',ok));
const host='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:850}});
const page=await context.newPage();
const offsite=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',r=>{
 const request=r.request(),u=new URL(request.url());
 if(u.origin!==host||!['GET','HEAD'].includes(request.method())){
  offsite.push(request.method()+' '+request.url());return r.abort('blockedbyclient');
 }
 return r.continue();
});
try{
 const home=await fetch(host+'/web/account/',{redirect:'manual'});
 assert.equal(home.status,200);
 assert.equal(home.headers.get('location'),null);
 const responseHtml=await home.text();
 assert.match(responseHtml,/<meta\s+name="robots"\s+content="noindex,nofollow"/i);
 assert.doesNotMatch(responseHtml,/sb_publishable_|never-publish|accessToken|refreshToken/i);
 const forbidden=['library/','users/admin/','users/example_123/',
  'ja/users/example_123/','account/private/','community-lab/private/'];
 for(const path of forbidden){
  const r=await fetch(host+'/web/'+path,{redirect:'manual'});
  assert.equal(r.status,404,'no static private route GET200: '+path);
  assert.equal(r.headers.get('location'),null,'no invented redirect: '+path);
  assert.match(await r.text(),/<html/i,'404 fallback HTML body must be real 404: '+path);
 }
 const method=await fetch(host+'/web/account/',{method:'POST',redirect:'manual'});
 assert.equal(method.status,405);
 assert.equal(method.headers.get('location'),null);
 console.log('QRW788_REAL_STATIC_HTTP_ACCOUNT200_NOINDEX_PRIVATE_USERS_LIBRARY404_POST405_PASS');

 const rendered=await page.goto(host+'/web/account/',{waitUntil:'domcontentloaded'});
 assert.equal(rendered.status(),200);
 const root=page.locator('[data-account-entry]');
 await root.waitFor();
 assert.equal(await root.getAttribute('data-account-test-runtime'),'off');
 assert.equal(await root.getAttribute('data-account-public'),'off');
 assert.equal(await root.getAttribute('data-private-library'),'off');
 assert.equal(await page.locator('[data-first-account-register]').isDisabled(),true);
 assert.equal(await page.locator('[data-first-account-login]').isDisabled(),true);
 assert.equal(await page.locator('[data-first-account-logout]').count(),0);
 assert.equal(await page.locator('a[href*="/library/"]').count(),0);
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.waitForFunction(c=>document.documentElement.dataset.locale===c,locale);
  assert.equal(await root.getAttribute('data-account-test-runtime'),'off');
  assert.equal(await page.locator('[data-first-account-register]').isDisabled(),true);
  assert.equal(await page.locator('[data-first-account-login]').isDisabled(),true);
  assert.ok((await page.locator('[data-account-private-warning]').innerText()).trim());
  assert.ok((await page.locator('[data-account-public-profile-warning]').innerText()).trim());
  assert.equal(await page.locator('[data-account-entry]').getAttribute('data-private-library'),'off');
 }
 for(const [width,zoom] of [[320,1],[640,2]]){
  await page.setViewportSize({width,height:850});
  await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
  const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,
   scroll:document.documentElement.scrollWidth}));
  assert.ok(layout.scroll<=layout.client+2,'Account reflow '+width+' zoom='+zoom+' '+JSON.stringify(layout));
  const focus=page.locator('a:visible').first();
  await focus.focus();
  assert.equal(await focus.evaluate(e=>document.activeElement===e),true);
 }
 assert.deepEqual(offsite,[],'no external Auth, private HTTP POST, Provider, or uploaded data');
 assert.deepEqual(errors,[],'zero unhandled browser exceptions');
 console.log('QRW788_EIGHT_LOCALE_DEFAULT_OFF_320_640CSS200_KEYBOARD_ZERO_OFFSITE_PASS');
 console.log('QRW788_INDEPENDENT_INSTALLED_CHROME_FINAL_SOURCE_SCOPED_PASS__MANAGED_AUTH_NOT_RUN');
}finally{
 await context.close();await browser.close();
 await new Promise((ok,reject)=>server.close(e=>e?reject(e):ok()));
}
