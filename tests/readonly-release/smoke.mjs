// Actual headless Chrome, historical attested READ-only JS+WASM, synthetic
// HTTPS test origin and test-only in-memory anchor. No deployment/Save input.
import {createServer} from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inspectReleasePins} from '../../scripts/readonly-release/seal.mjs';
import {RELEASE_TUPLES,releaseDelivery} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {readonlyReleaseIdentityText} from '../../src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs';
const dir=resolve(process.argv[2]);
const source=process.argv[3];
if(!/^[0-9a-f]{40}$/.test(source??''))throw Error('R22_FIXED_TEST_SOURCE_REQUIRED');
const pins=await inspectReleasePins(dir,source);
const root=resolve(import.meta.dirname,'../..');
const profile=await mkdtemp(join(tmpdir(),'wand-release-chrome-'));
let server,browser,ws;const origin=RELEASE_TUPLES[0].origin,rootOrigin=RELEASE_TUPLES[1].origin;
let rootScenario='web';let seq=0;const pending=new Map();
const chrome=[process.env.WAND_CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)
 .find(x=>spawnSync('which',[x],{stdio:'ignore'}).status===0);
if(!chrome)throw Error('ENV_CHROME_NOT_INSTALLED');
const files=['product-rust-wasm-candidate-loader.mjs','product-rust-wasm-release-loader.mjs','product-rust-wasm-release-trust.mjs'];
const modules=new Map(await Promise.all(files.map(async n=>[n,await readFile(join(root,'src/lib/ddv/core/save',n))])));
const assets=new Map(await Promise.all(['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'].map(async n=>[n,await readFile(join(dir,n))])));
const hash=x=>createHash('sha256').update(x).digest('hex');
// Only this isolated HTTPS fixture synthesizes a root manifest. Its bytes
// are NOT signed root provenance. Historical bytes remain legacy-only.
const rootManifest=t=>Buffer.from(JSON.stringify({...JSON.parse(assets.get('manifest.json')),
 source:{...JSON.parse(assets.get('manifest.json')).source,repository:t.repository},
 delivery:releaseDelivery(t)}));
const webRootManifest=rootManifest(RELEASE_TUPLES[1]),siteRootManifest=rootManifest(RELEASE_TUPLES[2]);
const rootFixture=()=>rootScenario==='legacy'?assets.get('manifest.json'):
 rootScenario==='site'?siteRootManifest:webRootManifest;
