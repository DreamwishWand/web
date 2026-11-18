import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

assert.ok(process.env.CHROME_BIN,'Installed Chrome is required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const width of [1366,320]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  try {
   await page.goto('http://127.0.0.1:4298/web/editor/?writerAuthorized=true&beta=all',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('[data-beta-editor-availability]').waitFor({state:'visible'});
   const cards=page.locator('[data-beta-save-operations] [data-beta-operation]');
   assert.equal(await cards.count(),8);
   const ids=await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-beta-operation')));
   assert.equal(new Set(ids).size,8);
   for(let i=0;i<await cards.count();i++){
    const card=cards.nth(i);
    assert.equal(await card.getAttribute('data-beta-state'),'pending');
    assert.equal(await card.getAttribute('data-beta-writer-authorized'),'false');
    assert.equal(await card.getAttribute('aria-disabled'),'true');
    assert.equal(await card.locator('a,button,input,select,[role=button]').count(),0,'disabled tile must not contain action');
    const display=await card.evaluate(el=>({opacity:Number(getComputedStyle(el).opacity),cursor:getComputedStyle(el).cursor}));
    assert.ok(display.opacity<1,'pending tile must be visibly muted');
    assert.equal(display.cursor,'not-allowed');
   }
   const available=page.locator('[data-beta-capability]');
   const states=await available.evaluateAll(nodes=>nodes.map(el=>({state:el.dataset.betaState,writer:el.dataset.betaSaveAuthorized,href:el.getAttribute('href')})));
   assert.ok(states.length>=5,'five independent preexisting public routes');
   assert.ok(states.some(x=>x.state==='local'&&x.href?.endsWith('/moodboards/')));
   assert.ok(states.some(x=>x.state==='local'&&x.href?.endsWith('/editor/world/')));
   assert.ok(states.some(x=>x.state==='read'&&x.href?.endsWith('/editor/items/')));
   assert.ok(states.some(x=>x.state==='read'&&x.href?.endsWith('/editor/timing/')));
   assert.ok(states.some(x=>x.state==='test'&&x.href?.endsWith('/editor/steam-reader/')));
   assert.ok(states.every(x=>x.writer==='false'));
   assert.equal(await page.locator('[data-editor-writer-boundary]').count(),1);
   await page.evaluate(()=>localStorage.setItem('wand:editor:beta:override',JSON.stringify({writerAuthorized:true,operations:['inventory-quantity']})));
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-beta-save-operations] [data-beta-operation][data-beta-state=pending]').count(),8,'query and localStorage cannot forge release');
   assert.equal(await page.locator('[data-beta-save-operations] a,[data-beta-save-operations] button').count(),0);
   assert.ok(await page.locator('[data-editor-moodboards][href$="/moodboards/"]').isVisible());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no mobile horizontal overflow');
   console.log('08WEB_PROGRESSIVE_BETA_EDITOR_FAILCLOSED_TILES_8_LOCAL_READ_TEST_PASS_'+width);
  }finally{await page.close();await ctx.close()}
 }
 assert.deepEqual(errors,[]);
 console.log('08WEB_PROGRESSIVE_BETA_LOCAL_QUERY_CANNOT_ENABLE_WRITER_2VIEWPORT_PASS');
}finally{await browser.close()}
