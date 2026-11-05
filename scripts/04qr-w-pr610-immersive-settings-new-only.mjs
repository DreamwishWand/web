// 04 QR-W new-only independent test of PR610 immersive Editor Settings keyboard locale fix.
// QA-only, fixed source HEAD; no genuine Owner P1G, native Writer, image upload or auth.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const SOURCE='0d2b3f6dfde627f780d7b8f1d49e0669e2dc1b2e';
const SOURCE_FILE='scripts/wep-decorate-stage1-browser-acceptance.mjs';
const BLOB='405e5d236038efa0004e5be870c334db09fd896d';
const QA=[
  'scripts/04qr-w-pr610-immersive-settings-new-only.mjs',
  '.github/workflows/04qr-w-pr610-immersive-settings-new-only.yml'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'Source MUST be based on fixed protected main');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'QA must not alter Source');
assert.deepEqual(git('diff','--name-only',MAIN,SOURCE).split('\n'),[SOURCE_FILE]);
assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),QA);
assert.equal(git('rev-parse',SOURCE+':'+SOURCE_FILE),BLOB,'only original WEP tested Source SHA');
const changed=git('diff','--unified=0',MAIN,SOURCE,'--',SOURCE_FILE);
assert.match(changed,/immersive-settings-keyboard/);
assert.match(changed,/state:'hidden'/);
assert.match(changed,/mobile Explore 320px/);
assert.doesNotMatch(changed,/\+\s*.*(?:\.click\(\{force:true\}|localStorage\.setItem|page\.evaluate.*setLocale)/);
console.log('QR610_SOURCE_ONE_BLOB_QA_TWO_NO_FORCE_SOURCE_LOCK_PASS');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
  assert.ok(!process.env[k],'private original must never enter CI');
assert.ok(process.env.CHROME_BIN,'NOT_RUN installed system Chrome required');
const origin='http://127.0.0.1:4179';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:820},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(),denied=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN routeWebSocket required');
await page.routeWebSocket('**/*',r=>{r.close();}); // dev-server HMR transport never needed by QA
await page.route('**/*',r=>{
 const req=r.request(),url=new URL(req.url());
 if(url.origin===origin&&['GET','HEAD'].includes(req.method()))r.continue();
 else {denied.push(req.method()+' '+req.url());r.abort('blockedbyclient');}
});
const noOverflow=async label=>{
 const s=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(s.scroll<=s.client+2,label+' '+JSON.stringify(s));
};
try{
 const resp=await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(resp?.status(),200);
 const header=page.locator('header[data-shared-app-shell][data-shell-presentation="immersive"]');
 await header.waitFor({state:'visible',timeout:20000});
 assert.equal(await page.locator('#site-locale').isVisible(),false,'desktop language selector hidden in immersive');
 const settings=header.locator('button.immersive-settings');
 assert.equal(await settings.isVisible(),true,'recovery Settings visible');
 await settings.focus();
 await page.keyboard.press('Enter');
 const language=page.locator('#site-locale-mobile');
 await language.waitFor({state:'visible'});
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const loc of locales){
  await language.selectOption(loc);
  await page.waitForFunction(l=>document.documentElement.lang===l,loc,{timeout:15000});
  assert.equal(await language.inputValue(),loc);
  assert.equal(await page.locator('#site-locale').isVisible(),false);
  assert.equal(await header.getAttribute('data-shell-presentation'),'immersive');
 }
 await language.selectOption('en');
 await page.keyboard.press('Escape');
 await language.waitFor({state:'hidden',timeout:15000});
 assert.equal(await settings.isVisible(),true,'escape preserves recovery');
 await settings.focus();
 await page.keyboard.press('Enter');
 await language.waitFor({state:'visible'});
 await page.keyboard.press('Escape');
 await language.waitFor({state:'hidden'});
 console.log('QR610_INDEPENDENT_EDITOR_VISIBLE_SETTINGS_KEYBOARD_8LOCALE_ESC_REOPEN_PASS');

 await page.setViewportSize({width:320,height:780});
 await noOverflow('immersive Editor at 320');
 await settings.focus();
 await page.keyboard.press('Enter');
 await language.waitFor({state:'visible'});
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await noOverflow('immersive Editor 200pct');
 await page.keyboard.press('Escape');
 await language.waitFor({state:'hidden'});
 await page.evaluate(()=>{document.documentElement.style.zoom=''});
 console.log('QR610_INDEPENDENT_EDITOR_320_200_SETTINGS_VISIBLE_PASS');
 const exp=await page.goto(origin+'/explore/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(exp?.status(),200);
 await page.setViewportSize({width:320,height:780});
 assert.equal(await page.locator('.explore-page .actions a[href$="/editor/world/"]').count(),0,
   'mobile handoff prohibited in Explore action area; shell navigation not handoff');
 await noOverflow('Explore 320');
 assert.deepEqual(errors,[],'no JS exceptions');
 assert.deepEqual(denied,[],'no off-origin requests nor POST/WebSocket media/Save mutation');
 console.log('QR610_INDEPENDENT_MOBILE_EXPLORE_HANDOFF_NO_OFFSITE_WRITER_PASS');
}finally{
 await context.close();
 await browser.close();
}
