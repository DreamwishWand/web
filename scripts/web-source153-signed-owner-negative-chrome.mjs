import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// New-only disposable negative acceptance: never prints account, token, IDs,
// credentials, HTTP bodies, response headers, or raw DOM.
const origin='http://127.0.0.1:4175';
const id=process.env;
const scenario=id.E2_NEGATIVE_CASE;
const allowed=['DOM_A11Y','IDENTITY','ACCOUNT','CREATOR','PRIVACY',
  'CAS','WITHDRAWN','POLICY','RACE_WORK','RACE_SESSION','RACE_HISTORY'];
if(id.DDVRE_E2_LOCAL_DISPOSABLE!=='APPROVED' || !allowed.includes(scenario) ||
   !id.CHROME_BIN || !id.E2_ORIGINAL_WORK_ID || !id.E2_POST_WORK_ID ||
   !id.E2_OWNER_EMAIL || !id.E2_OWNER_PASSWORD || !id.E2_B_EMAIL ||
   !id.E2_B_PASSWORD)throw Error('SIGNED_NEGATIVE_LOCAL_FIXTURE_REQUIRED');
const browser=await chromium.launch({executablePath:id.CHROME_BIN,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const eventually=async(fn)=>{
  for(let n=0;n<150;n++){if(await fn())return;await wait(80);}
  throw Error('NEGATIVE_BROWSER_EXPECTATION_TIMEOUT');
};
try {
  const ctx=await browser.newContext({viewport:{width:1280,height:850}});
  const page=await ctx.newPage();
  const actualStatuses=[];
  const errors=[];
  page.on('pageerror',()=>errors.push('PAGE_ERROR'));
  page.on('response',r=>{
    if(r.url().includes('/__source153_e2/functions/v1/community-dreamsnap-owner'))
      actualStatuses.push(r.status());
  });
  page.on('console',m=>{
    if(m.type()==='error' && !/401|403|409/.test(m.text()))
      errors.push('CONSOLE_ERROR');
  });
  const navigate=async(work)=>{
    const response=await page.goto(origin+'/dreamsnaps/my/manage/source153-e2/?work='+work,
      {waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.locator('[data-source153-e2="local-only"]').waitFor();
  };
  const signIn=async(who='A',viaEnter=false)=>{
    const user=who==='A'?[id.E2_OWNER_EMAIL,id.E2_OWNER_PASSWORD]:
      [id.E2_B_EMAIL,id.E2_B_PASSWORD];
    await page.locator('#e2-email').fill(user[0]);
    await page.locator('#e2-password').fill(user[1]);
    if(viaEnter)await page.locator('#e2-password').press('Enter');
    else await page.locator('[data-e2-login] button').click();
    await eventually(async()=>{
      const status=(await page.locator('[data-e2-status]').innerText()).trim();
      return ['SIGNED_LOCAL_SESSION_CANDIDATE','AUTH_DENIED','AUTH_UNAVAILABLE'].includes(status);
    });
    assert.equal((await page.locator('[data-e2-status]').innerText()).trim(),
      'SIGNED_LOCAL_SESSION_CANDIDATE');
    assert.equal(await page.locator('#e2-password').inputValue(),'');
  };
  const read=async()=>{
    await page.locator('[data-e2-inspect]').click();
    await eventually(async()=>
      (await page.locator('[data-e2-status]').innerText()).trim()!=='READING_SOURCE');
    return (await page.locator('[data-e2-status]').innerText()).trim();
  };
  const assertNoRights=async()=>{
    assert.equal(await page.locator('[data-e2-capabilities="all-disabled"]').count(),1);
    assert.equal(await page.locator('[data-owner-actions="disabled"]').count(),1);
    assert.equal(await page.getByRole('button',{name:/grant|withdraw|publish|apply|delete/i}).count(),0);
  };
  const assertSafeLiveDOM=async()=>{
    assert.equal(await page.locator('[data-e2-projection="candidate-only"]').count(),1,
      'PROJECTION_MUST_BE_POPULATED_DURING_DOM_AUDIT');
    const body=await page.locator('body').innerText();
    const dom=await page.content();
    const secretValues=[id.E2_OWNER_EMAIL,id.E2_OWNER_PASSWORD,id.E2_B_PASSWORD,
      id.E2_OWNER_ACCOUNT_ID,id.E2_ORIGINAL_MEDIA_ID,id.E2_ORIGINAL_PHOTO_ID,
      id.E2_OWNER_STORAGE_KEY,id.E2_ORIGINAL_WORK_ID].filter(Boolean);
    for(const secret of secretValues){
      assert.ok(!body.includes(secret),'SENSITIVE_BODY_DATA');
      assert.ok(!dom.includes(secret),'SENSITIVE_DOM_DATA');
    }
    for(const token of ['access_token','refresh_token','Authorization','Bearer ',
      'storageKey','signedUrl','photoMediaId','mediaId','accountId','X-Amz-Signature']){
      assert.ok(!body.includes(token),'SENSITIVE_BODY_FIELD');
      assert.ok(!dom.includes(token),'SENSITIVE_DOM_FIELD');
    }
    assert.ok(!/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(dom),
      'JWT_IN_LIVE_DOM');
    await assertNoRights();
  };

  if(scenario==='DOM_A11Y'){
    await navigate(id.E2_ORIGINAL_WORK_ID);
    // SSR shell is present before afterNavigate has hydrated the Work form.
    await page.locator('#e2-email').waitFor();
    assert.equal(await page.getByLabel('Synthetic email').count(),1);
    assert.equal(await page.getByLabel('Synthetic password').count(),1);
    await page.keyboard.press('Tab');
    await page.locator('#e2-email').focus();
    assert.equal(await page.locator('#e2-email').evaluate(e=>e===document.activeElement),true);
    await signIn('A',true);
    assert.equal(await read(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
    assert.equal((await page.locator('[data-e2-kind]').innerText()).trim(),'OriginalCompetition');
    assert.equal(await page.locator('[data-e2-status]').getAttribute('aria-live'),'polite');
    assert.equal(await page.locator('[data-e2-projection] dd').count(),5);
    assert.ok(actualStatuses.includes(200),'NO_REAL_SIGNED_HTTP200');
    await assertSafeLiveDOM();
  } else if(['IDENTITY','ACCOUNT','CREATOR','PRIVACY'].includes(scenario)){
    await navigate(id.E2_POST_WORK_ID);
    await signIn();
    assert.equal(await read(),'BACKEND_UNAVAILABLE');
    assert.equal(await page.locator('[data-e2-projection]').count(),0);
    assert.ok(actualStatuses.some(n=>[401,403,404].includes(n)),'SERVER_DENIAL_NOT_OBSERVED');
    await assertNoRights();
  } else if(scenario==='CAS'){
    await navigate(id.E2_ORIGINAL_WORK_ID);
    await signIn();
    assert.equal(await read(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
    assert.equal(await page.locator('[data-e2-projection]').count(),1);
    // Give the Python fixture sole control of the actual local DB transition.
    process.stdout.write('WEB_NEG_CAS_READY\n');
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('FIXTURE_MUTATION_TIMEOUT')),30000);
      process.stdin.once('data',()=>{clearTimeout(timer);resolve();});
    });
    const result=await read(); // UI must send preceding view's rowVersion/epoch.
    assert.ok(['REFRESH_REQUIRED','BACKEND_UNAVAILABLE'].includes(result),
      'STALE_CAS_WAS_NOT_REJECTED');
    assert.equal(await page.locator('[data-e2-projection]').count(),0);
    assert.ok(actualStatuses.some(n=>[403,409,412].includes(n)),'CAS_SERVER_DENIAL_NOT_OBSERVED');
    await assertNoRights();
  } else if(scenario==='WITHDRAWN'){
    await navigate(id.E2_ORIGINAL_WORK_ID);
    await signIn();
    assert.equal(await read(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
    assert.ok(actualStatuses.includes(200),'WITHDRAWN_REAL_READ_NOT_HTTP200');
    assert.equal((await page.locator('[data-e2-grant]').innerText()).trim(),'withdrawn');
    assert.equal((await page.locator('[data-e2-public-disabled]').innerText()).trim(),'true');
    await assertNoRights();
    await assertSafeLiveDOM();
  } else if(scenario==='POLICY'){
    await navigate(id.E2_POST_WORK_ID);
    await signIn();
    assert.equal(await read(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
    assert.ok(actualStatuses.includes(200),'INACTIVE_POLICY_REAL_READ_NOT_HTTP200');
    assert.equal((await page.locator('[data-e2-policy]').innerText()).trim(),'UNVERIFIED');
    await assertNoRights();
    const text=await page.locator('body').innerText();
    assert.ok(!text.includes('APPROVED_CANONICAL_RECEIPT'),'UNVERIFIED_PROMOTED');
    await assertSafeLiveDOM();
  } else {
    const work=scenario==='RACE_WORK'?id.E2_ORIGINAL_WORK_ID:id.E2_POST_WORK_ID;
    await navigate(work);
    await signIn();
    assert.equal(await read(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
    let release;
    const gate=new Promise(r=>{release=r;});
    let captured=false,upstreamStatus=null;
    await page.route('**/__source153_e2/functions/v1/community-dreamsnap-owner',async route=>{
      try {
        const response=await route.fetch(); // real Edge: never fabricate a 200/body/headers
        upstreamStatus=response.status();
        captured=true;
        await gate; // deliberately hold genuine HTTP response
        try {await route.fulfill({response});} catch { /* canceled route */ }
      } catch {captured=true;}
    });
    await page.locator('[data-e2-inspect]').click();
    await eventually(async()=>captured);
    assert.equal(upstreamStatus,200,'NO_REAL_DELAYED_SOURCE153_HTTP200');
    if(scenario==='RACE_SESSION'){
      await signIn('B'); // clears in-flight A authority and in-memory projection
    } else {
      const next=scenario==='RACE_WORK'?id.E2_POST_WORK_ID:id.E2_ORIGINAL_WORK_ID;
      await navigate(next); // invalidates generation, token, Work locator
      if(scenario==='RACE_HISTORY'){
        await page.goBack({waitUntil:'domcontentloaded'});
        await page.goForward({waitUntil:'domcontentloaded'});
      }
    }
    release();
    await wait(700);
    assert.equal(await page.locator('[data-e2-projection]').count(),0,
      'OLD_HTTP_RESPONSE_REAPPEARED');
    assert.notEqual((await page.locator('[data-e2-status]').innerText()).trim(),
      'SOURCE153_SCHEMA_CANDIDATE_ONLY','STALE_HTTP_STATUS_REAPPEARED');
    await assertNoRights();
  }
  assert.deepEqual(errors,[],'UNHANDLED_BROWSER_ERROR');
  console.log('WEB_NEGATIVE_SIGNED_BROWSER_'+scenario+'_PASS_LOCAL_ONLY');
  await ctx.close();
} catch(error) {
  // Only this test file's first line number is emitted; no error message,
  // values, HTTP body, credentials, stack, DOM or actor identifiers.
  const stack=String(error?.stack??'');
  const matched=stack.match(/web-source153-signed-owner-negative-chrome\.mjs:(\d+):/);
  console.log('CASELINE '+scenario+' '+(matched?.[1]??'UNKNOWN'));
  throw error;
} finally {await browser.close();}
