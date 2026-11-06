// 04 QR-W independent PR683 real installed Chrome changed-risk only.
// All uploaded buffers are synthetic; none are private original Steam P1G files.
import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import {makeSyntheticP1gProfile} from "../tests/helpers/p1g-fixture.mjs";
import {createHash} from "node:crypto";

const target=(process.env.QR683_E2E_URL||"http://127.0.0.1:4187").replace(/\/$/,"")+"/editor/world/";
if(!process.env.CHROME_BIN)throw Error("QR683_REAL_CHROME_REQUIRED");
const profile={
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:"DeviceType_Switch"}},
 Player:{OpaqueMarker:{safe:"synthetic"}},
 World:{Villages:[{Areas:{"2":{GridIDs:[7],Unlocked:true}}},{OpaqueNew:true}],
  GridCollection:{Grids:{"7":{ID:7,Objects:{"3":{State:{FutureOpaque:true}}}},"8":{ID:8}}}},
 FutureRoot:{mustRemain:"opaque"}
};
const serialized=Buffer.from(makeSyntheticP1gProfile(profile));
const before=createHash("sha256").update(serialized).digest("hex");
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const failures=[],requests=[],checks=[];
let ctx;
async function upload(page,buffer){
 await page.locator('.load-panel input[type="file"]').setInputFiles({
  name:"SYNTHETIC_only.save",mimeType:"application/octet-stream",buffer
 });
}
try{
 ctx=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:"block"});
 const page=await ctx.newPage();
 page.on("pageerror",x=>failures.push(String(x)));
 ctx.on("request",r=>{
  const u=new URL(r.url());
  if(u.origin!==new URL(target).origin||r.method()!=="GET")requests.push(r.method()+" "+u.origin+u.pathname);
 });
 await page.goto(target,{waitUntil:"networkidle"});
 await page.locator('.platform-select select').selectOption("steam-windows");
 assert.equal(await page.locator('.platform-select select').inputValue(),"steam-windows", "Svelte hydration must settle before selecting storage");
 await upload(page,serialized);
 const panel=page.locator("[data-wep-626-readonly]");
 try { await panel.waitFor({state:"visible",timeout:20000}); }
 catch (cause) {
  console.error("QR683_SYNTHETIC_STEAM_WAIT_DIAGNOSTIC",JSON.stringify({
   body:(await page.locator("body").innerText().catch(()=>"<unavailable>")).slice(-2800),
   title:await page.title().catch(()=>"<unavailable>"),
   sourceSelect:await page.locator('.platform-select select').inputValue().catch(()=>"<unavailable>"),
   inputs:await page.locator('.load-panel input[type="file"]').count(),
   panelCount:await panel.count(),
   errors:failures
  }));
  throw cause;
 }
 const limited=page.locator("[data-wep-steam626-limited]");
 await limited.waitFor({state:"visible"});
 assert.match(await limited.innerText(),/structural inspection/i);
 assert.match(await limited.innerText(),/exactBuildKnown=false/);
 assert.match(await limited.innerText(),/productionReadAccepted=false/);
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==="UNKNOWN");
 assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),"UNKNOWN");
 const diag=await panel.innerText();
 assert.match(diag,/UNKNOWN/);
 assert.equal(await page.locator(".area-route-list").count(),0);
 assert.equal(await page.locator(".editor-shell").count(),0);
 assert.equal(await page.locator("[data-wep-verified-export]").count(),0);
 assert.equal(await page.locator("[data-wep-steam626-undo-preview]").count(),1);
 checks.push("MULTI_VILLAGE_GRID_LATER_MISSING_UNKNOWN_NO_ROUTE");
 const zero=structuredClone(profile);
 zero.World.Villages[1].Areas={};
 zero.World.GridCollection.Grids["8"].Objects={};
 const b=Buffer.from(makeSyntheticP1gProfile(zero));
 await upload(page,b);
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==="1");
 assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),"1");
 assert.equal(await page.locator(".editor-shell").count(),0);
 checks.push("PRESENT_EMPTY_GRID_DOES_NOT_MASK_VALID_OTHER_ENTRIES");
 // Side panel remains useful at zoom and through a user-visible settings locale change.
 const overflow=async name=>{
  const w=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(w.scroll<=w.inner+2,name+": "+JSON.stringify(w));
 };
 await overflow("320");
 // Open visible immersive Settings at desktop width first; at 200% zoom the
 // responsive shell can intentionally hide this menu. Do not focus hidden UI.
 await page.setViewportSize({width:1280,height:900});
 const settings=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"] button.immersive-settings');
 assert.equal(await settings.isVisible(),true);
 await settings.focus();
 await page.keyboard.press("Enter");
 const locale=page.locator("#site-locale-mobile");
 await locale.waitFor({state:"visible"});
 await locale.selectOption("ja");
 await page.waitForFunction(()=>document.documentElement.lang==="ja");
 assert.equal(await limited.isVisible(),true);
 assert.equal(await page.locator(".editor-shell").count(),0);
 checks.push("ZOOM_200_KEYBOARD_JAPANESE_NO_CANVAS");
 // Unknown origin cannot inherit previous Steam structural-read certificate.
 await locale.selectOption("en");
 await page.keyboard.press("Escape");
 // Check changed Steam panel at 200% separately from the Settings control.
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom="2";});
 await overflow("200_percent");
 await page.evaluate(()=>{document.documentElement.style.zoom="1";});
 await page.locator('.platform-select select').selectOption("unknown");
 await upload(page,serialized);
 await page.getByText(/Source verification required/).waitFor({timeout:15000});
 assert.equal(await panel.count(),0);
 checks.push("RESELECT_UNKNOWN_SOURCE_REVOKES_PREVIOUS_READ");
 assert.equal(createHash("sha256").update(serialized).digest("hex"),before);
 assert.deepEqual(requests,[]);
 assert.deepEqual(failures,[]);
 checks.push("SYNTHETIC_BYTES_SHA_UNCHANGED_NO_OFFSITE_POST_OR_JS_ERROR");
 for(const x of checks)console.log("QR683_"+x+"_PASS");
 console.log("QR683_BROWSER_SYNTHETIC_SCOPED_PASS",JSON.stringify({checks:checks.length,source:"0de7a828b2aa4104980727a6d77c7277aac3db02",realSteamP1G:"NOT_RUN"}));
}finally{await ctx?.close();await browser.close();}