const rootFixturePins=()=>({...pins,manifestSha256:hash(rootFixture()),manifestSizeBytes:rootFixture().length});
const anchor=(base='/web',mode='good')=>{
 const t=base===''?RELEASE_TUPLES[rootScenario==='site'||rootScenario==='cross'?2:1]:RELEASE_TUPLES[0];
 const a={contract:'wand.r22.protected-readonly-release@1',...t,
 origin:mode==='origin'?'https://wrong.invalid':t.origin,pins:base===''?rootFixturePins():pins,
 attestationVerifiedAtBuild:true};
 const id=hash(readonlyReleaseIdentityText(a));
 return mode==='null'?null:{...a,releaseId:mode==='identity'?'f'.repeat(64):id};
};
const worker=`import {loadProtectedReadonlyRustWasm} from './product-rust-wasm-release-loader.mjs';
self.onmessage=async({data:mode})=>{
 let count=0;
 const original=self.fetch.bind(self);
 self.fetch=async(url,options)=>{
  count++;
  if(options.cache!=='no-store'||options.redirect!=='error'||options.credentials!=='same-origin'||options.mode!=='same-origin')throw Error('fetch policy');
  const response=await original(url,options);
  if(mode==='redirect'&&url.endsWith('ddv_save_core.js'))return {ok:true,status:200,redirected:true,type:'basic',url,headers:response.headers};
  if(mode==='mime'&&url.endsWith('ddv_save_core.js'))return {ok:true,status:200,redirected:false,type:'basic',url,headers:new Headers({'content-type':'text/html'})};
  if((mode==='manifest'&&url.endsWith('manifest.json'))||(mode==='js'&&url.endsWith('ddv_save_core.js'))||(mode==='wasm'&&url.endsWith('ddv_save_core_bg.wasm'))){
   const b=new Uint8Array(await response.arrayBuffer());b[b.length-1]^=1;
   return {ok:true,status:200,redirected:false,type:'basic',url,headers:response.headers,arrayBuffer:async()=>b.buffer};
  }
  return response;
 };
 try{
  if(mode==='caller')await loadProtectedReadonlyRustWasm({qaCandidate:true});
  const r=await loadProtectedReadonlyRustWasm();
  let replay=false;try{await loadProtectedReadonlyRustWasm()}catch(e){replay=String(e).includes('LOAD_REPLAY_DENIED')}
  self.postMessage({ok:true,count,replay,contract:r.contract,source:r.sourceHead,verified:r.attestationVerifiedAtBuild,
    runtime:r.runtimeSignatureVerified,qa:r.qaCandidate,reader:r.productConsumerEnabled,writer:r.writerAuthorized,
    native:r.nativeV3Verified,apply:r.applyAuthorized,abi:typeof r.WorkerWasmSource==='function'});
 }catch(e){self.postMessage({ok:false,count,error:String(e)})}
};`;
const page=base=>`<!doctype html><html><body><script type="module" src="${base}/runner.mjs"></script></body></html>`;
const runner=`window.result=(async()=>{
 const results={};
 for(const mode of location.pathname.startsWith('/web/')?['good','caller','null','identity','origin','manifest','js','wasm','redirect','mime','stale','wrongbase']:['root']){
  const path=mode==='root'? '/_app/root/worker.mjs':mode==='wrongbase'? '/_app/wrongbase/worker.mjs':'/web/_app/'+mode+'/worker.mjs';
  results[mode]=await new Promise((resolve,reject)=>{
   const w=new Worker(path,{type:'module'});w.onmessage=e=>{w.terminate();resolve(e.data)};
   w.onerror=e=>{w.terminate();reject(Error(e.message))};w.postMessage(mode);
  });
 }
 return results;
})();`;
function respond(req,res){
 const path=new URL(req.url,origin).pathname;
 const headers={'content-security-policy':"default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'",'cache-control':'no-store','x-content-type-options':'nosniff'};
 let body,type='text/javascript';
 if(path==='/web/test.html'||path==='/test.html'){body=page(path.startsWith('/web/')?'/web':'');type='text/html'}
 else if(path==='/web/runner.mjs'||path==='/runner.mjs')body=runner;
 else if(/^\/(?:web\/)?_app\/[a-z]+\/[a-z0-9.-]+$/.test(path)){
  const parts=path.split('/'),n=parts.at(-1),mode=parts.at(-2);
  if(n==='worker.mjs')body=worker;
  else if(n==='product-rust-wasm-release-anchor.mjs'){
   let a=anchor(mode==='root'?'':'/web',mode);
   if(mode==='stale'){
    a={...a,pins:{...a.pins,sourceHead:'e'.repeat(40)}};
    a.releaseId=hash(readonlyReleaseIdentityText(a));
   }
   body='const a='+JSON.stringify(a)+';if(a)Object.freeze(a.pins);export const PROTECTED_READONLY_RELEASE_ANCHOR=a?Object.freeze(a):null;';
  }else body=modules.get(n);
 }else if(/^\/(?:web\/)?worker-wasm\/(?:manifest\.json|ddv_save_core\.js|ddv_save_core_bg\.wasm)$/.test(path)){
  const n=path.split('/').at(-1);body=n==='manifest.json'&&req.headers.host==='dreamwishwand.com'?rootFixture():assets.get(n);
  type=n.endsWith('.json')?'application/json':n.endsWith('.wasm')?'application/wasm':'text/javascript';
 }
 if(body===undefined){res.writeHead(404,headers);res.end();return}
 res.writeHead(200,{...headers,'content-type':type});res.end(body);
}
const rpc=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
});
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem')],{stdio:'ignore'});
 server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},respond);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const fixturePort=server.address().port;
 browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--ignore-certificate-errors','--remote-allow-origins=*','--no-proxy-server',`--host-resolver-rules=MAP dreamwishwand.github.io 127.0.0.1:${fixturePort}, MAP dreamwishwand.com 127.0.0.1:${fixturePort}`,'--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let port;for(let i=0;i<240;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break}catch{}await delay(125)}
 if(!port)throw Error('ENV_CHROME_DEBUG_PORT_UNAVAILABLE');
 let target;for(let i=0;i<160;i++){try{target=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page')?.webSocketDebuggerUrl;if(target)break}catch{}await delay(125)}
 if(!target)throw Error('ENV_CHROME_TARGET_MISSING');
 ws=new WebSocket(target);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data)),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
 await rpc('Page.enable');await rpc('Runtime.enable');await rpc('Page.navigate',{url:origin+'/web/test.html'});
 let ready=false;for(let i=0;i<200;i++){try{const r=await rpc('Runtime.evaluate',{expression:'location.pathname',returnByValue:true});if(r.result.value==='/web/test.html'){ready=true;break}}catch{}await delay(50)}
 if(!ready)throw Error('ENV_CHROME_NAVIGATION');
 const watchdog=new AbortController();let result;
 try{result=await Promise.race([rpc('Runtime.evaluate',{expression:`new Promise((r,j)=>{let n=0;function tick(){if(window.result)window.result.then(r,j);else if(++n>3000)j(Error('no runner'));else setTimeout(tick,30)}tick()})`,awaitPromise:true,returnByValue:true}),delay(120000,undefined,{signal:watchdog.signal}).then(()=>{throw Error('ENV_CHROME_TIMEOUT')})])}
 finally{watchdog.abort()}
 if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails).slice(0,1000));
 const r=result.result.value;
 // Navigate the second exact origin in the same isolated browser. No
 // network access to the real hosts: Chrome resolver maps both to fixture.
 const rootProbe=async()=>{
  const target=rootOrigin+'/test.html?case='+rootScenario;
  await rpc('Page.navigate',{url:target});
  let ready=false;
  for(let i=0;i<200;i++){try{const x=await rpc('Runtime.evaluate',{expression:'location.href',returnByValue:true});if(x.result.value===target){ready=true;break}}catch{}await delay(50)}
  if(!ready)throw Error('ENV_CHROME_ROOT_NAVIGATION');
  const x=await rpc('Runtime.evaluate',{expression:`new Promise((r,j)=>{let n=0;function tick(){if(window.result)window.result.then(r,j);else if(++n>3000)j(Error('no root runner'));else setTimeout(tick,30)}tick()})`,awaitPromise:true,returnByValue:true});
  if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails).slice(0,1000));
  return x.result.value.root;
 };
 r.root=await rootProbe();
 rootScenario='site';r.site=await rootProbe();
 for(const scenario of ['legacy','cross']){
  rootScenario=scenario;
  const denied=await rootProbe();
  assert.equal(denied.ok,false,scenario);assert.match(denied.error,/MANIFEST_PROVENANCE_OR_ABI_DENIED/,scenario);
  assert.equal(denied.count,1,scenario);
 }
 for(const mode of ['good','root','site']){
  const x=r[mode];assert.equal(x.ok,true,JSON.stringify(x));assert.equal(x.count,3);assert.equal(x.replay,true);
  assert.equal(x.contract,'wand.r22.protected-readonly-loader-receipt@1');assert.equal(x.source,source);
  assert.equal(x.verified,true);assert.equal(x.abi,true);
  for(const flag of ['runtime','qa','reader','writer','native','apply'])assert.equal(x[flag],false,flag);
 }
 for(const [mode,pattern] of [['caller','CALLER_AUTHORITY_DENIED'],['null','BUILD_ANCHOR_MISSING'],['identity','BUILD_IDENTITY_MISMATCH'],['origin','BUILD_ANCHOR_MISSING_OR_INVALID'],['manifest','ASSET_SHA256_MISMATCH'],['js','ASSET_SHA256_MISMATCH'],['wasm','ASSET_SHA256_MISMATCH'],['redirect','ASSET_ORIGIN_STATUS_REDIRECT'],['mime','ASSET_CONTENT_TYPE'],['stale','MANIFEST_PROVENANCE_OR_ABI_DENIED'],['wrongbase','WORKER_DELIVERY_SCOPE_DENIED']]){
  assert.equal(r[mode].ok,false,mode);assert.match(r[mode].error,new RegExp(pattern),mode);
 }
 console.log('R22_BUILD_ANCHORED_READONLY_REAL_CHROME_3POS_13NEG_PASS; HISTORICAL_LEGACY_SIGNED_BYTES; SYNTHETIC_WEB_AND_SITE_ROOT_MANIFESTS_ONLY; LOCAL_HOST_MAPPING; PRODUCT_OFF');
}finally{
 for(const p of pending.values())p.reject(Error('CDP_CLOSED'));pending.clear();try{ws?.close()}catch{}
 if(browser){browser.kill('SIGTERM');await delay(250);if(browser.exitCode===null)browser.kill('SIGKILL')}
 if(server)await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:3});
}
