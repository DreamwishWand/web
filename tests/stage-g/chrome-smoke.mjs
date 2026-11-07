// W-CORE-REAL-WASM-BROWSER-099: use REAL Chromium/Chrome headless CDP,
// REAL browser Worker and generated wasm-bindgen; zero third-party JS packages.
// No user Save, keys, media, Cloud or UI JSON transport.
import {startOwnerLocalV1Server} from '../../tools/owner-local-steam-v1/server.mjs';
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
  const local=await startOwnerLocalV1Server({ciFixture:true});
  server=local.server;
  const port=local.port;
  browser=spawn(binary,[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--no-default-browser-check','--remote-allow-origins=*',
    '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
  ],{stdio:'ignore'});
  await connect();
  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Page.navigate',{url:'http://127.0.0.1:'+port+'/tests/stage-g/index.html'});
  // Navigation may destroy the old about:blank execution context. Wait until
  // the *new* document exists before creating an awaitPromise CDP task.
  let navigated=false;
  for(let i=0;i<200;i++){
    try{
      const state=await rpc('Runtime.evaluate',{expression:'location.pathname',
        returnByValue:true});
      if(state.result?.value==='/tests/stage-g/index.html'){
        navigated=true;break;
      }
    }catch{} // context swap is expected during Page.navigate
    await delay(50);
  }
  if(!navigated)throw Error('ENV_STAGEG_CHROME_NAVIGATION_NOT_READY');
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
            if(window.__stageG){
              window.__stageG.then(resolve,reject);
            }else if(++count>3000){reject(Error('BROWSER_WORKER_BOOT_TIMEOUT'))}
            else setTimeout(tick,30);
          };
          tick();
        })`,awaitPromise:true,returnByValue:true}),
      delay(150000,undefined,{signal:watchdog.signal})
        .then(()=>{throw Error('ENV_STAGEG_CHROME_TIMEOUT_150S')})
    ]);
  }finally{watchdog.abort()}
  if(result.exceptionDetails)throw Error('CHROME_WORKER_EXCEPTION:'+
    (result.exceptionDetails.exception?.description||
      result.exceptionDetails.text||'unknown').slice(0,900));
  const report=result.result?.value;
  assert.equal(report?.source,'CI_SYNTHETIC_ONLY');
  for(const k of [
    'liveChromeWorker','actualGeneratedRustWasm',
    'originalShaMatch','decodedRustShaMatch','externalBuildClaimOnly',
    'sessionRotated','negativeClaimsDenied','noPostEndpoint',
    'noDecodedJsonPosted'
  ])assert.equal(report[k],true,k);
  for(const k of ['buildCryptographicallyProven','genuineOwnerSteamSave',
    'realSaveV1Accepted','rustV2','nativeV3','writerAuthorized'])
      assert.equal(report[k],false,k);
  assert.equal(report.schema,626);
  assert.ok(report.encryptedBytes>0&&report.encryptedBytes<1024*1024);
  assert.ok(report.decodedBytes>1024*1024&&report.decodedBytes<2*1024*1024);
  console.log('STAGE_G_OWNER_LOCAL_RUST_V1_SYNTHETIC_CHROME_PASS');
  console.log(JSON.stringify({
    browserBinary:binary,encryptedBytes:report.encryptedBytes,
    decodedBytes:report.decodedBytes,workerOpenMs:report.workerOpenMs,
    exactBuildClaimOnly:true,sourceHashMatched:true,noNetworkPost:true,
    productWriter:false,realPrivateSteamP1G:false
  }));
}catch(error){
  console.error('STAGE_G_CHROME_REAL_WASM_FAIL:',String(error?.stack||error).slice(0,1200));
  process.exitCode=1;
}finally{
  for(const task of pending.values())task.reject(Error('CDP_CLOSED'));
  pending.clear();
  try{ws?.close()}catch{}
  if(browser){browser.kill('SIGTERM');await delay(250);if(browser.exitCode===null)browser.kill('SIGKILL');}
  if(server)await new Promise(done=>server.close(done));
  await rm(profile,{recursive:true,force:true,maxRetries:3});
}
