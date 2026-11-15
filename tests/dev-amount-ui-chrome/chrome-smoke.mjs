// 08 WEB DEV/OFF local-only Svelte GUI Chrome check, PUBLIC MOCK Worker only.
// The temporary /test-dev-amount-ui route is created exclusively inside CI;
// it is not committed into src/routes and cannot be on protected Pages.
// This checks UI behavior/geometry, NOT PR929 real Rust or real owner P1G.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const port=4187,origin='http://127.0.0.1:'+port;
const profile=await mkdtemp(join(tmpdir(),'wand-dev-amount-chrome-'));
const browserBin=[process.env.WAND_CHROME_BIN,'google-chrome','google-chrome-stable','chromium']
 .filter(Boolean).find(bin=>spawnSync('which',[bin],{stdio:'ignore'}).status===0);
if(!browserBin)throw Error('ENV_WAIT_DEP_GOOGLE_CHROME');
let server,chrome,ws,sequence=0;const pending=new Map(),network=[];
const rpc=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
});
async function attach(){
 const file=join(profile,'DevToolsActivePort');let debugPort=0;
 for(let n=0;n<150;n++){
  if(existsSync(file)){debugPort=Number((await readFile(file,'utf8')).split('\n')[0]);if(debugPort)break}
  await sleep(120);
 }
 if(!debugPort)throw Error('ENV_CHROME_NO_DEBUG_PORT');
 let url;
 for(let n=0;n<100;n++){
  try{const r=await fetch('http://127.0.0.1:'+debugPort+'/json/list');
    url=(await r.json()).find(x=>x.type==='page')?.webSocketDebuggerUrl;if(url)break}catch{}
  await sleep(100);
 }
 if(!url)throw Error('ENV_CHROME_NO_TARGET');
 ws=new WebSocket(url);
 await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});
  ws.addEventListener('error',bad,{once:true})});
 ws.addEventListener('message',e=>{
  let m;try{m=JSON.parse(String(e.data))}catch{return}
  if(m.method==='Network.requestWillBeSent')network.push({method:m.params?.request?.method,
    url:m.params?.request?.url});
  const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
  if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);
 });
}
const script=String.raw`
(async()=>{
 const need=(v,k)=>{if(!v)throw Error('LOCAL_DEV_UI_CHROME_'+k)};
 const wait=async(fn,code,limit=25000)=>{
  const start=Date.now();
  while(Date.now()-start<limit){
   try{const v=fn();if(v)return v}catch{}
   await new Promise(r=>setTimeout(r,40))
  }
  throw Error('LOCAL_DEV_WAIT_'+code+' BODY='+document.body?.textContent?.slice(0,360))
 };
 const detail=await wait(()=>document.querySelector('[data-dev-amount-editor]'),'PANEL');
 const summary=detail.querySelector('[data-dev-amount-summary]');
 need(summary,'SEMANTIC_SUMMARY');
 summary.focus();need(document.activeElement===summary,'KEYBOARD_FOCUS');
 summary.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 detail.open=true;need(window.innerWidth===320,'VIEWPORT');
 await wait(()=>document.querySelector('[data-dev-open]'),'DEV_LOCAL_ENABLED');
 need(!document.querySelector('[data-backup-verified]'),'NO_AUTO_BACKUP');
 need(!document.querySelector('[data-dev-preview]'),'NO_AUTO_CAS');
 const bbox=el=>{const b=el.getBoundingClientRect();
  need(b.left>=-1&&b.right<=innerWidth+1,'PHYSICAL_FIT_'+JSON.stringify(
   {left:b.left,right:b.right,vw:innerWidth,scrollX}));
  need(Math.abs(scrollX)<=1,'NO_PAGE_SCROLLX');
  return {left:b.left,right:b.right,viewport:innerWidth,scrollX}};
 const at100=bbox(summary);
 document.documentElement.style.zoom='2';
 summary.scrollIntoView({block:'center',inline:'nearest'});
 await new Promise(r=>setTimeout(r,80));
 const at200=bbox(summary);bbox(detail.querySelector('.fields'));
 bbox(document.querySelector('#dev-amount-p1g'));bbox(document.querySelector('#dev-amount-sha'));
 const chooser=document.querySelector('#dev-amount-p1g'),data=new DataTransfer();
 data.items.add(new File([new Uint8Array(64)],'synthetic-ci.p1g',
   {type:'application/octet-stream'}));
 chooser.files=data.files;chooser.dispatchEvent(new Event('change',{bubbles:true}));
 const sha=document.querySelector('#dev-amount-sha');
 sha.value='a'.repeat(64);sha.dispatchEvent(new Event('input',{bubbles:true}));
 const ck=document.querySelector('.check input[type=checkbox]');
 ck.checked=true;ck.dispatchEvent(new Event('change',{bubbles:true}));
 const open=await wait(()=>document.querySelector('[data-dev-open]:not([disabled])'),'OPEN_READY');
 need(!document.querySelector('[data-dev-preview]'),'MANUAL_ONLY');
 open.click();
 const backup=await wait(()=>document.querySelector('[data-dev-backup]:not([disabled])'),'BACKUP_READY');
 need(!document.querySelector('[data-backup-verified]'),'BACKUP_NOT_AUTOMATIC');
 backup.click();
 await wait(()=>document.querySelector('[data-backup-verified]'),'BACKUP_VALID');
 const field=await wait(()=>document.querySelector('#dev-amount-target'),'VERIFIED_ONLY');
 need(field.options.length===2,'TRUSTED_TARGETS_ONLY');
 need(field.options[1].textContent.includes('40000001'),'FURNITURE_ZERO_VISIBLE');
 const newAmount=document.querySelector('#dev-amount-new');
 newAmount.value='49';newAmount.dispatchEvent(new Event('input',{bubbles:true}));
 const stage=await wait(()=>document.querySelector('[data-dev-stage]:not([disabled])'),'CAS_READY');
 stage.click();
 await wait(()=>document.querySelector('[data-dev-preview]'),'STAGED');
 need(document.querySelector('[data-dev-preview]').textContent.includes('50'),'OLD_VALUE');
 need(document.querySelector('[data-dev-preview]').textContent.includes('49'),'NEW_VALUE');
 (await wait(()=>document.querySelector('[data-dev-undo]'),'UNDO_READY')).click();
 (await wait(()=>document.querySelector('[data-dev-redo]'),'REDO_READY')).click();
 const exportButton=await wait(()=>document.querySelector('[data-dev-export]'),'EXPORT_READY');
 exportButton.click();
 await wait(()=>document.querySelector('[data-dev-edited-copy]'),'COPY_REOPEN');
 need(document.body.textContent.includes('edited-ci.p1g'),'DIFFERENT_FILENAME');
 const close=await wait(()=>document.querySelector('[data-dev-close]'),'CLOSE_READY');
 close.click();
 await wait(()=>!document.querySelector('[data-dev-edited-copy]'),'CLOSE_REVOKED');
 need(document.activeElement===summary,'FOCUS_RESTORED');
 // Same UI, fresh explicit selection: numeric zero InventoryID is a valid
 // exact Furniture descriptor, not a falsey/missing target.
 chooser.files=data.files;chooser.dispatchEvent(new Event('change',{bubbles:true}));
 sha.value='a'.repeat(64);sha.dispatchEvent(new Event('input',{bubbles:true}));
 ck.checked=true;ck.dispatchEvent(new Event('change',{bubbles:true}));
 (await wait(()=>document.querySelector('[data-dev-open]:not([disabled])'),'ZERO_OPEN_READY')).click();
 (await wait(()=>document.querySelector('[data-dev-backup]:not([disabled])'),'ZERO_BACKUP_READY')).click();
 const second=await wait(()=>document.querySelector('#dev-amount-target'),'ZERO_TARGET');
 second.selectedIndex=1;second.dispatchEvent(new Event('change',{bubbles:true}));
 const amount=document.querySelector('#dev-amount-new');
 amount.value='6';amount.dispatchEvent(new Event('input',{bubbles:true}));
 (await wait(()=>document.querySelector('[data-dev-stage]:not([disabled])'),'ZERO_CAS_READY')).click();
 await wait(()=>document.querySelector('[data-dev-preview]'),'ZERO_STAGED');
 need(document.querySelector('[data-dev-preview]').textContent.includes('7'),'ZERO_OLD');
 need(document.querySelector('[data-dev-preview]').textContent.includes('6'),'ZERO_NEW');
 (await wait(()=>document.querySelector('[data-dev-undo]'),'ZERO_UNDO')).click();
 (await wait(()=>document.querySelector('[data-dev-redo]'),'ZERO_REDO')).click();
 (await wait(()=>document.querySelector('[data-dev-export]'),'ZERO_EXPORT')).click();
 await wait(()=>document.querySelector('[data-dev-edited-copy]'),'ZERO_COPY');
 (await wait(()=>document.querySelector('[data-dev-close]'),'ZERO_CLOSE')).click();
 await wait(()=>!document.querySelector('[data-dev-edited-copy]'),'ZERO_CLOSE_REVOKED');
 document.documentElement.style.zoom='1';
 return {pass:true,at100,at200,backupBeforeStage:true,casUndoRedo:true,
  editedCopySeparate:true,focusRestored:true,productWriter:false,
  syntheticMockWorkerOnly:true,realOwnerPrivateP1g:false};
})()`;
try{
 server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],
  {cwd:root,env:{...process.env,BASE_PATH:''},stdio:'ignore'});
 let served=false;
 for(let n=0;n<180;n++){
  if(server.exitCode!==null)throw Error('DEV_SERVER_EXITED');
  try{const r=await fetch(origin+'/test-dev-amount-ui/');
   if(r.status===200){served=true;break}}catch{}
  await sleep(130);
 }
 if(!served)throw Error('ENV_DEV_SERVER_UNAVAILABLE');
 chrome=spawn(browserBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--remote-allow-origins=*','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await attach();await rpc('Page.enable');await rpc('Runtime.enable');await rpc('Network.enable');
 await rpc('Emulation.setDeviceMetricsOverride',{width:320,height:800,
  deviceScaleFactor:1,mobile:false});
 await rpc('Page.navigate',{url:origin+'/test-dev-amount-ui/'});
 let ready=false;
 for(let n=0;n<150;n++){
  try{const r=await rpc('Runtime.evaluate',{expression:'location.pathname',
     returnByValue:true});if(r.result?.value==='/test-dev-amount-ui/'){ready=true;break}}catch{}
  await sleep(60);
 }
 if(!ready)throw Error('DEV_CHROME_NAVIGATION_FAILED');
 const controller=new AbortController();
 let evaluation;
 try{evaluation=await Promise.race([
  rpc('Runtime.evaluate',{expression:script,returnByValue:true,awaitPromise:true}),
  sleep(110000,undefined,{signal:controller.signal}).then(()=>{throw Error('DEV_CHROME_TIMEOUT')})
 ])}finally{controller.abort()}
 if(evaluation.exceptionDetails)throw Error(
  'DEV_CHROME_EVAL_'+String(evaluation.exceptionDetails.exception?.description||
    evaluation.exceptionDetails.text).slice(0,800));
 const result=evaluation.result?.value;
 assert.equal(result?.pass,true,'DEV_UI_CHROME_PASS');
 assert.equal(result.syntheticMockWorkerOnly,true);
 assert.equal(result.realOwnerPrivateP1g,false);
 assert.ok(network.every(r=>r.method==='GET'),'NO_POST_PUT_UPLOAD');
 console.log('08WEB_DEV_OFF_LOCAL_AMOUNT_UI_REAL_CHROME_MOCK_WORKER_PASS',
  {at100:result.at100,at200:result.at200,manualBackup:true,
   CAS:true,undoRedo:true,localEditedCopy:true,
   productWriter:false,syntheticOnly:true});
}catch(error){
 console.error('08WEB_DEV_UI_CHROME_FAIL',String(error?.stack||error).slice(0,1300));
 process.exitCode=1;
}finally{
 for(const p of pending.values())p.reject(Error('CLOSED'));pending.clear();
 try{ws?.close()}catch{}
 if(chrome){chrome.kill('SIGTERM');await sleep(180);
  if(chrome.exitCode===null)chrome.kill('SIGKILL')}
 if(server){server.kill('SIGTERM');await sleep(180);
  if(server.exitCode===null)server.kill('SIGKILL')}
 await rm(profile,{recursive:true,force:true,maxRetries:3});
}
