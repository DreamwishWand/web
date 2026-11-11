// 08 WEB R22 public-SYNTHETIC only: REAL installed Chrome, REAL Vite/Svelte
// build, REAL pinned public JS+WASM and accepted Rust Worker; no private Save.
// CI temporarily opts in a test-only Worker and synthetic attestation BEFORE
// build, never commits the opt-in or publishes this candidate Pages artifact.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const base='/web';
const csp="default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'";
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
  '.wasm':'application/wasm','.json':'application/json','.css':'text/css',
  '.p1g':'application/octet-stream','.svg':'image/svg+xml','.png':'image/png',
  '.woff2':'font/woff2'};
const profile=await mkdtemp(join(tmpdir(),'wand-08web-real-chrome-'));
let chrome,ws,server;
const binary=[process.env.WAND_CHROME_BIN,'google-chrome','google-chrome-stable','chromium'].filter(Boolean)
 .find(bin=>spawnSync('which',[bin],{stdio:'ignore'}).status===0);
if(!binary)throw Error('ENV_WAIT_DEP_CHROME_NOT_INSTALLED');
let seq=0;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++seq;pending.set(id,{resolve,reject});
 ws.send(JSON.stringify({id,method,params}));
});
function serve(req,res){
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}
 catch{res.writeHead(400);res.end();return}
 if(!pathname.startsWith(base+'/')||pathname.includes('..')||pathname.includes('\\')){
  res.writeHead(403);res.end();return;
 }
 const suffix=pathname.slice(base.length);
 const isSynthetic=['/__synthetic__/synthetic626-diffgrids.p1g',
  '/__synthetic__/expected-diffgrids.json'].includes(suffix);
 const source=isSynthetic?join(root,'tests/stage-f/fixtures/',suffix.split('/').at(-1)):
   join(root,'build',suffix.endsWith('/')?suffix+'index.html':suffix);
 if(!resolve(source).startsWith(root+'/')||(!isSynthetic&&suffix.startsWith('/__synthetic__/'))){
  res.writeHead(403);res.end();return;
 }
 readFile(source).then(data=>{
   res.writeHead(200,{'content-type':mime[extname(source)]||'application/octet-stream',
    'cache-control':'no-store','x-content-type-options':'nosniff',
    'content-security-policy':csp});
   res.end(data);
 }).catch(()=>{res.writeHead(404);res.end()});
}
async function attach(){
 const file=join(profile,'DevToolsActivePort');
 let port;
 for(let i=0;i<240;i++){
  if(existsSync(file)){port=Number((await readFile(file,'utf8')).split('\n')[0]);if(port)break;}
  await delay(125);
 }
 if(!port)throw Error('ENV_CHROME_DEBUG_PORT_UNAVAILABLE');
 let url;
 for(let i=0;i<160;i++){
  try{const r=await fetch('http://127.0.0.1:'+port+'/json/list');
    url=(await r.json()).find(x=>x.type==='page')?.webSocketDebuggerUrl;if(url)break}
  catch{}await delay(125);
 }
 if(!url)throw Error('ENV_CHROME_TARGET_UNAVAILABLE');
 ws=new WebSocket(url);
 await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});
   ws.addEventListener('error',bad,{once:true})});
 ws.addEventListener('message',e=>{
  let r;try{r=JSON.parse(String(e.data))}catch{return}
  const p=pending.get(r.id);
  if(!p)return;pending.delete(r.id);
  if(r.error)p.reject(Error(JSON.stringify(r.error)));else p.resolve(r.result);
 });
}
const script=String.raw`
(async()=>{
 const need=(v,k)=>{if(!v)throw Error('08WEB_CHROME_'+k)};
 const wait=async(check,code,timeout=90000)=>{
  const start=Date.now();
  while(Date.now()-start<timeout){
   try{const v=check();if(v)return v}catch{}
   await new Promise(r=>setTimeout(r,50))
  }
  throw Error('08WEB_WAIT_'+code+' URL='+location.href+' TITLE='+document.title+
   ' BODY='+document.body?.textContent?.slice(0,600)+
   ' BODY_HTML='+document.body?.innerHTML?.slice(0,300)+
   ' SCRIPT_COUNT='+document.scripts.length)
 };
 const panel=await wait(()=>document.querySelector('[data-steam-diffgrids-readonly]'),'PANEL',18000);
 panel.open=true;
 const input=await wait(()=>document.querySelector('#steam-diffgrids-file'),'FILE');
 // Initial state: no implicit local Save read / no session.
 need(!document.querySelector('[data-diffgrids-count]'),'NO_AUTO_SAVE');
 await wait(()=>input.disabled===false,'RUST_SIGNED_PINNED_WORKER_READY');
 const response=await Promise.all([
  fetch('/web/__synthetic__/synthetic626-diffgrids.p1g',{cache:'no-store'}),
  fetch('/web/__synthetic__/expected-diffgrids.json',{cache:'no-store'})
 ]);
 need(response.every(x=>x.ok),'SYNTHETIC_ONLY_FIXTURE');
 const expected=await response[1].json(),file=new File(
  [await response[0].arrayBuffer()],'synthetic-ci-only.p1g',
  {type:'application/octet-stream'});
 need(expected.syntheticOnly===true&&file.size===expected.sourceBytes,'P1G_SOURCE_SIZE');
 const dt=new DataTransfer();dt.items.add(file);
 input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 const sha=document.querySelector('#steam-diffgrids-sha');
 sha.value=expected.originalSha256;sha.dispatchEvent(new Event('input',{bubbles:true}));
 const check=document.querySelector('.diffgrids-readonly input[type=checkbox]');
 check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
 const open=await wait(()=>document.querySelector('[data-diffgrids-open]:not([disabled])'),'MANUAL_OPEN');
 need(!document.querySelector('[data-diffgrids-count]'),'NO_READ_BEFORE_CLICK');
 open.click();
 const pages=[];
 for(let page=1;page<=3;page++){
  const result=await wait(()=>document.querySelector('[data-diffgrids-page="'+page+'"]'),'PAGE_'+page);
  need(result.getAttribute('data-diffgrids-count')==='17','TOTAL_17');
  const tr=result.querySelectorAll('tbody tr');
  pages.push(tr.length);
  need(tr.length===(page===3?1:8),'PAGE_BOUNDS_'+page);
  need([...tr].every(row=>row.cells.length===5),'ONLY_ALLOWED_UI_METADATA');
  need([...tr].every(row=>row.cells[4].textContent.trim().length>0),'EXTERNAL_LAYOUT_STATUS');
  if(page===1){
   need(tr[0].cells[0].textContent.trim()==='0','GRIDID0_LITERAL_ONLY');
   need(tr[0].cells[1].textContent.trim()==='2','MODIFIED_COUNT');
   need(tr[0].cells[2].textContent.trim()==='2','REMOVED_COUNT');
   need(tr[0].cells[3].textContent.trim()==='1','OVERLAP_COUNT');
  }
  if(page<3){
   const next=await wait(()=>document.querySelector('[data-diffgrids-next]:not([disabled])'),'NEXT');
   next.click();
  }
 }
 need(pages.join(',')==='8,8,1','THREE_PAGES');
 const whole=document.querySelector('[data-steam-diffgrids-readonly]').textContent;
 for(const prohibited of ['OPAQUE_SYNTHETIC_NEVER_TO_UI','PRIVATE_SYNTHETIC_PATH_NEVER_TO_UI',
  'PRIVATE_SYNTHETIC_OBJECT_NEVER_TO_UI','decodedSha256','sessionId','nextCursor']){
  need(!whole.includes(prohibited),'NO_PRIVATE_'+prohibited);
 }
 const close=document.querySelector('[data-diffgrids-close]');
 close.click();await wait(()=>!document.querySelector('[data-diffgrids-count]'),'CLOSE');
 need(document.activeElement?.matches?.('[data-diffgrids-open]'),'FOCUS_RESTORED');
 need(!document.querySelector('[data-diffgrids-next]'),'NO_STALE_PAGE_AFTER_CLOSE');
 return {result:'08WEB_REAL_SIGNED_PUBLIC_RUST_WASM_CHROME_TYPED_CONSUMER_PASS',
  pages:pages.join(','),gridIdZeroLiteral:true,manualClickOnly:true,
  sameRustWorker:true,strictUiMetadata:true,closed:true,focusRestored:true,
  realPrivateSave:false,writerAuthorized:false,productEnabled:false};
})()
`;
try{
 server=createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--remote-allow-origins=*','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await attach();await rpc('Page.enable');await rpc('Runtime.enable');
 await rpc('Page.navigate',{url:'http://127.0.0.1:'+port+'/web/editor/timing/'});
 for(let n=0;n<200;n++){
  try{const r=await rpc('Runtime.evaluate',{expression:'location.pathname',returnByValue:true});
    if(r.result?.value==='/web/editor/timing/')break}catch{}
  await delay(40);
 }
 const watchdog=new AbortController();
 let outcome;
 try{outcome=await Promise.race([
  rpc('Runtime.evaluate',{expression:script,awaitPromise:true,returnByValue:true}),
  delay(160000,undefined,{signal:watchdog.signal})
    .then(()=>{throw Error('08WEB_REAL_CHROME_TIMEOUT')})
 ])}finally{watchdog.abort()}
 if(outcome.exceptionDetails)throw Error(String(outcome.exceptionDetails.exception?.description||
   outcome.exceptionDetails.text).slice(0,1000));
 const result=outcome.result?.value;
 assert.equal(result?.result,'08WEB_REAL_SIGNED_PUBLIC_RUST_WASM_CHROME_TYPED_CONSUMER_PASS');
 for(const k of ['manualClickOnly','sameRustWorker','strictUiMetadata',
   'closed','focusRestored','gridIdZeroLiteral'])assert.equal(result[k],true,k);
 assert.equal(result.pages,'8,8,1');
 for(const k of ['realPrivateSave','writerAuthorized','productEnabled'])
  assert.equal(result[k],false,k);
 console.log('08WEB_REAL_SIGNED_PUBLIC_RUST_WASM_CHROME_TYPED_CONSUMER_PASS',
  {pages:result.pages,signedPublicAssetBytes:true,privateSave:false,
    consumerProductOwnerFlag:false});
}catch(e){console.error('08WEB_REAL_CHROME_FAIL',String(e?.stack||e).slice(0,1800));process.exitCode=1}
finally{
 for(const p of pending.values())p.reject(Error('CDP_CLOSED'));pending.clear();
 try{ws?.close()}catch{}
 if(chrome){chrome.kill('SIGTERM');await delay(250);
   if(chrome.exitCode===null)chrome.kill('SIGKILL')}
 if(server)await new Promise(r=>server.close(r));
 await rm(profile,{recursive:true,force:true,maxRetries:3});
}
