// QA-only Chrome real-OPFS runner for the dedicated Steam626 Chest Rust/WASM.
// No Owner Save, private keys, public write grants, or external HTTP.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const profile=await mkdtemp(join(tmpdir(),'wand-01a-chest-chrome-'));
const empty=()=>({ItemID:0,Amount:0,State:null});
const d={GameInfo:{Version:626},ConditionalEventHistory:{ActiveEvents:{}},
 World:{GridCollection:{Grids:{'7':{ID:7,GridDefaultLayoutPath:'',Objects:{
  '4':{ID:4,ItemID:40001680,State:{Storage:{ContainerInventoryID:12,
    DefaultContainerInventoryData:'',UnlockKeyItemID:0,UnlockLocId:'',DesignID:null}}},
  '8':{ID:8,ItemID:40009998,State:{Mannequin:{BodyType:0,
    Clothes:{'0':50000001},ClothingCustomization:{'50000001':-1,'50000002':0},
    HairColorIndex:0,HairHighlightColor:0,IsMale:true}}}
 }}},DiffGrids:{}},MissionSlots:{},Villages:[{Areas:{'2':{GridIDs:[7],Unlocked:true}}}]},
 Player:{ListInventories:{
  '0':{ID:0,CompatibleItemType:'ItemType_Furniture',
       CompatibleFurnitureTypes:{List:['FurnitureItemType_Default']},
       Inventory:{'40000048':{Amount:3,Marker:'ItemMarker_None'}}},
  '2':{ID:2,CompatibleItemType:'ItemType_ActivityItem',Inventory:{'30200000':{Amount:2}}}},
  ContainerInventories:{
   '0':{ID:0,BelongsToPlayer:true,Size:1,ExtraSize:0,
      Inventory:[{ItemID:30200000,Amount:5,State:{}}]},
   '1':{ID:1,BelongsToPlayer:true,Size:1,ExtraSize:0,Inventory:[empty()]},
   '12':{ID:12,ParentItemID:40001680,BelongsToPlayer:true,BlockMoveTo:false,
     Size:48,ExtraSize:0,Inventory:[{ItemID:30200000,Amount:50,State:null,Unknown:7},
       ...Array.from({length:47},empty)]}},
  BackpackOverflow:{Items:[]},AchievementsData:[],EvolveStatesProfile:{EvolveProgressState:{}},
  DutySlots:{},BattlePassStates:{Progress:{},FtueProgress:{TasksProgress:[],WeeklyTasksProgress:[]}}},
 Unknown:{neverOverwrite:true}};
const fixture=makeSyntheticP1gProfile(d);
const expected=structuredClone(d);expected.Player.ContainerInventories['12'].Inventory[0].Amount=49;
const expectedJson=Buffer.from(JSON.stringify({
 originalSha256:createHash('sha256').update(fixture).digest('hex'),edited:expected}));
