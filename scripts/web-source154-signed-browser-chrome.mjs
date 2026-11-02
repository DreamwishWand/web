import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// DEV-only: genuine disposable GoTrue ES256 + Source154; no managed TLS.
// Shared Community Client, PR291, WEB267 and PR301 Svelte route are UNMODIFIED.
// Authenticated session-revoke below is a HARNESS operation, not product Logout.
const env=process.env,ORIGIN='http://127.0.0.1:4175';
const virtual='https://wand-disposable-e2.invalid';
const ownerPath='/__source153_e2/functions/v1/community-dreamsnap-owner';
for(const name of ['CHROME_BIN','E2_OWNER_EMAIL','E2_OWNER_PASSWORD','E2_B_EMAIL',
 'E2_B_PASSWORD','E2_POST_WORK_ID','E2_REAL_LOCAL_ANON_PUBLIC_KEY'])
 if(!env[name])throw Error('SOURCE154_DISPOSABLE_MISSING_INPUT_'+name);
if(env.DDVRE_E2_LOCAL_DISPOSABLE!=='APPROVED')throw Error('SOURCE154_NOT_DISPOSABLE');
const browser=await chromium.launch({executablePath:env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const eventually=async fn=>{for(let i=0;i<120;i++){if(await fn())return;await sleep(125);}
 throw Error('SOURCE154_BROWSER_TIMEOUT');};
const errors=[],responses=[];
const privateHeaders=['cache-control','cdn-cache-control','surrogate-control','vary'];
const httpStatus=async(page)=>page.locator('[data-bridge-status]').innerText();
const hasView=async(page)=>page.locator('[data-bridge-projection]').count()===1;
const doInspect=async page=>page.locator('[data-bridge-inspect]').click();
const signedSession=async page=>page.evaluate(()=>{
 const keys=Object.keys(sessionStorage).filter(k=>k.startsWith('dreamwishwand-community-session-v2:'));
 if(keys.length!==1)throw Error('SOURCE154_SESSION_FIXTURE_SCOPE_MISSING');
 const record=JSON.parse(sessionStorage.getItem(keys[0])||'null');
 if(!record?.session?.accessToken||!record.session.refreshToken)
   throw Error('SOURCE154_SESSION_FIXTURE_MISSING');
 return {token:record.session.accessToken,refresh:record.session.refreshToken};
});
const ownerRequest=async(page,{token,operation='authority',scope})=>
 page.evaluate(async ({token,operation,scope,work,virtual,key})=>{
  const body=operation==='session-revoke'?{operation,scope}:{operation,workId:work};
  const response=await fetch(virtual+'/functions/v1/community-dreamsnap-owner',{
   method:'POST',headers:{Authorization:'Bearer '+token,apikey:key,
    'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify(body),cache:'no-store',credentials:'omit',redirect:'error',
   referrerPolicy:'no-referrer'});
  const h={};for(const name of ['cache-control','cdn-cache-control',
   'surrogate-control','vary'])h[name]=response.headers.get(name);
  const result=response.status===200?await response.json().catch(()=>null):null;
  // Do not return any private DTO/IDs/JWT or account information to runner.
  return {code:response.status,state:operation==='session-revoke'?
   (result?.state||'INVALID'):null,headers:h};
 },{token,operation,scope,work:env.E2_POST_WORK_ID,virtual,
   key:'sb_publishable_disposable_local_bridge_only'});
const checkHeaders=h=>{
 assert.match(h['cache-control']??'',/private.*no-store.*max-age=0/i);
 assert.equal(h['cdn-cache-control'],'no-store');
 assert.equal(h['surrogate-control'],'no-store');
 assert.match(h['vary']??'',/authorization/i);
 assert.match(h['vary']??'',/origin/i);
};
const pageSet=[];
async function makePage(context){
 const page=await context.newPage();pageSet.push(page);
 page.on('pageerror',()=>errors.push('PAGE_ERROR'));
 page.on('console',msg=>{
  if(msg.type()!=='error')return;
  const m=msg.text().match(/^Failed to load resource: the server responded with a status of (401|403|404)\b/);
  const src=msg.location()?.url??'';
  if(!(m&&(!src||src.includes(ownerPath))))errors.push('CONSOLE_ERROR');
 });
 page.on('response',async r=>{
  if(r.url().includes(ownerPath)){
   responses.push(r.status());
   if(r.status()===200||r.status()===401){
    const h=await r.allHeaders();
    if(privateHeaders.every(k=>typeof h[k]==='string'))checkHeaders(h);
    else errors.push('MISSING_PRIVATE_EDGE_HEADER');
   }
  }
 });
 await page.addInitScript(({virtual,loopback,anon,fake})=>{
  const original=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const raw=typeof input==='string'?input:input?.url;
   const inVirtual=typeof raw==='string'&&raw.startsWith(virtual+'/');
   const localOwner=typeof raw==='string'&&raw.startsWith(loopback+'/functions/v1/community-dreamsnap-owner');
   if(!inVirtual&&!localOwner)return original(input,init);
   const h=new Headers(init?.headers??{});
   if(h.get('apikey')===fake)h.set('apikey',anon);
   return original(inVirtual?loopback+raw.slice(virtual.length):input,{...init,headers:h});
  };
 },{virtual,loopback:ORIGIN+'/__source153_e2',anon:env.E2_REAL_LOCAL_ANON_PUBLIC_KEY,
   fake:'sb_publishable_disposable_local_bridge_only'});
 await page.goto(ORIGIN+'/disposable-owner-signed-bridge/?work='+env.E2_POST_WORK_ID,
  {waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-bridge-login]').count()===1);
 return page;
}
async function login(page,email,password){
 await page.locator('#bridge-email').fill(email);
 await page.locator('#bridge-pass').fill(password);
 await page.locator('[data-bridge-login] button').click();
 await eventually(async()=>page.locator('[data-bridge-logout]').isEnabled());
}
try{
 const c1=await browser.newContext({viewport:{width:1280,height:800}});
 const c2=await browser.newContext({viewport:{width:1280,height:800}});
 const a1=await makePage(c1),a2=await makePage(c2);
 await login(a1,env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD);
 await login(a2,env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD);
 const first=await signedSession(a1),second=await signedSession(a2);
 const jwtPayload=t=>JSON.parse(Buffer.from(t.split('.')[1],'base64url').toString());
 const j1=jwtPayload(first.token),j2=jwtPayload(second.token);
 assert.equal(j1.sub,j2.sub);assert.notEqual(j1.session_id,j2.session_id);
 assert.ok(j1.exp>Date.now()/1000+30&&j2.exp>Date.now()/1000+30);
 await doInspect(a1);await eventually(()=>hasView(a1));
 await doInspect(a2);await eventually(()=>hasView(a2));
 assert.equal(await httpStatus(a1),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(await httpStatus(a2),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 console.log('WEB154_REAL_BROWSER_DISTINCT_A1_A2_SIGNED_200');

 // Four NATIVE browser headers on 200: strip each actual response separately.
 // Do not invent safe headers in WEB267, reader, or transport.
 for(const name of privateHeaders){
  let stripped=false;
  await a2.route('**'+ownerPath,async route=>{
   if(stripped)return route.continue();
   const request=route.request().postDataJSON?.();
   if(request?.operation!=='authority')return route.continue();
   stripped=true;
   const upstream=await route.fetch();
   const headers={...upstream.headers()};delete headers[name];
   await route.fulfill({response:upstream,headers});
  });
  await doInspect(a2);
  await eventually(async()=>await httpStatus(a2)==='UNSAFE_CACHE_POLICY');
  assert.equal(await a2.locator('[data-bridge-projection]').count(),0);
  assert.equal(stripped,true);
  await a2.unroute('**'+ownerPath);
  await doInspect(a2);await eventually(()=>hasView(a2));
 }
 console.log('WEB154_REAL_BROWSER_FOUR_PRIVATE_HEADERS_FAIL_CLOSED');

 // Authenticated LOCAL terminal revoke via disposable harness; no Client
 // session-Logout call or product server-first wiring is introduced.
 const local=await ownerRequest(a1,{token:first.token,operation:'session-revoke',scope:'local'});
 assert.equal(local.code,200);assert.equal(local.state,'revoked');checkHeaders(local.headers);
 assert.ok(jwtPayload(first.token).exp>Date.now()/1000);
 await doInspect(a1);
 await eventually(async()=>await httpStatus(a1)==='BACKEND_UNAVAILABLE');
 assert.equal(await a1.locator('[data-bridge-projection]').count(),0);
 assert.equal(responses.at(-1),401);
 // Sticky 401 after same-Work prior CAS: resume MUST NOT bypass manual Fresh.
 const beforeResume=responses.length;
 await a1.evaluate(()=>{window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('pageshow'));});
 await sleep(300);assert.equal(responses.length,beforeResume);
 assert.equal(await a1.locator('[data-bridge-inspect]').isDisabled(),true);
 await a2.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await doInspect(a2);await eventually(()=>hasView(a2));
 const directA2=await ownerRequest(a2,{token:second.token});
 assert.equal(directA2.code,200);checkHeaders(directA2.headers);
 console.log('WEB154_REAL_BROWSER_LOCAL_A1_401_A2_200_DOM_CLEARED');

 // Legitimate real GoTrue refresh is not equivalent to Wand server authority.
 const refreshed=await a1.evaluate(async ({refresh,virtual,key})=>{
  const res=await fetch(virtual+'/auth/v1/token?grant_type=refresh_token',{
   method:'POST',headers:{apikey:key,'content-type':'application/json'},
   body:JSON.stringify({refresh_token:refresh}),cache:'no-store'});
  if(res.status!==200)return {refreshStatus:res.status,ownerStatus:null};
  const body=await res.json();
  const owner=await fetch(virtual+'/functions/v1/community-dreamsnap-owner',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+body.access_token,
   'content-type':'application/json'},
   body:JSON.stringify({operation:'authority',workId:window.location.search.replace('?work=','')}),
   cache:'no-store'});
  return {refreshStatus:res.status,ownerStatus:owner.status};
 },{refresh:first.refresh,virtual,key:'sb_publishable_disposable_local_bridge_only'});
 assert.ok([200,400,401,403,422].includes(refreshed.refreshStatus));
 if(refreshed.refreshStatus===200)assert.equal(refreshed.ownerStatus,401);
 console.log('WEB154_REAL_BROWSER_REFRESH_CANNOT_REAUTHORIZE_REVOKED_A1');

 // Native same-origin tab retains a captured legacy bearer even when a
 // localStorage logout announcement write is prevented. This deliberately
 // does not pretend that old UI can be force-erased in a suspended tab.
 const old=await makePage(c1);
 await old.evaluate(()=>{window.__lostNoticeObserved=false;
  window.addEventListener('storage',()=>{window.__lostNoticeObserved=true;});});
 await a1.evaluate(()=>{const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
   if(this===window.localStorage)throw new DOMException('denied','QuotaExceededError');
   return original.call(this,k,v);
  };});
 await a1.locator('[data-bridge-logout]').click();
 await eventually(async()=>!(await a1.locator('[data-bridge-logout]').isEnabled()));
 await sleep(250);
 assert.equal(await old.evaluate(()=>window.__lostNoticeObserved),false);
 const stale=await ownerRequest(old,{token:first.token});
 assert.equal(stale.code,401);checkHeaders(stale.headers);
 assert.equal(await a1.locator('[data-bridge-projection]').count(),0);
 console.log('WEB154_REAL_BROWSER_MISSED_NOTICE_OLD_JWT_SERVER_DENIED');

 // GLOBAL authenticated by still-valid A2; A1's local revoke cannot be used
 // to upgrade scope. The second existing session then loses Source authority.
 const global=await ownerRequest(a2,{token:second.token,operation:'session-revoke',scope:'global'});
 assert.equal(global.code,200);assert.equal(global.state,'revoked');checkHeaders(global.headers);
 await doInspect(a2);
 await eventually(async()=>await httpStatus(a2)==='BACKEND_UNAVAILABLE');
 assert.equal(await a2.locator('[data-bridge-projection]').count(),0);
 const oldGlobal=await ownerRequest(old,{token:first.token});
 assert.equal(oldGlobal.code,401);
 const siblingGlobal=await ownerRequest(old,{token:second.token});
 assert.equal(siblingGlobal.code,401);
 console.log('WEB154_REAL_BROWSER_GLOBAL_A1_A2_401');

 // Independent B signed session remains, but cannot read A private Work.
 const bContext=await browser.newContext(),b=await makePage(bContext);
 await login(b,env.E2_B_EMAIL,env.E2_B_PASSWORD);
 await doInspect(b);
 await eventually(async()=>await httpStatus(b)==='BACKEND_UNAVAILABLE');
 assert.equal(await b.locator('[data-bridge-projection]').count(),0);
 const bs=await signedSession(b);const foreign=await ownerRequest(b,{token:bs.token});
 assert.equal(foreign.code,403);checkHeaders(foreign.headers);
 console.log('WEB154_REAL_BROWSER_NONOWNER_B_UNAFFECTED_403');

 // After global cutoff a brand new valid A3 can receive private Source-only
 // projection. Delayed genuine signed HTTP 200 MUST NOT survive local logout.
 await sleep(1900);
 const freshContext=await browser.newContext(),a3=await makePage(freshContext);
 await login(a3,env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD);
 await doInspect(a3);await eventually(()=>hasView(a3));
 let held=false,release;
 const waitForRelease=new Promise(resolve=>release=resolve);
 await a3.route('**'+ownerPath,async route=>{
  const operation=route.request().postDataJSON?.()?.operation;
  if(operation!=='authority')return route.continue();
  held=true;
  try{const real=await route.fetch();assert.equal(real.status(),200);
   await waitForRelease;await route.fulfill({response:real});
  }catch{try{await route.abort();}catch{}}
 });
 const pending=doInspect(a3);
 await eventually(()=>held);
 await a3.locator('[data-bridge-logout]').click();release();
 await pending.catch(()=>{});
 await eventually(async()=>!(await a3.locator('[data-bridge-logout]').isEnabled()));
 assert.equal(await a3.locator('[data-bridge-projection]').count(),0);
 assert.equal(await httpStatus(a3),'AUTH_REQUIRED');
 await a3.unroute('**'+ownerPath);
 console.log('WEB154_REAL_BROWSER_HELD_200_CANNOT_RESTORE_LOGGED_OUT_VIEW');

 for(const p of pageSet){
  assert.equal(await p.locator('[data-bridge-capabilities="all-disabled"]').count(),1);
  const dom=await p.content();
  for(const secret of [env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD,env.E2_B_EMAIL,
   env.E2_B_PASSWORD,'access_token','refresh_token','photoMediaId','storageKey'])
    assert.ok(!dom.includes(secret),'PRIVATE_BROWSER_DOM_LEAK');
  assert.ok(!/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(dom));
 }
 assert.deepEqual(errors,[]);
 console.log('WEB154_DISPOSABLE_SIGNED_BROWSER_NEGATIVE_PASS');
}finally{await browser.close();}
