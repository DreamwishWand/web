import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// Actual local GoTrue ES256 and FULL153 Edge, NOT synthetic HTTP. Browser
// HTTPS-looking Community config is remapped ONLY by this test-only page shim
// to disposable Vite loopback proxy. No managed ingress/CORS claim.
const env=process.env;
const required=['CHROME_BIN','E2_OWNER_EMAIL','E2_OWNER_PASSWORD',
  'E2_B_EMAIL','E2_B_PASSWORD','E2_ORIGINAL_WORK_ID','E2_POST_WORK_ID'];
if(env.DDVRE_E2_LOCAL_DISPOSABLE!=='APPROVED'||
  required.some(k=>!env[k]))throw Error('SIGNED_BRIDGE_DISPOSABLE_ONLY');
const ORIGIN='http://127.0.0.1:4175';
const ROUTE='/disposable-owner-signed-bridge/?work=';
const ownerPath='/__source153_e2/functions/v1/community-dreamsnap-owner';
const browser=await chromium.launch({executablePath:env.CHROME_BIN,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[],ownerResponses=[],ownerHeaders=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const eventually=async(fn)=>{
  for(let i=0;i<140;i++){if(await fn())return;await sleep(100);}
  throw Error('DISPOSABLE_BRIDGE_BROWSER_OBSERVATION_TIMEOUT');
};
const handshake=async(msg)=>{
  process.stdout.write(msg+'\n');
  await new Promise((resolve,reject)=>{
    const t=setTimeout(()=>reject(Error('SIGNED_BRIDGE_HANDSHAKE_TIMEOUT')),90000);
    process.stdin.once('data',()=>{clearTimeout(t);resolve();});
  });
};
let context,page;
try{
  context=await browser.newContext({viewport:{width:1280,height:800}});
  page=await context.newPage();
  page.on('pageerror',()=>errors.push('PAGE_ERROR'));
  page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE_ERROR');});
  page.on('response',async r=>{
    if(r.url().includes(ownerPath)){
      ownerResponses.push(r.status());
      if(r.status()===200){
        const h=await r.allHeaders();
        ownerHeaders.push(h);
      }
    }
  });
  // No Vite HTTPS exemption in product source; the shim exists ONLY here.
  // Scoped to this fake HTTPS origin and leaves all other requests untouched.
  await page.addInitScript(({virtual,loopback})=>{
    const original=window.fetch.bind(window);
    window.fetch=(input,init)=>{
      const raw=typeof input==='string'?input:input?.url;
      if(typeof raw==='string' && raw.startsWith(virtual+'/')){
        return original(loopback+raw.slice(virtual.length),init);
      }
      return original(input,init);
    };
  },{virtual:'https://wand-disposable-e2.invalid',loopback:ORIGIN+'/__source153_e2'});

  await page.goto(ORIGIN+ROUTE+'bad-id',{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('[data-bridge-invalid]').count()===1);
  assert.equal(ownerResponses.length,0);
  await page.goto(ORIGIN+ROUTE+env.E2_ORIGINAL_WORK_ID,{waitUntil:'domcontentloaded'});
  await eventually(async()=>await page.locator('[data-bridge-login]').count()===1);
  assert.equal(await page.locator('[data-disposable-owner-bridge]').getAttribute('data-owner-actions'),'disabled');
  const login=async(email,password)=>{
    await page.locator('#bridge-email').fill(email);
    await page.locator('#bridge-pass').fill(password);
    await page.locator('[data-bridge-login] button').click();
    await eventually(async()=>await page.locator('[data-bridge-logout]').isEnabled());
  };
  const status=async()=>await page.locator('[data-bridge-status]').innerText();
  const inspect=async()=>{await page.locator('[data-bridge-inspect]').click();};
  const hasView=async()=>await page.locator('[data-bridge-projection]').count()===1;
  await login(env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD);
  await inspect();
  await eventually(hasView);
  assert.equal(await status(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(ownerResponses.at(-1),200);
  assert.equal(await page.locator('[data-bridge-grant]').innerText(),'recorded');
  const h=ownerHeaders.at(-1);
  for(const key of ['cache-control','cdn-cache-control','surrogate-control','vary'])
    assert.ok(typeof h?.[key]==='string' && h[key].length>0,'MISSING_PRIVATE_HEADER_'+key);
  assert.match(h['cache-control'],/no-store/i);
  assert.match(h['cdn-cache-control'],/no-store/i);
  assert.match(h['surrogate-control'],/no-store/i);
  assert.match(h['vary'],/authorization/i);

  // Already-signed A is not allowed to reuse original Work for B.
  await page.locator('[data-bridge-logout]').click();
  await eventually(async()=>!(await page.locator('[data-bridge-logout]').isEnabled()));
  assert.equal(await page.locator('[data-bridge-projection]').count(),0);
  await login(env.E2_B_EMAIL,env.E2_B_PASSWORD);
  await inspect();
  await eventually(async()=>['BACKEND_UNAVAILABLE','SOURCE_CONTRACT_REJECTED',
    'AUTH_UNAVAILABLE'].includes(await status()));
  assert.ok([401,403,404].includes(ownerResponses.at(-1)),'SIGNED_B_MUST_NOT_OWN_A');
  assert.equal(await page.locator('[data-bridge-projection]').count(),0);
  await page.locator('[data-bridge-logout]').click();
  await login(env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD);
  await inspect();
  await eventually(hasView);
  assert.equal(await status(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');

  await handshake('BRIDGE_CAS_READY');
  // Runner issues a genuine signed withdrawal in a separate server operation.
  await inspect();
  await eventually(async()=>await status()==='BACKEND_UNAVAILABLE');
  assert.equal(ownerResponses.at(-1),403,'STICKY_CAS_MUST_BE_HTTP403');
  assert.equal(await page.locator('[data-bridge-projection]').count(),0);
  assert.equal(await page.locator('[data-bridge-inspect]').isDisabled(),true);
  const before=ownerResponses.length;
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await sleep(400);
  assert.equal(ownerResponses.length,before,'NO_AUTO_CAS_FRESH');
  await page.locator('[data-bridge-fresh]').click();
  await eventually(hasView);
  assert.equal(ownerResponses.at(-1),200);
  assert.equal(await page.locator('[data-bridge-grant]').innerText(),'withdrawn');
  assert.equal(await page.locator('[data-bridge-public-disabled]').innerText(),'true');

  // Strip one of FOUR actual browser-visible private cache headers. No
  // synthetic "safe" headers are ever injected by the source bridge.
  let stripped=false;
  await page.route('**'+ownerPath,async route=>{
    if(stripped)return route.continue();
    stripped=true;
    const actual=await route.fetch();
    const headers={...actual.headers()};
    delete headers['cdn-cache-control'];
    await route.fulfill({response:actual,headers});
  });
  await inspect();
  await eventually(async()=>await status()==='UNSAFE_CACHE_POLICY');
  assert.equal(await page.locator('[data-bridge-projection]').count(),0);
  assert.equal(stripped,true);
  await page.unroute('**'+ownerPath);

  // Late response after shared logout must not repopulate the DOM.
  let started=false,release;
  const deferred=new Promise(resolve=>release=resolve);
  await page.route('**'+ownerPath,async route=>{
    started=true;
    try{const actual=await route.fetch();await deferred;
      await route.fulfill({response:actual});
    }catch{try{await route.abort();}catch{}}
  });
  const readPending=inspect();
  await eventually(()=>started);
  await page.locator('[data-bridge-logout]').click();
  release();
  await readPending.catch(()=>{});
  await eventually(async()=>!(await page.locator('[data-bridge-logout]').isEnabled()));
  assert.equal(await page.locator('[data-bridge-projection]').count(),0);
  assert.equal(await status(),'AUTH_REQUIRED');
  await page.unroute('**'+ownerPath);

  // User-facing source is sanitized: no Account, Media, tokens, signed URL.
  const dom=await page.content();
  for(const secret of [env.E2_OWNER_EMAIL,env.E2_OWNER_PASSWORD,env.E2_B_EMAIL,
    env.E2_B_PASSWORD,'access_token','refresh_token','storageKey',
    'signedUrl','photoMediaId','mediaSigningEnabled','Authorization: Bearer'])
    assert.ok(!dom.includes(secret),'PRIVATE_OWNER_DOM_LEAK');
  assert.ok(!/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(dom));
  assert.equal(await page.locator('[data-bridge-capabilities="all-disabled"]').count(),1);
  assert.deepEqual(errors,[]);
  console.log('WEB_SHARED_SIGNED_BRIDGE_LOCAL_BROWSER_PASS');
  console.log('WEB_SHARED_SIGNED_BRIDGE_CACHE_FOUR_VISIBLE_STRIP_REJECTED');
  console.log('WEB_SHARED_SIGNED_BRIDGE_ACTOR_CAS_LOGOUT_STALE_DENIED');
}finally{
  if(page)await page.close().catch(()=>{});
  if(context)await context.close().catch(()=>{});
  await browser.close();
}
