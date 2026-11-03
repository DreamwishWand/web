import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright-core";
import {HELP_LOCAL_COPY} from "../src/lib/community/help-local-copy.js";
const origin=(process.env.WEB_QR339_URL||"http://127.0.0.1:4178").replace(/\/$/,"");
assert.ok(process.env.CHROME_BIN);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const context=await browser.newContext({viewport:{width:320,height:800},locale:"ja-JP",serviceWorkers:"block"});
const page=await context.newPage();
const remote=[],errors=[],cases=[];
page.on("request",r=>{if(/supabase\.co|\/(?:auth|functions|rest|storage)\/v1\/|community-query|community-command|community-media/i.test(r.url()))remote.push({path:new URL(r.url()).pathname,method:r.method()});});
page.on("pageerror",e=>errors.push(String(e)));
const check=(name)=>{cases.push(name);console.log("QR339_"+name+"_PASS");};
const fit=async()=>{const x=await page.evaluate(()=>({a:document.documentElement.clientWidth,b:document.documentElement.scrollWidth}));assert.ok(x.b<=x.a+2,"Unexpected horizontal overflow "+JSON.stringify(x));};
try {
  assert.equal(Object.keys(HELP_LOCAL_COPY).length,8);
  for(const locale of Object.keys(HELP_LOCAL_COPY)){
    const x=HELP_LOCAL_COPY[locale];
    for(const key of ["emptyQuestions","emptyTips","emptyIssues","emptyMy","statusConditional","statusOff","noAutoRequests"])
      assert.ok(x[key]&&x[key].trim(),locale+" missing "+key);
  }
  check("EIGHT_LOCALES_NONEMPTY_OFF_COPY");
  for(const language of ["ja","en"]){
    if(language==="en"){
      // Set the app locale while staying on the last (My Activity) screen,
      // then navigate. Svelte's app-level locale may rehydrate on route load.
      await page.setViewportSize({width:1280,height:800});
      await page.locator("#site-locale").selectOption("en");
      console.log("QR339_EN_PRE_NAV",await page.locator("#site-locale").inputValue(),await page.locator(".help-heading h1").innerText());
    }
    for(const kind of ["questions","tips","issues","my"]){
      await page.setViewportSize({width:1280,height:800});
      await page.goto(origin+"/help/"+kind+"/",{waitUntil:"domcontentloaded"});
      if(language==="ja"){
        await page.locator("#site-locale").selectOption("ja");
        await page.waitForFunction(()=>document.querySelector(".help-heading h1")?.textContent?.trim().length>0);
      }else{
        const expected={questions:"Questions",tips:"Tips",issues:"Issues",my:"My Activity"}[kind];
        console.log("QR339_EN_POST_NAV",kind,await page.locator("#site-locale").inputValue(),await page.locator(".help-heading h1").innerText());
        await page.waitForFunction((title)=>document.querySelector(".help-heading h1")?.textContent?.trim()===title,expected,{timeout:12000});
      }
      await page.setViewportSize({width:320,height:800});
      const p=page.locator('[data-help-child="'+kind+'"][data-help-local-only="true"]');
      assert.equal(await p.count(),1,language+"/"+kind);
      assert.equal(await p.locator('[data-help-empty-state="unverified"]').count(),1);
      assert.equal(await p.locator('[aria-current="page"]').count(),1);
      assert.equal(await p.locator(".help-local-nav li").count(),4);
      const status=(kind==="questions"||kind==="tips")?"CONDITIONAL":"OFF";
      assert.equal(await p.locator('[data-help-status="'+status+'"]').count(),1);
      assert.equal(await p.locator('.help-local-nav [aria-current="page"]').getAttribute("data-help-current"),kind);
      if(status==="OFF"){
        assert.equal(await p.locator('[data-help-no-auth="true"]').count(),1);
        assert.equal(await p.locator('input').count(),0);
        assert.equal(await p.locator('[data-help-existing-conditional]').count(),0);
      }else{
        assert.equal(await p.locator('input[type="search"]:disabled').count(),1);
        assert.equal(await p.locator('[data-help-existing-conditional="true"]').count(),1);
      }
      await fit();
      await p.locator(".help-back").focus();
      assert.equal(await p.locator(".help-back").evaluate(e=>e===document.activeElement),true);
      const css=await p.locator(".help-back").evaluate(e=>getComputedStyle(e).outlineStyle);
      assert.notEqual(css,"none",language+"/"+kind+" focus outline");
    }
    check(language.toUpperCase()+"_FOUR_HELP_NO_DATA_320");
  }
  await page.goto(origin+"/help/issues/",{waitUntil:"domcontentloaded"});
  await page.setViewportSize({width:640,height:980});
  await page.evaluate(()=>document.documentElement.style.zoom="2");
  await fit();
  assert.equal(await page.locator('[data-help-child="issues"] [data-help-no-auth]').count(),1);
  check("ZOOM_200_OFF_NO_ACTIVITY_LEAK");
  assert.deepEqual(remote,[],"Unexpected private/Provider HTTP from Help");
  assert.deepEqual(errors,[],"Unhandled JS exception");
  check("NO_PROVIDER_NO_RUNTIME_ERRORS");
  console.log("QR339_INDEPENDENT_ACTUAL_CHROMIUM_PASS");
}finally{
  await mkdir(".artifacts/qr-pr339",{recursive:true});
  await writeFile(".artifacts/qr-pr339/result.json",JSON.stringify({cases,remote,errors},null,2));
  await browser.close();
}