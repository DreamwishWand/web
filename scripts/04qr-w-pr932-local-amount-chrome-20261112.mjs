// Independent physical Chrome QA; real Svelte DEV UI + isolated MOCK Worker.
// All bytes are synthetic. No real Rust/Codec or Owner Save access.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,rm,access} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {localAmountCopy,DEV_AMOUNT_UI_LOCALES} from '../src/lib/dev/local-amount-copy.mjs';
const dir='src/routes/test-04qrw-pr932',route=dir+'/+page.svelte';
const port=4193,origin='http://127.0.0.1:'+port;
const workerSource=String.raw`
const kind=k=>({kind:k,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
let phase='closed',backed=false,staged=false;
const targets=[
 {kind:'InventoryExistingAmountDecrease',targetId:4,itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true},
 {kind:'ChestExistingSlotAmountDecrease',targetId:12,itemId:30000002,slotIndex:1,compatibleItemType:null,oldAmount:12,registryVerified:true,sourceVerified:true,rightsAllowed:true}
];
self.onmessage=async({data:m})=>{
 try{
  const a=m.args?.[0];let result;
  if(m.method==='close'){phase='closed';backed=false;staged=false;result=kind('CLOSED')}
  else if(m.method==='open'){
   if(a.file.name!=='qa-synthetic.p1g'||a.file.size!==64||a.originalSha256!=='a'.repeat(64)||a.build.schema!==626||a.build.externallyConfirmed!==true)throw Error('DENIED');
   phase='open';result=kind('OPEN');
  }else if(m.method==='backupOriginal'&&phase==='open'&&!backed){
   backed=true;result={backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true};
  }else if(m.method==='listVerifiedTargets'&&backed){result={targets,rawDocumentExposed:false}}
  else if(m.method==='stageTyped'&&backed&&!staged){
   const c=a[0];if(a.length!==1||!(c.kind===targets[0].kind&&c.inventoryId===4&&c.canonicalItemId===30000001&&c.compatibleItemType==='ItemType_Ingredient'&&c.expectedOldAmount===50&&c.newAmount===49||c.kind===targets[1].kind&&c.containerId===12&&c.slotIndex===1&&c.expectedItemId===30000002&&c.expectedOldAmount===12&&c.newAmount===11))throw Error('DENIED');
   staged=true;phase='stage';result=kind('STAGED');
  }else if(m.method==='undo'&&staged){staged=false;phase='undone';result=kind('UNDONE')}
  else if(m.method==='redo'&&phase==='undone'){staged=true;phase='stage';result=kind('REDONE')}
  else if(m.method==='exportEditedCopy'&&phase==='stage'&&backed){phase='exported';staged=false;result={...kind('EXPORTED'),editedCopyName:'qa-edited.p1g',backupName:'qa-backup.p1g',editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true}}
  else throw Error('DENIED');
  self.postMessage({id:m.id,ok:true,data:result});
 }catch{self.postMessage({id:m.id,ok:false,error:'DENIED'})}
};
`;
const harness='<script>\n'+
 "import {onMount} from 'svelte';\n"+
 "import LocalAmountEditorDev from '$lib/dev/LocalAmountEditorDev.svelte';\n"+
 "import {createLocalAmountDevPort} from '$lib/dev/local-amount-worker-adapter.mjs';\n"+
 "import {setLocale} from '$lib/i18n/runtime.js';\n"+
 "let adapter=null;\n"+
 "onMount(()=>{window.__qaLocale=setLocale;const u=URL.createObjectURL(new Blob(["+JSON.stringify(workerSource)+"],{type:'text/javascript'}));const w=new Worker(u);adapter=createLocalAmountDevPort(w);return()=>{adapter?.dispose();URL.revokeObjectURL(u)}});\n"+
 '</script>\n{#if adapter}<LocalAmountEditorDev verifiedLocalDevGate={true} trustedWorkerAdapter={adapter}/>{/if}\n';
