// W-CORE-REAL-WASM-BROWSER-099: use REAL Chromium/Chrome headless CDP,
// REAL browser Worker and generated wasm-bindgen; zero third-party JS packages.
// No user Save, keys, media, Cloud or UI JSON transport.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';

const repoRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const profile=await mkdtemp(join(tmpdir(),'wand-stagee-chrome-'));
let browser,ws,server;
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
  '.mjs':'text/javascript;charset=utf-8','.wasm':'application/wasm',
  '.p1g':'application/octet-stream','.json':'application/json'};
const chromeCandidates=[process.env.WAND_CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
const binary=chromeCandidates.find(bin=>spawnSync('which',[bin],{stdio:'ignore'}).status===0);
if(!binary)throw Error('ENV_WAIT_DEP_CHROME_NOT_INSTALLED');
function replyFile(req,res){
  let p;
  try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{
    res.writeHead(400);res.end();return;
  }
  const allowed=p.startsWith('/tests/stage-i/')||
    p.startsWith('/tests/stage-e/pkg/')||
    ['/src/lib/ddv/core/save/product-wasm-read-owner.mjs',
     '/src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs',
     '/src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs',
     '/tools/owner-local-steam-v1/attestation.mjs',
     '/src/lib/ddv/core/save/p1g-packaged-profile-codec.js',
     '/src/lib/ddv/core/save/safe-edit-session.js',
     '/src/lib/ddv/core/save/versioning.js'].includes(p);
  if(!allowed||p.includes('..')||p.includes('/.')){
    res.writeHead(403);res.end();return;
  }
  const path=resolve(repoRoot,'.'+p);
  if(!path.startsWith(repoRoot+'/')){res.writeHead(403);res.end();return;}
  readFile(path).then(bytes=>{
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream',
      'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(bytes);
  }).catch(()=>{res.writeHead(404);res.end()});
}
const pending=new Map();let seq=0;
function rpc(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq;
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function connect(){
  const file=join(profile,'DevToolsActivePort');
  let port;
  for(let i=0;i<240;i++){
    if(existsSync(file)){
      const raw=(await readFile(file,'utf8')).trim().split('\n');
      port=Number(raw[0]);if(port>0)break;
    }
    await delay(125);
  }
  if(!port)throw Error('ENV_WAIT_DEP_CHROME_DEBUG_PORT_UNAVAILABLE');
  let url;
  for(let i=0;i<160;i++){
    try{
      const data=await fetch('http://127.0.0.1:'+port+'/json/list');
      const arr=await data.json();
      url=arr.find(t=>t.type==='page')?.webSocketDebuggerUrl;
      if(url)break;
    }catch{}
    await delay(125);
  }
  if(!url)throw Error('ENV_WAIT_DEP_CHROME_PAGE_DEBUG_TARGET_MISSING');
  ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',event=>{
    let msg;try{msg=JSON.parse(String(event.data))}catch{return}
    const task=pending.get(msg.id);
    if(task){pending.delete(msg.id);if(msg.error)task.reject(Error(JSON.stringify(msg.error)));
      else task.resolve(msg.result);}
  });
}
try{
  server=createServer(replyFile);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  browser=spawn(binary,[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--no-default-browser-check','--remote-allow-origins=*',
    '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
  ],{stdio:'ignore'});
  await connect();
  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Page.navigate',{url:'http://127.0.0.1:'+port+'/tests/stage-i/index.html'});
  // Navigation may destroy the old about:blank execution context. Wait until
  // the *new* document exists before creating an awaitPromise CDP task.
  let navigated=false;
  for(let i=0;i<200;i++){
    try{
      const state=await rpc('Runtime.evaluate',{expression:'location.pathname',
        returnByValue:true});
      if(state.result?.value==='/tests/stage-i/index.html'){
        navigated=true;break;
      }
    }catch{} // context swap is expected during Page.navigate
    await delay(50);
  }
  if(!navigated)throw Error('ENV_STAGEI_CHROME_NAVIGATION_NOT_READY');
  // Abort the 150s watchdog on success/failure, otherwise Node's timer
  // unnecessarily holds the GitHub runner open even after a verdict.
  const watchdog=new AbortController();
  let result;
  try{
    result=await Promise.race([
      rpc('Runtime.evaluate',{expression:`
        new Promise((resolve,reject)=>{
          let count=0;
          const tick=()=>{
            if(window.__stageI){
              window.__stageI.then(resolve,reject);
            }else if(++count>3000){reject(Error('BROWSER_WORKER_BOOT_TIMEOUT'))}
            else setTimeout(tick,30);
          };
          tick();
        })`,awaitPromise:true,returnByValue:true}),
      delay(150000,undefined,{signal:watchdog.signal})
        .then(()=>{throw Error('ENV_STAGEI_CHROME_TIMEOUT_150S')})
    ]);
  }finally{watchdog.abort()}
  if(result.exceptionDetails)throw Error('CHROME_WORKER_EXCEPTION:'+
    (result.exceptionDetails.exception?.description||
      result.exceptionDetails.text||'unknown').slice(0,900));
  const report=result.result?.value;
  assert.equal(report?.result,'DEV_ONLY_REAL_RUST_CODEC_EDIT_PASS');
  for(const k of ['realGeneratedWasm','realChromeWorker','officialP1gCodec',
    'sameRustProductSession','twoAtomicAmountTokens','staleCASDenied',
    'nativeEnumStringChecked','undoRedo','originalAndBackupShaInvariant',
    'separateNamedEditedCopy','separateChromeWorkerReopen','publicSyntheticOnly'])
    assert.equal(report[k],true,k);
  for(const k of ['writerAuthorized','nativeV3','deviceV4',
    'realPrivateSteamP1g','independentProcessReopen','productWriterEnabled'])
    assert.equal(report[k],false,k);
  console.log('STAGE_I_DEV_ONLY_REAL_RUST_OFFICIAL_CODEC_CHROME_PASS');
}catch(error){
  console.error('STAGE_I_CHROME_REAL_WASM_FAIL:',String(error?.stack||error).slice(0,1200));
  process.exitCode=1;
}finally{
  for(const task of pending.values())task.reject(Error('CDP_CLOSED'));
  pending.clear();
  try{ws?.close()}catch{}
  if(browser){browser.kill('SIGTERM');await delay(250);if(browser.exitCode===null)browser.kill('SIGKILL');}
  if(server)await new Promise(done=>server.close(done));
  await rm(profile,{recursive:true,force:true,maxRetries:3});
}
