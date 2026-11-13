// QA-only, actual signed bytes at an isolated HTTPS origin; no private Save.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
const OLD='e6720cb9c0078677180fc4a797359f1584af9a42',S='9659c9c0f1b7d0016c6c9441281315413b236084',B='e3e8a9275f6a2ca3e4ad17d0c3db2f9a6889df9b';
const pins={'src/lib/wep/SteamSavedDiffGridsReadonly.svelte':'98715af1486af81cda3b4658cfe63b27c134aa1d','src/lib/wep/steam-saved-diffgrids.consumer.worker.ts':'8a030e52693ffe62f60dc4359fddba6bbc7f1290','src/routes/editor/steam-reader/+page.svelte':'713cb69bd4f97d58d79d6060470e3b2e98bc4614','src/lib/wep/steam-saved-diffgrids-copy.mjs':'f9664dc59f7595eb40beff0dd66309fbb44c40fe','.github/workflows/08web-steam-saved-diffgrids-real-chrome.yml':'6186f8ba3c6f1415de4ae7f5c32d0a960f44b8f9','tests/protected-readonly-release.test.mjs':'4687dc69dd39670f27ba9203b43f62c6283c293f','tests/web-steam-saved-diffgrids-consumer.test.mjs':'47c3efcb3f1e10252f110577578d5860e31f8472','tests/web-steam-saved-diffgrids-real-chrome.mjs':'4a6e1cdcf1503913c3ab15e6b8bb48d4a1e6c24b'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',S,'HEAD'),S);
assert.deepEqual(git('diff','--name-only',B,S).split('\n').sort(),Object.keys(pins).sort());
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr1009-reselect-close-20261113.yml','A\tscripts/04qr-w-pr1009-reselect-close-independent-20261113.mjs'].sort());
assert.deepEqual(git('diff','--name-status',OLD,S).split('\n').sort(),['M\tsrc/lib/wep/SteamSavedDiffGridsReadonly.svelte','M\ttests/web-steam-saved-diffgrids-real-chrome.mjs'].sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('rev-parse','HEAD:'+p),h);
for(const [p,h] of Object.entries({'src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs':'497685240690005dd7c9bbc8e88ec59e58c06be5','src/lib/wep/steam-saved-diffgrids-ui-client.mjs':'e25be774f939f30a58dc2b2086cec4d22d48260a','src/routes/editor/timing/+page.svelte':'7db3d6119755eeb305b49ae38339d636e40edcf6'}))assert.equal(git('rev-parse','HEAD:'+p),h);
assert.equal(process.argv[2],'synthetic');
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
  const a={created:0,terminated:0,ready:[],reply:[],sent:[],workers:[],hold:null,held:[],release:null};window.__qrw=a;
  const W=window.Worker;window.Worker=new Proxy(W,{construct(t,args){
   const w=Reflect.construct(t,args);
   if(args[1]?.name==='wand-steam-diffgrids-readonly'){
    a.created++;a.workers.push(w);
    w.addEventListener('message',({data:d})=>{if(d?.kind==='DIFFGRIDS_RUNTIME_READY')a.ready.push({ready:d.ready,writer:d.writerAuthorized});else a.reply.push({id:d?.requestId,ok:d?.ok,selection:d?.summary?.selection,error:d?.error,keys:Object.keys(d||{}).sort()})});
    const send=w.postMessage.bind(w);w.postMessage=(d,...rest)=>{a.sent.push({kind:d.kind,id:d.requestId,selection:d.selection});return send(d,...rest)};
    // Delay only delivery of genuine Worker replies to the UI callback.
    // Preserve the real message and actual Rust Worker operation; no forged receipt.
    const descriptor=Object.getOwnPropertyDescriptor(W.prototype,'onmessage');
    let callback=null;
    Object.defineProperty(w,'onmessage',{configurable:true,get:()=>callback,set(fn){
     callback=fn;descriptor.set.call(w,function(e){
      const sent=a.sent.find(x=>x.id===e.data?.requestId);
      if(a.hold&&sent?.kind===a.hold){a.held.push({kind:sent.kind,id:sent.id,ok:e.data.ok,event:e,fn});a.hold=null;return}
      return fn?.call(w,e);
     });
    }});
    a.release=()=>{const list=a.held.splice(0);for(const h of list)h.fn?.call(w,h.event)};
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
 const fixturePath=resolve('tests/stage-f/fixtures/synthetic626-diffgrids.p1g'),fixture=await readFile(fixturePath),sha=createHash('sha256').update(fixture).digest('hex');
 const file=panel.locator('#steam-diffgrids-file'), digest=panel.locator('#steam-diffgrids-sha'), check=panel.locator('input[type=checkbox]'), open=panel.locator('[data-diffgrids-open]'), close=panel.locator('[data-diffgrids-close]');
 async function select(){await file.setInputFiles(fixturePath);await digest.fill(sha);await check.check();}
 async function openFresh(){await select();await open.click({timeout:10000});await panel.locator('[data-diffgrids-page="1"]').waitFor({timeout:25000});}
 async function closeFully(){await close.click();await panel.locator('[data-diffgrids-count]').waitFor({state:'detached'});await p.waitForFunction(()=>document.activeElement?.matches('[data-diffgrids-summary]')&&document.querySelector('#steam-diffgrids-sha')?.value===''&&document.querySelector('[data-steam-diffgrids-readonly] input[type=checkbox]')?.checked===false,undefined,{timeout:15000});}
 // Native same-file selection: reproduce the old actual counterexample,
 // never use DataTransfer or manually dispatch change.
 await file.evaluate(e=>{window.__qrw.fileChanges=0;e.addEventListener('change',()=>window.__qrw.fileChanges++)});
 const waitState=fn=>p.waitForFunction(fn,undefined,{timeout:20000});
 const hold=kind=>p.evaluate(k=>{__qrw.hold=k},kind);
 const held=kind=>p.waitForFunction(k=>__qrw.held.some(x=>x.kind===k&&x.ok===true),kind,{timeout:20000});
 const release=()=>p.evaluate(()=>__qrw.release());
 const barrier=async()=>{
  await waitState(()=>{const p=document.querySelector('[data-diffgrids-manual-only]');return p&&[...p.querySelectorAll('input,button')].every(e=>e.disabled)&&!document.querySelector('[data-diffgrids-count]')});
  assert.equal(await file.evaluate(e=>e.files.length),0);
  assert.equal(await digest.inputValue(),'');assert.equal(await check.isChecked(),false);
 };
 const settled=async()=>{
  await waitState(()=>document.activeElement?.matches('[data-diffgrids-summary]')&&!document.querySelector('#steam-diffgrids-file')?.disabled&&!document.querySelector('[data-diffgrids-count]'));
  assert.equal(await file.evaluate(e=>e.files.length),0);assert.equal(await digest.inputValue(),'');assert.equal(await check.isChecked(),false);assert.equal(await open.isEnabled(),false);
 };
 await openFresh();
 assert.equal(await open.isEnabled(),false,'ACTIVE_OPEN_DISABLED');
 const sel1=(await audit()).reply.find(x=>x.ok&&x.selection)?.selection;assert.ok(sel1>0);
 await hold('CLOSE_LOCAL_STORED_DIFFGRIDS');await close.click();await held('CLOSE_LOCAL_STORED_DIFFGRIDS');await barrier();
 // No native input accepted while closing. A disabled button click cannot
 // start an overlapping OPEN. Check actual wire count.
 const before=(await audit()).sent.length;
 await open.evaluate(e=>e.click());await close.evaluate(e=>e.click());
 assert.equal((await audit()).sent.length,before);
 await release();await settled();
 await openFresh();
 assert.equal(await p.evaluate(()=>__qrw.fileChanges),2,'SAME_FILE_NATIVE_CHANGE_TWICE');
 let r=(await audit()).reply.filter(x=>x.ok&&x.selection);const sel2=r.at(-1).selection;assert.ok(sel2!==sel1);
 console.log('QRW1009_NATIVE_SAME_FILE_CLOSE_BARRIER_PASS');
 // Delay actual second page READ, CLOSE and reopen, release old READ after
 // fresh page1 is visible. No stale page or selection can reappear.
 await hold('READ_LOCAL_STORED_DIFFGRIDS_NEXT');
 await panel.locator('[data-diffgrids-next]').click();await held('READ_LOCAL_STORED_DIFFGRIDS_NEXT');
 await close.click();await settled();
 await openFresh();
 const sel3=(await audit()).reply.filter(x=>x.ok&&x.selection).at(-1).selection;assert.ok(sel3!==sel2);
 await release();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await panel.locator('[data-diffgrids-page="1"]').count(),1);assert.equal(await panel.locator('[data-diffgrids-page="2"]').count(),0);
 await panel.locator('[data-diffgrids-next]').click();await panel.locator('[data-diffgrids-page="2"]').waitFor();
 await closeFully();
 console.log('QRW1009_DELAYED_READ_CLOSE_REOPEN_STALE_PAGE_DENIED');
 // Delay real OPEN reply, cancel it before UI receives selection, open a
 // new session and deliver old reply last. New selection and page survive.
 await select();await hold('OPEN_LOCAL_STORED_DIFFGRIDS');await open.click();await held('OPEN_LOCAL_STORED_DIFFGRIDS');
 await close.click();await settled();
 await openFresh();const beforeRelease=await audit();
 await release();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await panel.locator('[data-diffgrids-page="1"]').count(),1);
 assert.equal(await panel.locator('[data-diffgrids-count]').getAttribute('data-diffgrids-count'),'17');
 assert.equal((await audit()).sent.length,beforeRelease.sent.length,'STALE_OPEN_NO_FOLLOWUP_WIRE');
 assert.equal(await open.isEnabled(),false);
 console.log('QRW1009_DELAYED_OPEN_CANCEL_REOPEN_STALE_RECEIPT_DENIED');
 // Real visible desktop SPA navigation (old mobile hidden locator was
 // harness NOT_RUN). Active Reader must terminate; Back fresh Worker.
 await p.setViewportSize({width:1280,height:800});
 const home=p.locator('a[href="/web/"]:not([data-sveltekit-reload]):visible').first();
 await home.waitFor({state:'visible',timeout:15000});await home.click();await p.waitForURL(origin+'/web/');
 await waitState(()=>window.__qrw?.terminated===1);
 assert.equal(await panel.count(),0);
 await p.goBack();await p.waitForURL('**/editor/steam-reader/');await openPanel();
 a=await audit();assert.equal(a.created,2);assert.equal(a.terminated,1);
 assert.equal(await panel.locator('[data-diffgrids-count]').count(),0);assert.equal(await open.isDisabled(),true);
 assert.equal(await file.evaluate(e=>e.files.length),0);
 await openFresh();await closeFully();
 assert.equal(createHash('sha256').update(await readFile(fixturePath)).digest('hex'),sha);
 assert.deepEqual(violations,[]);assert.deepEqual(pageErrors,[]);
 console.log('QRW1009_ACTUAL_SPA_TEARDOWN_BACK_FRESH_SESSION_PASS');
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(tmp,{recursive:true,force:true})}