let server,browser,created=false;const issues=[],marks=[];
const check=(v,msg)=>{if(!v){issues.push(msg);console.log('QRW932_CHROME_ANOMALY',msg)}};
try{
 try{await access(route);throw Error('unexpected existing temporary route')}catch(e){if(e.code!=='ENOENT')throw e}
 await mkdir(dir,{recursive:false});created=true;await writeFile(route,harness);
 server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{env:{...process.env,BASE_PATH:''},stdio:'ignore',detached:true});
 for(let i=0;i<240;i++){try{if((await fetch(origin+'/test-04qrw-pr932/')).status===200)break}catch{}if(i===239)throw Error('local Vite did not start');await new Promise(r=>setTimeout(r,200))}
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:320,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await ctx.newPage();const net=[],errors=[];
 page.on('request',r=>net.push({method:r.method(),url:r.url(),body:r.postData()!==null}));
 page.on('pageerror',e=>errors.push(String(e)));
 const r=await page.goto(origin+'/test-04qrw-pr932/',{waitUntil:'networkidle'});assert.equal(r.status(),200);
 const panel=page.locator('[data-dev-amount-editor]'),summary=page.locator('[data-dev-amount-summary]');
 await panel.waitFor();assert.equal(await panel.getAttribute('data-product-writer'),'off');assert.equal(await panel.getAttribute('data-public-route'),'off');assert.equal(await panel.getAttribute('data-cloud'),'off');
 assert.equal(await panel.evaluate(e=>e.open),false);await summary.focus();await summary.press('Enter');assert.equal(await panel.evaluate(e=>e.open),true);
 const open=page.locator('[data-dev-open]'),file=page.locator('#dev-amount-p1g'),sha=page.locator('#dev-amount-sha'),confirm=panel.locator('input[type=checkbox]');
 await open.waitFor();assert.ok(await open.isDisabled());assert.equal(await file.inputValue(),'');
 assert.equal(await page.locator('[data-backup-verified]').count(),0);
 async function geometry(stage){
  await summary.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo({left:10000,top:scrollY,behavior:'instant'}));
  const result=await page.evaluate(({stage})=>{
   const p=document.querySelector('[data-dev-amount-editor]'),root=document.documentElement,b=document.body;
   const bad=[],rects=[];for(const e of p.querySelectorAll('summary,section,.fields,label,input,select,button,.actions,.preview,p,code')){
    if(!e.getClientRects().length)continue;
    const r=e.getBoundingClientRect(),name=e.id||e.dataset.devAmountSummary!==undefined&&'summary'||e.tagName+':'+e.textContent.trim().slice(0,25);
    rects.push({name,left:r.left,right:r.right,width:r.width});
    if(r.width<=0||r.left< -1||r.right>innerWidth+1)bad.push('physical '+name+' '+r.left+'..'+r.right);
    if(e.matches('summary,label,button,p,code')){
     const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let t;
     while((t=walker.nextNode())){if(!t.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(t);
      for(const tr of range.getClientRects())if(tr.width>0&&(tr.left< -1||tr.right>innerWidth+1))bad.push('text '+name+' '+tr.left+'..'+tr.right)}
    }
   }
   if(scrollX!==0||root.scrollWidth>root.clientWidth+1)bad.push('document overflow '+scrollX+' '+root.scrollWidth+'/'+root.clientWidth);
   if(['hidden','clip'].includes(getComputedStyle(root).overflowX)||['hidden','clip'].includes(getComputedStyle(b).overflowX))bad.push('fake root overflow mask');
   for(const e of p.querySelectorAll('input,select'))if(e.getClientRects().length&&!e.labels?.length&&!e.getAttribute('aria-label'))bad.push('unlabelled '+e.id);
   return{stage,viewport:innerWidth,zoom:getComputedStyle(root).zoom,scrollX,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,rects,bad};
  },{stage});
  marks.push(result.stage);console.log('QRW932_CHROME_GEOMETRY',JSON.stringify(result));for(const x of result.bad)check(false,stage+': '+x);
 }
 await geometry('320_ROOT100_INITIAL');await page.evaluate(()=>document.documentElement.style.zoom='2');
 for(const loc of DEV_AMOUNT_UI_LOCALES){await page.evaluate(l=>window.__qaLocale(l),loc);await page.waitForFunction(l=>document.documentElement.dataset.locale===l,loc);
  assert.equal((await summary.textContent()).trim(),localAmountCopy(loc).title);await geometry('320_ROOT200_'+loc)}
 await page.evaluate(()=>window.__qaLocale('en'));
 // Actual keyboard Focus: move between form fields, never simulate click in test.
 await file.focus();await page.keyboard.press('Tab');check(await sha.evaluate(e=>e===document.activeElement),'Tab file to SHA');
 await sha.focus();await page.keyboard.press('Tab');check(await confirm.evaluate(e=>e===document.activeElement),'Tab SHA to confirm');
 for(const [idx,amount,old] of [[0,'49','50'],[1,'11','12']]){
  await file.setInputFiles({name:'qa-synthetic.p1g',mimeType:'application/octet-stream',buffer:Buffer.alloc(64,0x51)});
  await sha.fill('a'.repeat(64));await confirm.check();await open.click();
  const back=page.locator('[data-dev-backup]');await back.waitFor();assert.equal(await page.locator('[data-backup-verified]').count(),0);
  await back.click();await page.locator('[data-backup-verified]').waitFor();
  const target=page.locator('#dev-amount-target'),newAmount=page.locator('#dev-amount-new'),stage=page.locator('[data-dev-stage]');
  assert.equal(await target.locator('option').count(),2);await target.selectOption({index:idx});
  await newAmount.fill('0');assert.ok(await stage.isDisabled());await newAmount.fill(old);assert.ok(await stage.isDisabled());
  await newAmount.fill(amount);await geometry('320_ROOT200_READY_'+idx);await stage.click();
  const preview=page.locator('[data-dev-preview]');await preview.waitFor();assert.ok((await preview.textContent()).includes(old));assert.ok((await preview.textContent()).includes(amount));
  await geometry('320_ROOT200_STAGED_'+idx);
  await page.locator('[data-dev-undo]').click();await page.locator('[data-dev-redo]').waitFor();assert.equal(await page.locator('[data-dev-export]').count(),0);
  await page.locator('[data-dev-redo]').click();await page.locator('[data-dev-export]').waitFor();await page.locator('[data-dev-export]').click();
  await page.locator('[data-dev-edited-copy]').waitFor();assert.ok((await panel.textContent()).includes('qa-edited.p1g'));
  assert.equal(await page.locator('[data-dev-export]').count(),0);await geometry('320_ROOT200_EXPORTED_'+idx);
  await page.locator('[data-dev-close]').click();await open.waitFor();await page.waitForFunction(()=>document.activeElement?.matches('[data-dev-amount-summary]'));
  assert.equal(await page.locator('[data-dev-edited-copy]').count(),0);assert.equal(await page.locator('[data-dev-preview]').count(),0);
 }
 await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>document.documentElement.style.zoom='1');await geometry('1280_ROOT100');
 const unsafe=net.filter(x=>!['GET','HEAD'].includes(x.method)||x.body||!(x.url.startsWith(origin+'/')||x.url.startsWith('blob:'+origin+'/')||x.url.startsWith('data:')));
 console.log('QRW932_REAL_CHROME_MOCK_ONLY',JSON.stringify({checks:marks,unsafe,errors,issues,privateSave:false,realRust:false,productWriter:false}));
 assert.deepEqual(unsafe,[],'no off-origin/upload requests');assert.deepEqual(errors,[],'no browser error');assert.deepEqual(issues,[],'independent physical/A11y checks');
}finally{
 await browser?.close();if(server){try{process.kill(-server.pid,'SIGTERM')}catch{server.kill('SIGTERM')}}
 if(created)await rm(dir,{recursive:true,force:true});
}
