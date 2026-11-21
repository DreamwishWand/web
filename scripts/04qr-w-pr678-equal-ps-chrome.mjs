// 04 QR-W PR678 independent real Chrome: equal P=S syntax-only, no public grant.
// Vite dev HTTP200 is NOT public Pages 200/301. No Save/media/provider.
import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import {access} from "node:fs/promises";
import {join} from "node:path";
import {sharedTypedCopy} from "../src/lib/foundation/shared-typed-entity-copy.mjs";

const bin=process.env.CHROME_BIN;
if(!bin)throw Error("QR678_CHROME_BIN_REQUIRED");
const base=(process.env.QR678_E2E_URL||"http://127.0.0.1:4203").replace(/\/$/,"");
const browser=await chromium.launch({executablePath:bin,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
let ctx;
const requests=[],errors=[],tests=[];
try{
 ctx=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:"block"});
 const page=await ctx.newPage();
 ctx.on("request",r=>{
  const u=new URL(r.url());
  if(u.origin!==base||r.method()!=="GET")requests.push(r.method()+" "+u.origin+u.pathname);
 });
 page.on("pageerror",e=>errors.push(String(e)));
 const locales=["en","fr","it","de","es-ES","ja","zh-CN","pt-BR"];
 for(const lang of locales){
  const resp=await page.goto(base+"/"+lang+"/40000047/40000047/",{waitUntil:"domcontentloaded"});
  assert.equal(resp?.status(),200,"LOCAL Vite SSR fixture only "+lang);
  const card=page.locator('[data-typed-entity-gate="closed"]');
  await card.waitFor({timeout:15000});
  assert.equal(await card.getAttribute("lang"),lang);
  assert.equal(await page.locator('[data-shared-card="identity"] code').innerText(),"40000047/40000047");
  const explanation=await page.locator("[data-typed-unavailable]").innerText();
  assert.ok(explanation.includes(sharedTypedCopy(lang).notVerified),lang+" is SOURCE_UNVERIFIED");
  assert.equal(explanation.includes(sharedTypedCopy(lang).invalid),false,lang+" is not malformed syntax");
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex,nofollow");
  assert.equal(await page.locator('link[rel="canonical"]').count(),0);
  assert.equal(await page.locator('meta[http-equiv="refresh"]').count(),0);
  assert.equal(await page.locator('[data-public-indexable="false"][data-provider="off"][data-writer="off"]').count(),1);
  assert.equal(await page.locator('[data-relations-verified="false"][data-alias-resolved="false"][data-personal-state="unknown"]').count(),1);
  assert.equal(await page.locator('img').count(),0);
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(width.scroll<=width.client+2,lang+" 320px overflow "+JSON.stringify(width));
 }
 tests.push("EIGHT_LOCALE_EQUAL_PS_UNVERIFIED_NOINDEX_320_PASS");
 await page.goto(base+"/ja/40000047/40000047/",{waitUntil:"domcontentloaded"});
 const nav=page.locator('[data-typed-entity-gate] nav a');
 await nav.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),"A");
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom="2";});
 const zoom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 assert.ok(zoom.scroll<=zoom.client+2,"P=S 200% overflow "+JSON.stringify(zoom));
 tests.push("KEYBOARD_200_ZOOM_PASS");
 for(const bad of [
  "/en/0001/0001/","/en/0/0/","/en/40000047/0001/",
  "/en/9007199254740992/9007199254740992/"
 ]){
  const resp=await page.goto(base+bad,{waitUntil:"domcontentloaded"});
  assert.equal(resp?.status(),404,bad+" must be rejected by sharedId route");
  assert.equal(await page.locator('[data-typed-entity-gate]').count(),0);
 }
 tests.push("FORGED_INVALID_PS_TRUE_DEV_HTTP404_PASS");
 await page.goto(base+"/en/entity/entry/40000047/",{waitUntil:"domcontentloaded"});
 await page.locator('[data-typed-unavailable]').waitFor();
 assert.ok((await page.locator('[data-typed-unavailable]').innerText()).includes(sharedTypedCopy("en").invalid));
 assert.equal(await page.locator('[data-public-indexable="false"]').count(),1);
 tests.push("UNKNOWN_KIND_NOT_PUBLIC_PASS");
 await access(join("build","404.html"));
 for(const path of [
  join("build","ja","40000047","40000047","index.html"),
  join("build","en","40000047","40000047","index.html")
 ]){
  try{await access(path);throw Error("QR678_UNVERIFIED_TYPED_P_S_PRERENDERED_"+path);}
  catch(e){if(e.code!=="ENOENT")throw e;}
 }
 tests.push("STATIC_BUILD_NO_FALSE_PUBLIC_TYPED_200_PASS");
 assert.deepEqual(requests,[],"never POST or contact outside origin/Provider/Cloud");
 assert.deepEqual(errors,[],"no uncaught JS runtime exceptions");
 tests.push("NO_EXTERNAL_REQUEST_NO_JS_ERROR_PASS");
 for(const t of tests)console.log("QR678_"+t);
 console.log("QR678_BROWSER_SUMMARY",JSON.stringify({passed:tests.length,source:"58ff476c150ea66cd91f51061a0e72ece63714d4",realPublicHost:"NOT_RUN",privateSave:"NOT_RUN"}));
} finally {await ctx?.close();await browser.close();}
