// 04 QR-W independent installed Chrome new-only PR726 / Community Lab root.
// Only unauthenticated localhost Svelte dev, never managed Provider, real Account or Cloud.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const chrome=process.env.CHROME_BIN;
if(!chrome)throw Error('QR726_LOCAL_CHROME_BIN_REQUIRED');
const origin=(process.env.QR726_URL??'http://127.0.0.1:4296').replace(/\/$/,'');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const errors=[],externalOrWrites=[],websockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>websockets.push(w.url()));
context.on('request',req=>{
 const target=new URL(req.url());
 if(req.method()!=='GET'||target.origin!==origin)externalOrWrites.push(req.method()+' '+req.url());
});
const assertRobots=async(label)=>{
 const values=await page.locator('head meta[name="robots"]').evaluateAll(tags=>tags.map(x=>x.getAttribute('content')));
 assert.deepEqual(values,['noindex,nofollow'],label+' must have one correct robots meta');
};
const visit=async path=>{
 const r=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(r?.status(),200,'local HTTP route '+path);
 await assertRobots(path);
};
const fit=async label=>{
 const x=await page.evaluate(()=>({visible:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.visible+2,label+' no horizontal overflow '+JSON.stringify(x));
};
try{
 await visit('/community-lab/');
 await page.getByRole('heading',{level:1,name:'Community Lab'}).waitFor({timeout:15000});
 assert.equal(await page.getByRole('link',{name:'Profile Workspace acceptance'}).count(),1);
 assert.equal(await page.getByRole('link',{name:'Account deletion acceptance'}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isDisabled(),true,'no auto sign-in');
 assert.equal(await page.locator('img.lab-preview').count(),0,'no unauthorized staging media');
 console.log('QR726_CHROME_ROOT_ANON_NOINDEX_NO_AUTOSIGNIN_OR_MEDIA_PASS');

 // A URL query must not remove robots, create a privileged session or disclose a result.
 await visit('/community-lab/?work=guessed-private-work&account=guessed-private-account');
 await page.getByRole('heading',{level:1,name:'Community Lab'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isDisabled(),true);
 assert.equal(await page.locator('img.lab-preview').count(),0);
 console.log('QR726_CHROME_GUESSED_PRIVATE_QUERY_REMAINS_NOINDEX_AND_ANON_PASS');

 for(const lang of locales){
   await page.locator('#site-locale').selectOption(lang);
   await page.locator('html[data-locale="'+lang+'"]').waitFor({timeout:15000});
   await assertRobots(lang);
   assert.equal(await page.getByRole('heading',{level:1,name:'Community Lab'}).count(),1);
   assert.equal(await page.getByRole('link',{name:'Profile Workspace acceptance'}).count(),1);
   assert.equal(await page.getByRole('link',{name:'Account deletion acceptance'}).count(),1);
 }
 console.log('QR726_CHROME_EIGHT_LOCALES_ONE_ROBOTS_META_AND_LINKS_PASS');

 await page.setViewportSize({width:320,height:780});
 await fit('root 320');
 await page.getByRole('link',{name:'Profile Workspace acceptance'}).focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'profiles/');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/community-lab\/profiles\/$/);
 await assertRobots('keyboard profiles');
 await fit('profiles 320');
 await page.goto(origin+'/community-lab/',{waitUntil:'domcontentloaded'});
 await assertRobots('return root');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await fit('root 200%');
 await assertRobots('200%');
 await page.evaluate(()=>{document.documentElement.style.zoom='1'});
 console.log('QR726_CHROME_KEYBOARD_PROFILE_ROUTE_320_AND_200_PASS');

 for(const path of ['/community-lab/account/','/community-lab/profiles/','/community-lab/recovery/','/community-ops/']){
   await visit(path);
 }
 // Unknown extension/child routes are not given public positive results by this metadata change.
 await visit('/community-lab/');
 assert.equal(await page.locator('head meta[name="robots"]').count(),1);
 assert.deepEqual(externalOrWrites,[],'no off-origin / POST / Provider calls on fresh anonymous sessions');
 assert.deepEqual(websockets.filter(url=>!/^ws:\/\/127\.0\.0\.1:4296\/\?token=[A-Za-z0-9_-]+$/.test(url)),[],'no outside WebSocket besides Vite HMR');
 assert.deepEqual(errors,[],'no unhandled browser exceptions');
 console.log('QR726_CHROME_CHILD_OPS_NOINDEX_PUBLIC_HTML_PRESERVED_NO_PROVIDER_POST_PASS');
}finally{await context.close();await browser.close();}
console.log('QR726_INDEPENDENT_INSTALLED_LOCAL_CHROME_PASS');