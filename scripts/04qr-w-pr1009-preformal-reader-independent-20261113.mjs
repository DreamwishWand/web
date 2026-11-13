// QA-only, actual signed bytes at an isolated HTTPS origin; no private Save.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
const S='e6720cb9c0078677180fc4a797359f1584af9a42',B='e3e8a9275f6a2ca3e4ad17d0c3db2f9a6889df9b';
const pins={'src/lib/wep/SteamSavedDiffGridsReadonly.svelte':'7e8b81314daffd524efd105638788be1c3be3052','src/lib/wep/steam-saved-diffgrids.consumer.worker.ts':'8a030e52693ffe62f60dc4359fddba6bbc7f1290','src/routes/editor/steam-reader/+page.svelte':'713cb69bd4f97d58d79d6060470e3b2e98bc4614','src/lib/wep/steam-saved-diffgrids-copy.mjs':'f9664dc59f7595eb40beff0dd66309fbb44c40fe','.github/workflows/08web-steam-saved-diffgrids-real-chrome.yml':'6186f8ba3c6f1415de4ae7f5c32d0a960f44b8f9','tests/protected-readonly-release.test.mjs':'4687dc69dd39670f27ba9203b43f62c6283c293f','tests/web-steam-saved-diffgrids-consumer.test.mjs':'47c3efcb3f1e10252f110577578d5860e31f8472','tests/web-steam-saved-diffgrids-real-chrome.mjs':'a9968a9eb200b9f81f2295a2b5b1cc0836dffbf7'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',S,'HEAD'),S);
assert.deepEqual(git('diff','--name-only',B,S).split('\n').sort(),Object.keys(pins).sort());
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr1009-preformal-reader-20261113.yml','A\tscripts/04qr-w-pr1009-preformal-reader-independent-20261113.mjs'].sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('rev-parse','HEAD:'+p),h);
for(const [p,h] of Object.entries({'src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs':'497685240690005dd7c9bbc8e88ec59e58c06be5','src/lib/wep/steam-saved-diffgrids-ui-client.mjs':'e25be774f939f30a58dc2b2086cec4d22d48260a','src/routes/editor/timing/+page.svelte':'7db3d6119755eeb305b49ae38339d636e40edcf6'}))assert.equal(git('rev-parse','HEAD:'+p),h);
const mode=process.argv[2];assert.ok(['production','synthetic'].includes(mode));
const tmp=await mkdtemp(join(tmpdir(),'qrw1009-')),root=resolve('build'),origin='https://127.0.0.1:19443';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const requests=[],violations=[];
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-keyout',join(tmp,'key'),' -out'.trim(),join(tmp,'cert')],{stdio:'ignore'});
const server=createServer({key:await readFile(join(tmp,'key')),cert:await readFile(join(tmp,'cert'))},async(req,res)=>{
 try{
  requests.push([req.method,req.url]);if(!['GET','HEAD'].includes(req.method)){violations.push('HTTP_MUTATION');res.writeHead(405);return res.end()}
  const p=new URL(req.url,origin).pathname;if(!p.startsWith('/web/')){res.writeHead(404);return res.end()}
  const suffix=decodeURIComponent(p.slice(5));const name=resolve(root,suffix.endsWith('/')?suffix+'index.html':suffix||'index.html');
  if(!name.startsWith(root+'/')){res.writeHead(403);return res.end()}
  const b=await readFile(name);
  res.writeHead(200,{'content-type':mime[extname(name)]||'application/octet-stream','cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'"});
  res.end(b);
 }catch{res.writeHead(404);res.end()}
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(19443,'127.0.0.1',ok)});
const bin=['google-chrome-stable','google-chrome','chromium'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);assert.ok(bin);
let browser;
try{
 browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:320,height:800},serviceWorkers:'block',acceptDownloads:false});
 const p=await ctx.newPage();const pageErrors=[];p.on('pageerror',e=>pageErrors.push(e.message));
 ctx.on('request',r=>{if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))violations.push('NETWORK_BOUNDARY')});
 await p.addInitScript(()=>{
  const a={created:0,terminated:0,ready:[],reply:[],sent:[],workers:[]};window.__qrw=a;
  const W=window.Worker;window.Worker=new Proxy(W,{construct(t,args){
   const w=Reflect.construct(t,args);
   if(args[1]?.name==='wand-steam-diffgrids-readonly'){
    a.created++;a.workers.push(w);
    w.addEventListener('message',({data:d})=>{if(d?.kind==='DIFFGRIDS_RUNTIME_READY')a.ready.push({ready:d.ready,writer:d.writerAuthorized});else a.reply.push({id:d?.requestId,ok:d?.ok,selection:d?.summary?.selection,error:d?.error,keys:Object.keys(d||{}).sort()})});
    const send=w.postMessage.bind(w);w.postMessage=(d,...rest)=>{a.sent.push({kind:d.kind,id:d.requestId,selection:d.selection});return send(d,...rest)};
    const end=w.terminate.bind(w);w.terminate=()=>{a.terminated++;return end()};
   }return w;
  }});
 });
 const panel=p.locator('[data-steam-diffgrids-readonly]'),ready=()=>p.locator('[data-diffgrids-manual-only]').waitFor({state:'visible',timeout:25000});
 async function openPanel(){await panel.locator('summary').click();await ready()}
 async function audit(){return p.evaluate(()=>({created:__qrw.created,terminated:__qrw.terminated,ready:__qrw.ready,reply:__qrw.reply,sent:__qrw.sent}))}
 async function raw(data){return p.evaluate(d=>new Promise((resolve,reject)=>{
  const w=__qrw.workers.at(-1),timer=setTimeout(()=>{w.removeEventListener('message',on);reject(Error('RAW_TIMEOUT'))},10000);
  function on(e){if(e.data?.requestId!==d.requestId)return;clearTimeout(timer);w.removeEventListener('message',on);resolve({ok:e.data.ok,error:e.data.error,keys:Object.keys(e.data).sort()})}
  w.addEventListener('message',on);w.postMessage(d);
 }),data)}
 const go=async path=>{const r=await p.goto(origin+'/web/'+path,{waitUntil:'networkidle',timeout:40000});assert.equal(r.status(),200)};
 await go('editor/timing/');await panel.locator('summary').click();assert.equal((await audit()).created,0);assert.equal(await panel.locator('#steam-diffgrids-file').count(),0);
 assert.equal(requests.filter(x=>x[1].includes('/worker-wasm/')).length,0);
 await panel.locator('a[href$="/editor/steam-reader/"]').click();await p.waitForURL('**/editor/steam-reader/');await openPanel();
 let a=await audit();assert.equal(a.created,1);assert.deepEqual(a.ready,[{ready:true,writer:false}]);assert.equal(a.sent.length,0);
 assert.equal(await panel.getAttribute('data-product-read'),'off');assert.equal(await panel.getAttribute('data-writer'),'off');assert.equal(await panel.getAttribute('data-cloud'),'off');
 assert.equal(await p.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 const fixture=await readFile('tests/stage-f/fixtures/synthetic626-diffgrids.p1g'),sha=createHash('sha256').update(fixture).digest('hex');
 async function select(digest=sha){await panel.locator('#steam-diffgrids-file').setInputFiles({name:'synthetic-only.p1g',mimeType:'application/octet-stream',buffer:fixture});await panel.locator('#steam-diffgrids-sha').fill(digest);await panel.locator('input[type=checkbox]').check();assert.equal(await panel.locator('[data-diffgrids-open]').isEnabled(),true)}
 const open=()=>panel.locator('[data-diffgrids-open]').click();
 const deny=async d=>{const r=await raw(d);assert.equal(r.ok,false);assert.deepEqual(r.keys,['error','ok','requestId']);return r.error};
 if(mode==='production'){
  // No synthetic grant via wire fields; actual signed Worker, untouched flag.
  const r=await p.evaluate(async()=>{
   const w=__qrw.workers.at(-1),file=new Blob([new Uint8Array(16)]),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const attestation={contract:'wand.owner.local.steam-p1g-rust-v1@1',platform:'steam-windows',buildKind:'steam-full-version',fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,originalSha256:hash,evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false};
   const msg={kind:'OPEN_LOCAL_STORED_DIFFGRIDS',file,expectedEncryptedSizeBytes:16,attestation};
   const call=d=>new Promise((ok,bad)=>{const t=setTimeout(()=>bad(Error('DENIAL_TIMEOUT')),10000);const on=e=>{if(e.data?.requestId!==d.requestId)return;clearTimeout(t);w.removeEventListener('message',on);ok(e.data.ok===false&&!e.data.summary)};w.addEventListener('message',on);w.postMessage(d)});
   return [await call({...msg,requestId:9001,allowSyntheticFixture:true}),await call({...msg,requestId:9002,attestation:{...attestation,schema:624}}),await call({...msg,requestId:9003,attestation:{...attestation,evidenceKind:'owner-observed-installed-steam-fullversion',observedOutsideSave:true}})];
  });assert.deepEqual(r,[true,true,true]);
  await deny({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',requestId:9004,selection:999});
  await deny({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',requestId:9005,selection:999,pageIndex:0});
  assert.equal(await panel.locator('[data-diffgrids-count]').count(),0);
  console.log('QRW1009_PRODUCTION_SIGNED_ROUTE_NEW_NEGATIVES_PASS');
 }else{
  await select();await open();await panel.locator('[data-diffgrids-page="1"]').waitFor({timeout:25000});assert.equal(await panel.locator('tbody tr').count(),8);
  a=await audit();const sel=a.reply.find(x=>x.ok&&x.selection)?.selection;assert.ok(sel>0);
  await deny({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',requestId:9001,selection:sel,pageIndex:0});
  await deny({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',requestId:9002,selection:sel+1});
  await panel.locator('[data-diffgrids-next]').click();await panel.locator('[data-diffgrids-page="2"]').waitFor();
  await panel.locator('[data-diffgrids-next]').click();await panel.locator('[data-diffgrids-page="3"]').waitFor();assert.equal(await panel.locator('tbody tr').count(),1);
  await panel.locator('[data-diffgrids-close]').click();await panel.locator('[data-diffgrids-count]').waitFor({state:'detached'});
  await select();await open();await panel.locator('[data-diffgrids-page="1"]').waitFor({timeout:25000});
  await deny({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',requestId:9003,selection:sel});
  await panel.locator('[data-diffgrids-next]').click();await panel.locator('[data-diffgrids-page="2"]').waitFor();
  // Real SPA exit, not artificial DOM removal; observe exact Worker terminate.
  const home=p.locator('a[href="/web/"]:not([data-sveltekit-reload])').first();await home.waitFor();await home.click();await p.waitForURL(origin+'/web/');
  await p.waitForFunction(()=>window.__qrw?.terminated===1,undefined,{timeout:15000});
  assert.equal(await p.locator('[data-steam-diffgrids-readonly]').count(),0);
  await p.goBack();await p.waitForURL('**/editor/steam-reader/');await openPanel();
  a=await audit();assert.equal(a.created,2);assert.equal(a.terminated,1);assert.equal(await panel.locator('[data-diffgrids-count]').count(),0);assert.equal(await panel.locator('[data-diffgrids-open]').isDisabled(),true);
  await select();await open();await panel.locator('[data-diffgrids-page="1"]').waitFor({timeout:25000});await panel.locator('[data-diffgrids-close]').click();
  assert.equal(createHash('sha256').update(await readFile('tests/stage-f/fixtures/synthetic626-diffgrids.p1g')).digest('hex'),sha);
  console.log('QRW1009_ACTUAL_SIGNED_SYNTHETIC_REPLAY_STALE_CLOSE_SPA_TEARDOWN_REOPEN_PASS');
 }
 assert.deepEqual(violations,[]);assert.deepEqual(pageErrors,[]);
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(tmp,{recursive:true,force:true})}
