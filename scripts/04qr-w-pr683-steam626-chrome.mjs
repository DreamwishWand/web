// 04 QR-W independent real Chromium changed-risk Steam626 UI; synthetic bytes only.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {chromium} from "playwright-core";
import {makeSyntheticP1gProfile} from "../tests/helpers/p1g-fixture.mjs";

const base=(process.env.QR683_E2E_URL||"http://127.0.0.1:4208").replace(/\/$/,"");
if(!process.env.CHROME_BIN)throw Error("QR683_CHROME_BIN_REQUIRED");
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const origin=new URL(base).origin;
const profile=()=>({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:"DeviceType_Switch"}},
  Player:{OpaquePlayer:{qaOnly:true}},
  World:{
    Villages:[{Areas:{"1":{GridIDs:[10]}}},{Areas:{"2":{GridIDs:[11]}}}],
    GridCollection:{Grids:{
      "10":{ID:10,Objects:{"99":{Future:true}}},
      "11":{ID:11,Objects:{"100":{Future:true}}}
    }}
  },
  UnknownRoot:{mustRemain:true}
});
const upload=async(page,p)=>page.locator(".load-panel input[type=file]").setInputFiles({
  name:"synthetic-qa-only.save",mimeType:"application/octet-stream",
  buffer:Buffer.from(makeSyntheticP1gProfile(p))
});
const failures=[],pages=[],checks=[];
let context;
try {
  context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:"block"});
  const page=await context.newPage();
  context.on("request",r=>{const u=new URL(r.url());if(u.origin!==origin||r.method()!=="GET")failures.push(r.method()+" "+u.origin+u.pathname)});
  page.on("pageerror",e=>pages.push(String(e)));
  await page.goto(base+"/editor/world/",{waitUntil:"domcontentloaded"});
  await page.locator(".platform-select select").selectOption("steam-windows");
  assert.equal(await page.locator("[data-wep-626-bid]").count(),0);
  assert.equal(await page.locator("[data-wep-626-provenance]").count(),0);
  const source=profile();
  const sourceBytes=Buffer.from(makeSyntheticP1gProfile(source));
  const before=createHash("sha256").update(sourceBytes).digest("hex");
  await upload(page,source);
  const panel=page.locator("[data-wep-steam626-limited]");
  await panel.waitFor({state:"visible",timeout:15000});
  assert.match(await panel.innerText(),/structural inspection|構造診断/i);
  assert.match(await panel.innerText(),/exactBuildKnown=false/);
  assert.match(await panel.innerText(),/productionReadAccepted=false/);
  assert.match(await panel.innerText(),/routesAuthorized=false/);
  const pageText=await page.locator("[data-wep-626-readonly]").innerText();
  assert.match(pageText,/Undo\/Redo/);
  for(const denied of [".editor-shell","[data-wep-verified-export]",".area-route-list",".toolbar-actions"]){
    assert.equal(await page.locator(denied).count(),0,denied);
  }
  assert.equal(await page.locator("[data-wep-626-gridobject-entries] dd").innerText(),"2");
  checks.push("STEAM626_TWO_GRIDS_READONLY_NO_CANVAS_EXPORT");
  const missing=profile();delete missing.World.Villages[1].Areas;delete missing.World.GridCollection.Grids["11"].Objects;
  await upload(page,missing);await panel.waitFor({state:"visible"});
  const unknown=await page.locator("[data-wep-626-readonly]").innerText();
  assert.match(unknown,/UNKNOWN/);
  assert.equal((await page.locator("[data-wep-626-gridobject-entries] dd").innerText()).trim(),"UNKNOWN");
  checks.push("SECOND_VILLAGE_GRID_MISSING_UNKNOWN");
  const empty=profile();empty.World.Villages[1].Areas={};empty.World.GridCollection.Grids["11"].Objects={};
  await upload(page,empty);await panel.waitFor({state:"visible"});
  assert.equal((await page.locator("[data-wep-626-gridobject-entries] dd").innerText()).trim(),"1");
  checks.push("SECOND_GRID_EXPLICIT_EMPTY_COUNTS_ONE");
  const settings=page.locator("[data-shared-app-shell][data-shell-presentation=immersive] button.immersive-settings");
  await settings.focus();await page.keyboard.press("Enter");
  const select=page.locator("#site-locale-mobile");
  await select.waitFor({state:"visible"});
  for(const lang of ["en","fr","it","de","es-ES","ja","zh-CN","pt-BR"]){
    await select.selectOption(lang);
    await page.waitForFunction(x=>document.documentElement.lang===x,lang);
    assert.equal(await panel.isVisible(),true,lang);
    assert.equal(await page.locator(".editor-shell").count(),0,lang);
  }
  await select.selectOption("en");await page.keyboard.press("Escape");
  checks.push("EIGHT_LOCALES_VISIBLE_SETTINGS_KEYBOARD");
  await page.setViewportSize({width:320,height:750});
  const small=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  assert.ok(small.w<=small.v+2,"320 overflow "+JSON.stringify(small));
  await page.setViewportSize({width:640,height:900});
  await page.evaluate(()=>{document.documentElement.style.zoom="2"});
  const zoom=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  assert.ok(zoom.w<=zoom.v+2,"200% overflow "+JSON.stringify(zoom));
  await page.evaluate(()=>{document.documentElement.style.zoom="1"});
  checks.push("320_AND_200_PERCENT_NO_OVERFLOW");
  await page.locator(".platform-select select").selectOption("switch");
  await page.locator("[data-wep-626-bid] input").fill("9A239D3DB569756D");
  // No checked Switch provenance. Steam selection MUST NOT lend prior rights.
  await upload(page,source);
  assert.equal(await page.locator("[data-wep-626-readonly]").count(),0);
  checks.push("STEAM_TO_SWITCH_NO_PROVENANCE_BORROW");
  assert.equal(createHash("sha256").update(sourceBytes).digest("hex"),before);
  assert.deepEqual(failures,[],"no off-origin fetch or POST");
  assert.deepEqual(pages,[],"no JavaScript page exceptions");
  checks.push("SOURCE_SHA_UNCHANGED_NO_EXTERNAL_NETWORK");
  for(const result of checks)console.log("QR683_"+result+"_PASS");
  console.log("QR683_BROWSER_SUMMARY",JSON.stringify({checks:checks.length,source:"0de7a828b2aa4104980727a6d77c7277aac3db02",fixture:"SYNTHETIC_ONLY",privateSteam:"NOT_RUN",publicHosted:"NOT_RUN",writer:"OFF"}));
} finally {
  await context?.close();await browser.close();
}