const chromeCandidates=[process.env.WAND_CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
const binary=chromeCandidates.find(x=>spawnSync('which',[x],{stdio:'ignore'}).status===0);
if(!binary)throw Error('ENV_WAIT_DEP_CHROME_NOT_INSTALLED');
let server,browser,ws,seq=0;
const pending=new Map();
function route(req,res){
 let url;try{url=new URL(req.url,'http://127.0.0.1')}catch{res.writeHead(400);res.end();return}
 const p=url.pathname;
 if(url.search||url.hash){res.writeHead(403);res.end();return}
 if(p==='/fixture/chest.p1g'){
  res.writeHead(200,{'content-type':'application/octet-stream','cache-control':'no-store'});
  res.end(fixture);return;
 }
 if(p==='/fixture/expected.json'){
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(expectedJson);return;
 }
 if(p==='/'){
  const html=`<!doctype html><meta charset="utf-8"><title>01A QA dedicated Rust Chrome OPFS</title><script>
    window.__done=new Promise((resolve,reject)=>{
      const w=new Worker('/tests/01a-dedicated-steam626-chest-real-opfs.worker.mjs',{type:'module'});
      w.onerror=e=>{w.terminate();reject(Error('CHROME_DEDICATED_WORKER_ERROR:'+e.message))};
      w.onmessage=e=>{w.terminate();if(e.data?.status==='PASS')resolve(e.data.summary);
        else reject(Error(e.data?.error||'CHROME_DEDICATED_WORKER_DENIED'))};
      w.postMessage({kind:'01A_CHROME_DEDICATED_CHEST_OPFS_RUN'});
    });</script>`;
  res.writeHead(200,{'content-type':'text/html;charset=utf-8','cache-control':'no-store'});res.end(html);return;
 }
 const ok=(p==='/tests/01a-dedicated-steam626-chest-real-opfs.worker.mjs'||
  p==='/src/lib/dev/local-amount-codec-reopen.worker.mjs'||
  /^\/tests\/stage-e\/pkg\/ddv_save_core(?:_bg\.wasm|\.js)$/.test(p)||
  /^\/src\/lib\/ddv\/core\/save\/[A-Za-z0-9._/-]+\.(?:js|mjs)$/.test(p)||
  /^\/src\/lib\/collection\/[A-Za-z0-9._/-]+\.(?:js|mjs)$/.test(p));
 if(!ok||p.includes('..')||p.includes('/.')){res.writeHead(403);res.end();return}
 const path=resolve(cwd,'.'+p);
 if(!path.startsWith(cwd+'/')){res.writeHead(403);res.end();return}
 const ext=extname(p),mime=ext==='.wasm'?'application/wasm':'text/javascript;charset=utf-8';
 readFile(path).then(bytes=>{res.writeHead(200,{'content-type':mime,
  'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(bytes)})
 .catch(()=>{res.writeHead(404);res.end()});
}
function rpc(method,params={}){
 return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params}))});
}
async function attach(){
 const file=join(profile,'DevToolsActivePort');let port;
 for(let i=0;i<200;i++){
  if(existsSync(file)){
   const lines=(await readFile(file,'utf8')).trim().split('\n');
   port=Number(lines[0]);if(port>0)break;
  }await delay(120);
 }
 if(!port)throw Error('CHROME_CDP_START_UNAVAILABLE');
 let socket;
 for(let i=0;i<160;i++){
  try{
   const arr=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
   socket=arr.find(t=>t.type==='page')?.webSocketDebuggerUrl;if(socket)break;
  }catch{}await delay(125);
 }
 if(!socket)throw Error('CHROME_CDP_TARGET_UNAVAILABLE');
 ws=new WebSocket(socket);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',ev=>{
  let msg;try{msg=JSON.parse(String(ev.data))}catch{return}
  const p=pending.get(msg.id);if(!p)return;pending.delete(msg.id);
  if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result);
 });
}
try{
 server=createServer(route);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 browser=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-allow-origins=*','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await attach();await rpc('Page.enable');await rpc('Runtime.enable');
 await rpc('Page.navigate',{url:'http://127.0.0.1:'+port+'/'});
 let navigated=false;
 for(let i=0;i<200;i++){
  try{
   const r=await rpc('Runtime.evaluate',{expression:'location.pathname',returnByValue:true});
   if(r.result?.value==='/'){navigated=true;break}
  }catch{}await delay(60);
 }
 if(!navigated)throw Error('CHROME_PAGE_NOT_READY');
 const watchdog=new AbortController();
 let result;
 try{
  result=await Promise.race([
   rpc('Runtime.evaluate',{expression:`new Promise((resolve,reject)=>{
      const tick=()=>{
        if(window.__done)window.__done.then(resolve,reject);
        else setTimeout(tick,30);
      };tick();
    })`,awaitPromise:true,returnByValue:true}),
   delay(150000,undefined,{signal:watchdog.signal}).then(()=>{throw Error('CHROME_OPFS_TIMEOUT')})
  ]);
 }finally{watchdog.abort()}
 if(result.exceptionDetails)throw Error('CHROME_WORKER_EXCEPTION:'+String(result.exceptionDetails.exception?.description||result.exceptionDetails.text).slice(0,500));
 const r=result.result?.value;
 for(const k of ['realChromeDedicatedWorker','generatedRustWasm','realOpfs',
  'browserWorkerCodecReopen','scopedNativeChest48Exact1','noOriginalOverwrite','noRawSaveToPage'])
   assert.equal(r?.[k],true,k);
 for(const k of ['independentOsProcessReopenVerified','writerAuthorized'])assert.equal(r[k],false,k);
 assert.equal(r.opfsEncryptedAliases,2);assert.equal(r.denials,2);
 console.log('01A_GENERATED_DEDICATED_STEAM626_CHEST_REAL_CHROME_WORKER_OPFS_EXACT1_PASS');
 console.log(JSON.stringify({syntheticOnly:true,realChromeDedicatedWorker:r.realChromeDedicatedWorker,
  generatedRustWasm:r.generatedRustWasm,realOpfs:r.realOpfs,
  exactScopedStage:r.scopedNativeChest48Exact1,originalUnchanged:r.noOriginalOverwrite,
  browserOnlyReopenNotOsProcess:!r.independentOsProcessReopenVerified,writer:false}));
}catch(e){
 console.error('01A_GENERATED_CHEST_REAL_CHROME_OPFS_FAIL:',String(e?.stack||e).slice(0,900));
 process.exitCode=1;
}finally{
 for(const p of pending.values())p.reject(Error('CDP_CLOSED'));pending.clear();
 try{ws?.close()}catch{}
 if(browser){browser.kill('SIGTERM');await delay(250);if(browser.exitCode===null)browser.kill('SIGKILL')}
 if(server)await new Promise(resolve=>server.close(resolve));
 fixture.fill(0);
 await rm(profile,{recursive:true,force:true,maxRetries:3});
}
