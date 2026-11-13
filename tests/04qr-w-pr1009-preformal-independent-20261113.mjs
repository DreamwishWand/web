// Independent PR1009: reuse the accepted real Chrome HTTPS harness, add
// independent production-negative and actual signed Rust protocol/navigation
// witnesses. PUBLIC synthetic fixture only; no private bytes or deployment.
// 08 WEB R22 public-SYNTHETIC only: REAL installed Chrome, REAL Vite/Svelte
// build, REAL pinned public JS+WASM and accepted Rust Worker; no private Save.
// CI uses the committed scoped preformal route and a temporary synthetic
// attestation/anchor only; never publishes this candidate Pages artifact.
import {createServer} from 'node:https';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));

// Exact source scope and unchanged trust-boundary dependencies.
const fixed='e6720cb9c0078677180fc4a797359f1584af9a42',parent='e3e8a9275f6a2ca3e4ad17d0c3db2f9a6889df9b';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',cwd:root}).trim();
const original=[
['.github/workflows/08web-steam-saved-diffgrids-real-chrome.yml','6186f8ba3c6f1415de4ae7f5c32d0a960f44b8f9','M'],
['src/lib/wep/SteamSavedDiffGridsReadonly.svelte','7e8b81314daffd524efd105638788be1c3be3052','M'],
['src/lib/wep/steam-saved-diffgrids-copy.mjs','f9664dc59f7595eb40beff0dd66309fbb44c40fe','M'],
['src/lib/wep/steam-saved-diffgrids.consumer.worker.ts','8a030e52693ffe62f60dc4359fddba6bbc7f1290','M'],
['src/routes/editor/steam-reader/+page.svelte','713cb69bd4f97d58d79d6060470e3b2e98bc4614','A'],
['tests/protected-readonly-release.test.mjs','4687dc69dd39670f27ba9203b43f62c6283c293f','M'],
['tests/web-steam-saved-diffgrids-consumer.test.mjs','47c3efcb3f1e10252f110577578d5860e31f8472','M'],
['tests/web-steam-saved-diffgrids-real-chrome.mjs','a9968a9eb200b9f81f2295a2b5b1cc0836dffbf7','M']];
assert.equal(git('merge-base',fixed,'HEAD'),fixed);
assert.deepEqual(git('diff','--name-status',parent,fixed).split('\n').sort(),original.map(([p,h,s])=>s+'\t'+p).sort());
for(const [p,h] of original){assert.equal(git('rev-parse',fixed+':'+p),h);assert.equal(git('rev-parse','HEAD:'+p),h)}
for(const [p,h] of [
['src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs','497685240690005dd7c9bbc8e88ec59e58c06be5'],
['src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs','d4253a4ad25d7176f5101bf58db94e58d2b1440c'],
['src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs','ecde2dcaf08889855407e8829d43fe451e908003'],
['src/lib/wep/steam-saved-diffgrids-ui-client.mjs','e25be774f939f30a58dc2b2086cec4d22d48260a'],
['src/routes/editor/timing/+page.svelte','7db3d6119755eeb305b49ae38339d636e40edcf6'],
['.github/workflows/pages.yml','05712e73defe1fadb344cd389905afcc756bbba1']]){
 assert.equal(git('rev-parse',fixed+':'+p),h);assert.equal(git('rev-parse',parent+':'+p),h);
}
assert.equal(git('diff','--name-status',fixed,'HEAD').split('\n').length,2);
console.log('QRW1009_EXACT8_UNCHANGED_TRUST_BOUNDARY_PASS');

const base='/web';
const csp="default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'";
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
  '.wasm':'application/wasm','.json':'application/json','.css':'text/css',
  '.p1g':'application/octet-stream','.svg':'image/svg+xml','.png':'image/png',
  '.woff2':'font/woff2'};
const profile=await mkdtemp(join(tmpdir(),'wand-08web-real-chrome-'));
let chrome,ws,server;
let fault=null,assetRequests=0,mutationRequests=0;
const binary=[process.env.WAND_CHROME_BIN,'google-chrome','google-chrome-stable','chromium'].filter(Boolean)
 .find(bin=>spawnSync('which',[bin],{stdio:'ignore'}).status===0);
if(!binary)throw Error('ENV_WAIT_DEP_CHROME_NOT_INSTALLED');
let seq=0;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++seq;pending.set(id,{resolve,reject});
 ws.send(JSON.stringify({id,method,params}));
});
function serve(req,res){
 if(req.method!=='GET'&&req.method!=='HEAD'){mutationRequests++;res.writeHead(405);res.end();return;}
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
   const asset=suffix.startsWith('/worker-wasm/');
   if(asset)assetRequests++;
   if(asset&&fault==='redirect'&&suffix.endsWith('.js')){res.writeHead(302,{location:'/web/worker-wasm/manifest.json'});res.end();return}
   if(asset&&fault==='manifest'&&suffix.endsWith('manifest.json')){data=Buffer.from(data);data[data.length-1]^=1}
   if(asset&&fault==='wasm'&&suffix.endsWith('.wasm')){data=Buffer.from(data);data[data.length-1]^=1}
   res.writeHead(200,{'content-type':asset&&fault==='mime'&&suffix.endsWith('.js')?'text/html':mime[extname(source)]||'application/octet-stream',
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
  const start=performance.now();
  while(performance.now()-start<timeout){
   const v=check();if(v)return v;
   await new Promise(r=>setTimeout(r,50))
  }
  // Do not dump document text, file inputs, Save fields or session data.
  throw Error('08WEB_WAIT_'+code+' path='+location.pathname+
   ' readyState='+document.readyState+' panelCount='+
   document.querySelectorAll('[data-steam-diffgrids-readonly]').length+
   ' summaryCount='+document.querySelectorAll('[data-diffgrids-summary]').length)
 };
 // Each lookup resolves the current connected panel and its own direct summary.
 // Never retain a panel/summary across hydration or a later asynchronous step.
 const pair=(root=document)=>{
  const panels=root.querySelectorAll('[data-steam-diffgrids-readonly]');
  if(panels.length!==1)return null;
  const panel=panels[0],summaries=panel.querySelectorAll(':scope > [data-diffgrids-summary]');
  if(!panel.isConnected||summaries.length!==1||!summaries[0].isConnected||
     summaries[0].parentElement!==panel)return null;
  return {panel,summary:summaries[0]};
 };
 const currentPair=(code='PANEL_SUMMARY',root=document,timeout=18000)=>
  wait(()=>pair(root),code,timeout);
 const currentElement=(selector,root=document)=>{
  const p=pair(root);if(!p)return null;
  const nodes=p.panel.querySelectorAll(selector);
  return nodes.length===1&&nodes[0].isConnected?nodes[0]:null;
 };
 const element=(selector,code,timeout=18000)=>
  wait(()=>currentElement(selector),code,timeout);
 const present=(selector,code)=>{
  const e=currentElement(selector);need(e,'MISSING_CURRENT_'+code);return e;
 };
 // Deterministic browser-DOM contract, isolated from actual Svelte UI.
 // Delayed summary, replacement of the panel, permanent absence and duplicates.
 // This is not the Reader proof; the real UI path below must still pass.
 await wait(()=>document.body?.isConnected,'DOCUMENT_BODY',18000);
 const fixture=document.createElement('div');
 fixture.hidden=true;document.body.append(fixture);
 const makePanel=()=>{const p=document.createElement('details');
  p.setAttribute('data-steam-diffgrids-readonly','');return p};
 const makeSummary=()=>{const e=document.createElement('summary');
  e.setAttribute('data-diffgrids-summary','');return e};
 try{
  const first=makePanel();fixture.append(first);
  need(pair(fixture)===null,'READINESS_OUTER_ONLY_DENIED');
  const delayed=currentPair('FIXTURE_DELAYED',fixture,1000);
  queueMicrotask(()=>first.append(makeSummary()));
  const initial=await delayed;
  need(initial.panel===first&&initial.summary.isConnected,'READINESS_DELAYED_SUMMARY');
  const second=makePanel();first.replaceWith(second);
  need(!initial.panel.isConnected&&!initial.summary.isConnected&&pair(fixture)===null,'READINESS_STALE_DENIED');
  const replacement=currentPair('FIXTURE_REPLACED',fixture,1000);
  queueMicrotask(()=>second.append(makeSummary()));
  const fresh=await replacement;
  need(fresh.panel===second&&fresh.summary!==initial.summary,'READINESS_REPLACEMENT_RESOLVED');
  second.append(makeSummary());
  need(pair(fixture)===null,'READINESS_DUPLICATE_DENIED');
  second.replaceChildren();
  let missing=false;
  try{await currentPair('FIXTURE_MISSING',fixture,150)}catch(e){
   missing=String(e.message).startsWith('08WEB_WAIT_FIXTURE_MISSING');
  }
  need(missing,'READINESS_MISSING_FAIL_CLOSED');
 }finally{fixture.remove()}
 // Wait for the complete live panel, not just the SSR opening tag.
 const openPanel=async()=>{
  await currentPair();
  const p=pair();need(p,'PANEL_SUMMARY_REPLACED');p.panel.open=true;
 };
 await openPanel();
 need(document.querySelector('[data-steam-diffgrids-readonly]').dataset.preformalRead==='scoped','PREFORMAL_SCOPE');
 need(document.querySelector('[data-steam-diffgrids-readonly]').dataset.productRead==='off','FORMAL_OFF');
 need(document.querySelector('meta[name=robots]')?.content.includes('noindex'),'NOINDEX');
 need(window.innerWidth===320,'VIEWPORT_320');
 const inspect=(element,stage)=>{
  need(element?.isConnected,'MISSING_CURRENT_GEOMETRY_'+stage);
  const r=element.getBoundingClientRect();
  const data={stage,left:r.left,right:r.right,width:r.width,
    viewport:innerWidth,scrollX,scrollY,rootMin:getComputedStyle(document.documentElement).minWidth,
    bodyMin:getComputedStyle(document.body).minWidth};
  need(r.width>0&&r.height>0,'EMPTY_GEOMETRY_'+stage);
  need(r.left>=-1&&r.right<=innerWidth+1,'REFLOW_'+JSON.stringify(data));
  need(Math.abs(scrollX)<=1,'PAGE_SCROLL_X_'+JSON.stringify(data));
  return data;
 };
 // Wait for the actual mounted Worker-ready UI. Hydration may replace SSR
 // nodes and close details; re-open the current panel on each readiness check.
 await wait(()=>{
  const p=pair();if(!p)return false;p.panel.open=true;
  const input=currentElement('#steam-diffgrids-file');
  return input&&!input.disabled&&currentElement('#steam-diffgrids-sha')&&
   currentElement('input[type=checkbox]')&&currentElement('[data-diffgrids-open]');
 },'RUST_SIGNED_PROTECTED_WORKER_READY');
 const localeSelect=await wait(()=>document.querySelector('#site-locale'),'LOCALE_SELECT');
 const expectedTitles=['Steam 1.25.3 · Pre-release read-only test','Steam 1.25.3 · Test en lecture seule avant publication','Steam 1.25.3 · Test in sola lettura prima del rilascio','Steam 1.25.3 · Schreibgeschützter Vorabtest','Steam 1.25.3 · Prueba de solo lectura previa al lanzamiento','Steam 1.25.3 · 正式リリース前の読み取り専用テスト','Steam 1.25.3 · 正式发布前只读测试','Steam 1.25.3 · Teste somente leitura antes do lançamento'];
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(let i=0;i<locales.length;i++){
  localeSelect.value=locales[i];localeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>document.querySelector('[data-preformal-steam-reader] h1')?.textContent.trim()===expectedTitles[i],'LOCALE_'+locales[i],5000);
  need(!document.querySelector('[data-diffgrids-count]'),'LOCALE_NO_AUTO_READ');
 }
 localeSelect.value='en';localeSelect.dispatchEvent(new Event('change',{bubbles:true}));
 await wait(()=>document.querySelector('[data-preformal-steam-reader] h1')?.textContent.trim()===expectedTitles[0],'LOCALE_EN_RESET',5000);
 const baseline=inspect(present('[data-diffgrids-summary]','SUMMARY_100'),'320_ROOT_ZOOM100');
 document.documentElement.style.zoom='2';
 inspect(present('[data-diffgrids-summary]','SUMMARY_200'),'320_ROOT_ZOOM200_CLOSED_MANUAL_PANEL');
 // Initial state: no implicit local Save read / no session.
 need(!document.querySelector('[data-diffgrids-count]'),'NO_AUTO_SAVE');
 const response=await Promise.all([
  fetch('/web/__synthetic__/synthetic626-diffgrids.p1g',{cache:'no-store'}),
  fetch('/web/__synthetic__/expected-diffgrids.json',{cache:'no-store'})
 ]);
 need(response.every(x=>x.ok),'SYNTHETIC_ONLY_FIXTURE');
 const expected=await response[1].json(),file=new File(
  [await response[0].arrayBuffer()],'synthetic-ci-only.p1g',
  {type:'application/octet-stream'});
 need(expected.syntheticOnly===true&&file.size===expected.sourceBytes,'P1G_SOURCE_SIZE');
 const fileSha=async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
 need(await fileSha()===expected.originalSha256,'ORIGINAL_SHA_BEFORE');
 const dt=new DataTransfer();dt.items.add(file);
 const select=(digest)=>{
  const input=present('#steam-diffgrids-file','FILE');need(!input.disabled,'FILE_DISABLED');
  input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  setSha(digest);
  const check=present('input[type=checkbox]','CONFIRM');
  check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
 };
 const setSha=digest=>{const sha=present('#steam-diffgrids-sha','SHA');
  sha.value=digest;sha.dispatchEvent(new Event('input',{bubbles:true}));};
 const click=async(selector,code)=>{await element(selector,code);present(selector,code).click()};
 select(expected.originalSha256);
 await element('[data-diffgrids-open]:not([disabled])','MANUAL_OPEN');
 need(!document.querySelector('[data-diffgrids-count]'),'NO_READ_BEFORE_CLICK');
 present('[data-diffgrids-open]:not([disabled])','MANUAL_OPEN').click();
 const pages=[];
 for(let page=1;page<=3;page++){
  const selector='[data-diffgrids-page="'+page+'"]';
  await element(selector,'PAGE_'+page);
  const result=present(selector,'PAGE_'+page);
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
   await click('[data-diffgrids-next]:not([disabled])','NEXT');
  }
 }
 need(pages.join(',')==='8,8,1','THREE_PAGES');
 present('[data-diffgrids-summary]','SUMMARY_SCROLL').scrollIntoView({block:'center',inline:'nearest'});
 await new Promise(r=>setTimeout(r,100));
 const afterScroll=inspect(present('[data-diffgrids-summary]','SUMMARY_AFTER_SCROLL'),'320_ROOT_ZOOM200_AFTER_VERTICAL_SCROLL');
 inspect(present('.controls','CONTROLS'),'320_ROOT_ZOOM200_MANUAL_CONTROLS');
 inspect(present('#steam-diffgrids-file','FILE'),'320_ROOT_ZOOM200_FILE_PICKER');
 inspect(present('#steam-diffgrids-sha','SHA'),'320_ROOT_ZOOM200_SHA_INPUT');
 const gridScroller=present('.table-scroller','TABLE');
 inspect(gridScroller,'320_ROOT_ZOOM200_TABLE_CONTAINER');
 gridScroller.scrollLeft=80;
 need(gridScroller.scrollLeft>0,'FIVE_COLUMN_TABLE_INNER_SCROLL');
 need(Math.abs(scrollX)<=1,'TABLE_SCROLL_DID_NOT_MOVE_PAGE');
 const livePair=pair();need(livePair,'MISSING_CURRENT_PANEL_PRIVACY');
 const whole=livePair.panel.textContent;
 for(const prohibited of ['OPAQUE_SYNTHETIC_NEVER_TO_UI','PRIVATE_SYNTHETIC_PATH_NEVER_TO_UI',
  'PRIVATE_SYNTHETIC_OBJECT_NEVER_TO_UI','decodedSha256','sessionId','nextCursor']){
  need(!whole.includes(prohibited),'NO_PRIVATE_'+prohibited);
 }
 await click('[data-diffgrids-close]','CLOSE_BUTTON');
 await wait(()=>pair()&&!pair().panel.querySelector('[data-diffgrids-count]'),'CLOSE');
 await wait(()=>pair()?.summary===document.activeElement,'FOCUS_RESTORED',18000);
 need(document.activeElement===present('[data-diffgrids-summary]','FOCUS'),'FOCUS_RESTORED');
 need(!document.querySelector('[data-diffgrids-next]'),'NO_STALE_PAGE_AFTER_CLOSE');
 need(document.activeElement.tabIndex>=0,'NATIVE_KEYBOARD_SUMMARY');
 // Bad externally supplied original SHA must never resurrect the closed
 // ProductSession; a fresh explicit selection is required to try again.
 select('0'.repeat(64));
 await click('[data-diffgrids-open]:not([disabled])','BAD_SHA_OPEN_READY');
 await element('[data-diffgrids-error]','BAD_SHA_FAILCLOSED',25000);
 need(!document.querySelector('[data-diffgrids-count]'),'BAD_SHA_NO_SESSION');
 // Reopening requires the correct original SHA, not an old Rust cursor.
 setSha(expected.originalSha256);
 await click('[data-diffgrids-open]:not([disabled])','REOPEN_READY');
 await element('[data-diffgrids-count="17"]','REOPEN_NEW_SESSION',25000);
 await click('[data-diffgrids-close]','REOPEN_CLOSE_BUTTON');
 await wait(()=>pair()&&!pair().panel.querySelector('[data-diffgrids-count]'),'REOPEN_CLOSE');
 need(await fileSha()===expected.originalSha256&&file.size===expected.sourceBytes,'ORIGINAL_SHA_AFTER');
 return {result:'08WEB_REAL_SIGNED_PUBLIC_RUST_WASM_CHROME_TYPED_CONSUMER_PASS',
  allEightLocales:true,originalImmutable:true,
  pages:pages.join(','),viewport320:true,zoom200:true,geometry100:baseline,
  geometry200:afterScroll,innerTableScroll:true,badShaDenied:true,reopenFresh:true,keyboard:true,gridIdZeroLiteral:true,manualClickOnly:true,
  sameRustWorker:true,strictUiMetadata:true,closed:true,focusRestored:true,
  readinessContract:true,realPrivateSave:false,writerAuthorized:false,productEnabled:false};
})()
`;
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem')],{stdio:'ignore'});
 server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},serve);
 await new Promise((r,j)=>{server.once('error',j);server.listen(19443,'127.0.0.1',r)});
 const port=server.address().port;
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--ignore-certificate-errors','--remote-allow-origins=*','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await attach();await rpc('Page.enable');await rpc('Runtime.enable');
 await rpc('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:false});
 // The regular Timing route must not instantiate the Steam Worker or load
 // signed reader assets, even with a valid preformal anchor in this build.
 await rpc('Page.navigate',{url:'https://127.0.0.1:'+port+'/web/editor/timing/'});
 const outside=await rpc('Runtime.evaluate',{expression:`(async()=>{
  const end=performance.now()+18000;
  while(performance.now()<end){
   const p=document.querySelector('[data-steam-diffgrids-readonly]');
   if(location.pathname==='/web/editor/timing/'&&p?.querySelector('summary')){
    p.open=true;await new Promise(r=>setTimeout(r,500));
    const q=document.querySelector('[data-steam-diffgrids-readonly]');
    return q?.dataset.preformalRead==='off'&&
      !q.querySelector('#steam-diffgrids-file')&&
      !!q.querySelector('a[href$="/editor/steam-reader/"]');
   }
   await new Promise(r=>setTimeout(r,50));
  }
  return false;
 })()`,awaitPromise:true,returnByValue:true});
 assert.equal(outside.result?.value,true,'ORDINARY_TIMING_NO_STEAM_CONTROLS');
 assert.equal(assetRequests,0,'ORDINARY_TIMING_NO_SIGNED_READER_ASSETS');
 console.log('08WEB_PREFORMAL_ROUTE_ISOLATION_PASS');
 await rpc('Page.navigate',{url:'https://127.0.0.1:'+port+'/web/editor/steam-reader/'});
 for(let n=0;n<200;n++){
  try{const r=await rpc('Runtime.evaluate',{expression:'location.pathname',returnByValue:true});
    if(r.result?.value==='/web/editor/steam-reader/')break}catch{}
  await delay(40);
 }

 // Independently exercise actual signed bundled Worker messages, with a real
 // synthetic encrypted P1G generated by the accepted fixture generator.
 // Only the explicitly test-only attestation build accepts synthetic claims.
 const production=process.env.WAND_PREFORMAL_PRODUCTION_NEGATIVE==='1';
 const actualAnchor=(await import('../src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs')).PROTECTED_READONLY_RELEASE_ANCHOR;
 const actualWorkers=[];
 for(const name of await readdir(join(root,'build/_app'),{recursive:true})){
  if(!name.endsWith('.js'))continue;
  const body=await readFile(join(root,'build/_app',name),'utf8');
  if(body.includes('DIFFGRIDS_PRODUCT_LOADER_RECEIPT_DENIED')&&body.includes('DIFFGRIDS_RUNTIME_READY')){
   assert.ok(body.includes(actualAnchor.releaseId),'INDEPENDENT_ANCHOR_ID');
   actualWorkers.push('/web/_app/'+name.replaceAll('\\','/'));
  }
 }
 assert.equal(actualWorkers.length,1,'INDEPENDENT_SINGLE_WORKER_BLOB');
 const probe=String.raw`
 (async()=>{
  const need=(x,k)=>{if(!x)throw Error('QRW1009_'+k)};
  const wait=async(fn,k)=>{const end=performance.now()+25000;while(performance.now()<end){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,40))}throw Error('QRW1009_WAIT_'+k)};
  const panel=await wait(()=>{const p=document.querySelector('[data-steam-diffgrids-readonly]');if(p){p.open=true;return p.querySelector('#steam-diffgrids-file')&&p}},'READY');
  need(panel.dataset.productRead==='off'&&panel.dataset.writer==='off'&&panel.dataset.cloud==='off','OFF_FLAGS');
  need(panel.dataset.preformalRead==='scoped','SCOPED_ROUTE');
  const bytes=await (await fetch('/web/__synthetic__/synthetic626-diffgrids.p1g',{cache:'no-store'})).arrayBuffer();
  const file=new File([bytes],'qa-synthetic-only.p1g',{type:'application/octet-stream'});
  const sha=async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const digest=await sha();
  const att={contract:'wand.owner.local.steam-p1g-rust-v1@1',platform:'steam-windows',buildKind:'steam-full-version',fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,originalSha256:digest,evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false};
  const w=new Worker(WORKER_PATH,{type:'module',name:'qrw1009-independent-wire'});
  const pending=new Map();let next=0;let readyResolve,readyReject;
  const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j});
  const unknown=[];
  w.onmessage=e=>{
   const d=e.data;
   if(d?.kind==='DIFFGRIDS_RUNTIME_READY'){readyResolve(d);return}
   const p=pending.get(d?.requestId);
   if(!p){unknown.push(d?.requestId);return}
   pending.delete(d.requestId);clearTimeout(p.timer);p.resolve(d);
  };
  w.onerror=()=>readyReject(Error('QRW1009_WORKER_ERROR'));
  const send=(kind,fields={})=>{
   const requestId=++next;
   const promise=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('QRW1009_WIRE_TIMEOUT'))},20000);
    pending.set(requestId,{resolve,timer});w.postMessage({kind,requestId,...fields});
   });return {requestId,promise};
  };
  const call=async(k,f)=>{const p=send(k,f),r=await p.promise;need(r.requestId===p.requestId,'REQUEST_CORRELATION');return r};
  const fail=(r,code)=>{need(r.ok===false&&r.error===code&&!r.summary&&Object.keys(r).sort().join(',')==='error,ok,requestId','EXPECTED_'+code)};
  const openFields={file,expectedEncryptedSizeBytes:file.size,attestation:att};
  const open=()=>call('OPEN_LOCAL_STORED_DIFFGRIDS',openFields);
  const read=(selection,pageIndex)=>call('READ_LOCAL_STORED_DIFFGRIDS_NEXT',{selection,pageIndex});
  const close=selection=>call('CLOSE_LOCAL_STORED_DIFFGRIDS',{selection});
  const checkOpen=r=>{
   need(r.ok===true&&r.summary?.recordCount===17&&r.summary.maxRecordsPerPage===8,'OPEN_17');
   const s=r.summary;
   for(const k of ['writerAuthorized','applyAuthorized','productReadAccepted','cloudUploadPerformed','originalFileModified','physicalBuildCryptographicallyVerified','nativeV3Verified','allNativeReferencesVerified'])need(s[k]===false,'OPEN_FLAG_'+k);
   for(const k of ['sessionId','revision','decodedSha256','nextCursor','raw','encryptedBytes'])need(!(k in s),'OPEN_NO_PRIVATE_'+k);
   return s.selection;
  };
  const checkPage=(r,sel,index,count)=>{
   const s=r.summary;need(r.ok===true&&s.selection===sel&&s.pageIndex===index&&s.records.length===count,'PAGE_'+index);
   for(const k of ['writerAuthorized','applyAuthorized','productReadAccepted','cloudUploadPerformed','nativeV3Verified','allNativeReferencesVerified'])need(s[k]===false,'PAGE_FLAG_'+k);
   need(s.nextPageIndex===(index===2?null:index+1),'NEXT_'+index);
   need(!('nextCursor' in s)&&!('sessionId' in s),'PAGE_PRIVATE');
  };
  try{
   const rt=await Promise.race([ready,new Promise((_,j)=>setTimeout(()=>j(Error('QRW1009_READY_TIMEOUT')),20000))]);
   need(rt.ready===true&&rt.writerAuthorized===false,'WIRE_READY');
   fail(await read(123,0),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
   fail(await call('OPEN_LOCAL_STORED_DIFFGRIDS',{...openFields,attestation:{...att,platform:'switch'}}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
   fail(await call('OPEN_LOCAL_STORED_DIFFGRIDS',{...openFields,attestation:{...att,fullVersion:'1.25.0',schema:624}}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
   fail(await call('OPEN_LOCAL_STORED_DIFFGRIDS',{...openFields,attestation:{...att,ownerAuthorized:true}}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
   fail(await call('OPEN_LOCAL_STORED_DIFFGRIDS',{...openFields,expectedEncryptedSizeBytes:file.size+16}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
   fail(await call('OPEN_LOCAL_STORED_DIFFGRIDS',{...openFields,sessionId:'forged'}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
   if(PRODUCTION){
    fail(await open(),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
    fail(await call('OPEN_LOCAL_STORED_DIFFGRIDS',{...openFields,attestation:{...att,evidenceKind:'owner-observed-installed-steam-fullversion',observedOutsideSave:true,originalSha256:'0'.repeat(64)}}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');
    fail(await read(1,0),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
   }else{
    const a=send('OPEN_LOCAL_STORED_DIFFGRIDS',openFields);
    const b=send('OPEN_LOCAL_STORED_DIFFGRIDS',openFields);
    const [ra,rb]=await Promise.all([a.promise,b.promise]);
    fail(ra,'LOCAL_DIFFGRIDS_OPEN_SUPERSEDED');
    const sel=checkOpen(rb);
    checkPage(await read(sel,0),sel,0,8);
    fail(await read(sel,0),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
    fail(await read(sel+1,1),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
    fail(await close(sel+1),'LOCAL_DIFFGRIDS_STALE_SELECTION');
    // Unsupported write/export/remote operations have no handler. A valid
    // subsequent read is a FIFO barrier; none may yield a receipt.
    const badIds=[];
    for(const kind of ['WRITE_LOCAL_STORED_DIFFGRIDS','EXPORT_EDITED_COPY','UPLOAD_SAVE','OPEN_REMOTE_URL']){
     const requestId=++next;badIds.push(requestId);w.postMessage({kind,requestId,selection:sel});
    }
    checkPage(await read(sel,1),sel,1,8);
    checkPage(await read(sel,2),sel,2,1);
    need(!unknown.some(x=>badIds.includes(x)),'UNSUPPORTED_OPERATION_REPLY');
    fail(await read(sel,3),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
    const c=await close(sel);need(c.ok===true&&c.summary.closed===true&&c.summary.writerAuthorized===false,'CLOSE');
    fail(await read(sel,0),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
    const newer=checkOpen(await open());need(newer!==sel,'NEW_SELECTION');
    fail(await close(sel),'LOCAL_DIFFGRIDS_STALE_SELECTION');
    checkPage(await read(newer,0),newer,0,8);
    need((await close(newer)).ok===true,'CLOSE_NEWER');
   }
   need(await sha()===digest,'ORIGINAL_IMMUTABLE');
   return {production:PRODUCTION,wire:true,originalImmutable:true,unsupportedNoReceipt:true};
  }finally{for(const p of pending.values())clearTimeout(p.timer);w.terminate()}
 })()
 `.replace('WORKER_PATH',JSON.stringify(actualWorkers[0])).replaceAll('PRODUCTION',String(production));
 const witness=await rpc('Runtime.evaluate',{expression:probe,awaitPromise:true,returnByValue:true});
 if(witness.exceptionDetails)throw Error(String(witness.exceptionDetails.exception?.description||witness.exceptionDetails.text).slice(0,1000));
 assert.deepEqual(witness.result.value,{production,wire:true,originalImmutable:true,unsupportedNoReceipt:true});
 console.log(production?'QRW1009_PRODUCTION_REAL_SYNTHETIC_ATTESTATION_AND_AUTHORITY_NEGATIVES_PASS':'QRW1009_SIGNED_RUST_WIRE_CONCURRENT_OPEN_REPLAY_CLOSE_UNSUPPORTED_PASS');

 if(process.env.WAND_PREFORMAL_PRODUCTION_NEGATIVE==='1'){
  // Unmodified production worker/client with only a verified historical
  // test-origin anchor. Synthetic attestation must NOT be accepted here.
  const anchor=(await import('../src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs')).PROTECTED_READONLY_RELEASE_ANCHOR;
  const candidates=[];
  for(const name of await readdir(join(root,'build/_app'),{recursive:true})){
   if(!name.endsWith('.js'))continue;
   const body=await readFile(join(root,'build/_app',name),'utf8');
   if(body.includes('DIFFGRIDS_PRODUCT_LOADER_RECEIPT_DENIED')&&body.includes('DIFFGRIDS_RUNTIME_READY')){
    assert.ok(body.includes(anchor.releaseId),'PRODUCTION_ANCHOR_ID');
    candidates.push('/web/_app/'+name.replaceAll('\\\\','/'));
   }
  }
  assert.equal(candidates.length,1,'ONE_PRODUCTION_CONSUMER_WORKER');
  const expression=`(async()=>{
   const end=performance.now()+18000;
   while(performance.now()<end&&!document.querySelector('[data-diffgrids-manual-only]'))
    await new Promise(r=>setTimeout(r,50));
   if(!document.querySelector('[data-diffgrids-manual-only]'))throw Error('PRODUCTION_ROUTE_NOT_READY');
   const w=new Worker(`+JSON.stringify(candidates[0])+`,{type:'module'});
   const recv=()=>new Promise((resolve,reject)=>{
    const t=setTimeout(()=>reject(Error('PRODUCTION_NEGATIVE_TIMEOUT')),15000);
    w.onmessage=e=>{clearTimeout(t);resolve(e.data)};
    w.onerror=()=>{clearTimeout(t);reject(Error('PRODUCTION_NEGATIVE_WORKER_ERROR'))};
   });
   try{
    const ready=await recv();
    if(ready.kind!=='DIFFGRIDS_RUNTIME_READY'||ready.ready!==true||ready.writerAuthorized!==false)throw Error('PRODUCTION_READY');
    const file=new Blob([new Uint8Array(16)]);
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const attestation={contract:'wand.owner.local.steam-p1g-rust-v1@1',platform:'steam-windows',buildKind:'steam-full-version',
     fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,originalSha256:sha,
     evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false};
    const call=async(data)=>{const p=recv();w.postMessage(data);const r=await p;if(r.requestId!==data.requestId||r.ok!==false||r.summary)throw Error('FALSE_ACCEPT');return r.error};
    const msg={kind:'OPEN_LOCAL_STORED_DIFFGRIDS',file,expectedEncryptedSizeBytes:16,attestation};
    const synthetic=await call({...msg,requestId:1});
    const wrong=await call({...msg,requestId:2,attestation:{...attestation,platform:'switch',fullVersion:'1.25.3'}});
    const foreign=await call({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',requestId:3,selection:99,pageIndex:0});
    const forged=await call({...msg,requestId:4,sessionId:'foreign'});
    return {synthetic,wrong,foreign,forged};
   }finally{w.terminate()}
  })()`;
  const r=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  assert.equal(r.exceptionDetails,undefined,'PRODUCTION_NEGATIVE_EXCEPTION');
  assert.deepEqual(r.result?.value,{synthetic:'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED',wrong:'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED',foreign:'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY',forged:'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED'});
  assert.equal(mutationRequests,0);
  console.log('08WEB_PREFORMAL_UNPATCHED_PRODUCTION_SYNTHETIC_WRONG_BUILD_FOREIGN_ABI_DENIED');
 }else{
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
   'closed','focusRestored','gridIdZeroLiteral','viewport320','zoom200','badShaDenied','reopenFresh','keyboard','readinessContract'])assert.equal(result[k],true,k);
 assert.equal(result.pages,'8,8,1');
 assert.equal(result.allEightLocales,true);assert.equal(result.originalImmutable,true);
 assert.equal(result.innerTableScroll,true,'5_COLUMN_TABLE_SCROLL_INTERNAL');
 const zoomRects=[result.geometry100,result.geometry200];
 for(const box of zoomRects){
  assert.equal(box.viewport,320,'PHYSICAL_320_VIEWPORT');
  assert.ok(box.left>=-1&&box.right<=321,'PHYSICAL_REFLOW_NO_CLIP');
  assert.ok(Math.abs(box.scrollX)<=1,'PAGE_NO_HORIZONTAL_SCROLL');
 }
 await rpc('Runtime.evaluate',{expression:"document.documentElement.style.zoom='1'",
   returnByValue:true});
 await rpc('Emulation.setDeviceMetricsOverride',
   {width:1280,height:800,deviceScaleFactor:1,mobile:false});
 const desktop=await rpc('Runtime.evaluate',{expression:`(async()=>{
  const start=performance.now();
  while(performance.now()-start<18000){
   const panels=document.querySelectorAll('[data-steam-diffgrids-readonly]');
   const summaries=panels.length===1?panels[0].querySelectorAll(':scope > [data-diffgrids-summary]'):[];
   const e=summaries.length===1?summaries[0]:null;
   if(e?.isConnected){const r=e.getBoundingClientRect();if(r.width>0&&r.height>0)
    return {left:r.left,right:r.right,viewport:innerWidth,scrollX};}
   await new Promise(r=>setTimeout(r,50));
  }
  throw Error('08WEB_WAIT_DESKTOP_CURRENT_SUMMARY');
 })()`,awaitPromise:true,returnByValue:true});
 const d=desktop.result?.value;
 assert.ok(d&&d.viewport===1280&&d.left>=-1&&d.right<=1281&&Math.abs(d.scrollX)<=1,
   'DESKTOP_NO_PAGE_HORIZONTAL_OVERFLOW');
 for(const k of ['realPrivateSave','writerAuthorized','productEnabled'])
  assert.equal(result[k],false,k);
 // Inspect the actual bundled Worker, not a mock loader or handwritten module.
 const anchor=(await import('../src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs')).PROTECTED_READONLY_RELEASE_ANCHOR;
 const candidates=[];
 for(const name of await readdir(join(root,'build/_app'),{recursive:true})){
  if(!name.endsWith('.js'))continue;
  const body=await readFile(join(root,'build/_app',name),'utf8');
  if(body.includes('DIFFGRIDS_PRODUCT_LOADER_RECEIPT_DENIED')&&body.includes('DIFFGRIDS_RUNTIME_READY')){
   assert.ok(body.includes(anchor.releaseId),'BUILT_CONSUMER_RELEASE_ID');
   assert.ok(body.includes('wand.r22.protected-readonly-loader-receipt@1'),'BUILT_PROTECTED_LOADER');
   candidates.push('/web/_app/'+name.replaceAll('\\\\','/'));
  }
 }
 assert.equal(candidates.length,1,'ONE_BUILT_CONSUMER_WORKER');
 for(const mode of ['manifest','wasm','mime','redirect']){
  fault=mode;const before=assetRequests;
  const expression='new Promise((resolve,reject)=>{const w=new Worker('+JSON.stringify(candidates[0])+',{type:"module"});const timer=setTimeout(()=>{w.terminate();reject(Error("NEGATIVE_WORKER_TIMEOUT"))},15000);w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve(e.data)};w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error(e.message))}})';
  const denied=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  assert.equal(denied.exceptionDetails,undefined,mode);
  assert.deepEqual(denied.result.value,{kind:'DIFFGRIDS_RUNTIME_READY',ready:false,writerAuthorized:false},mode);
  assert.ok(assetRequests>before,'REAL_ASSET_REQUEST_'+mode);
 }
 fault=null;
 console.log('08WEB_DOM_READINESS_DELAYED_REPLACED_MISSING_DUPLICATE_PASS');
 console.log('08WEB_BUILT_PROTECTED_CONSUMER_SIGNED_BYTES_4NEG_PASS');
 console.log('08WEB_REAL_SIGNED_PUBLIC_RUST_WASM_CHROME_TYPED_CONSUMER_PASS',
  {pages:result.pages,signedPublicAssetBytes:true,privateSave:false,
    consumerProductOwnerFlag:false,preformalReaderScope:true,physical320Css100:result.geometry100,
    physical320Css200AfterVerticalScroll:result.geometry200,
    physicalDesktopCss100:d,innerTableScroll:result.innerTableScroll,allEightLocales:true,originalImmutable:true});
 assert.equal(mutationRequests,0,'NO_LOCAL_SAVE_MUTATION_HTTP_REQUEST');
 }

 // Actual hard navigation leaves the dedicated Reader document and its
 // Worker. Return through ordinary Timing, with no signed asset request.
 const beforeNav=await rpc('Runtime.evaluate',{expression:'performance.timeOrigin',returnByValue:true});
 const beforeAssets=assetRequests;
 const beforeTargets=await rpc('Target.getTargets');
 const readerTargets=beforeTargets.targetInfos.filter(t=>t.type==='worker'&&t.url.includes('steam-saved-diffgrids'));
 const leave=await rpc('Runtime.evaluate',{expression:"(()=>{const a=document.querySelector('[data-preformal-steam-reader] > a');if(!a||!a.hasAttribute('data-sveltekit-reload'))throw Error('QRW1009_LEAVE_LINK');a.click();return true})()",returnByValue:true});
 assert.equal(leave.result.value,true);
 let left=false;
 for(let n=0;n<300;n++){
  try{const r=await rpc('Runtime.evaluate',{expression:'({path:location.pathname,origin:performance.timeOrigin})',returnByValue:true});
   if(r.result?.value?.path==='/web/editor/'&&r.result.value.origin!==beforeNav.result.value){left=true;break}
  }catch{}await delay(50);
 }
 assert.ok(left,'QRW1009_HARD_NAVIGATION_NEW_DOCUMENT');
 await rpc('Page.navigate',{url:'https://127.0.0.1:'+port+'/web/editor/timing/'});
 const after=await rpc('Runtime.evaluate',{expression:"(async()=>{const end=performance.now()+18000;while(performance.now()<end){const p=document.querySelector('[data-steam-diffgrids-readonly]');if(location.pathname==='/web/editor/timing/'&&p?.querySelector('summary')){p.open=true;await new Promise(r=>setTimeout(r,600));const q=document.querySelector('[data-steam-diffgrids-readonly]');return q?.dataset.preformalRead==='off'&&!q.querySelector('#steam-diffgrids-file')&&!q.querySelector('[data-diffgrids-count]')}await new Promise(r=>setTimeout(r,50))}return false})()",awaitPromise:true,returnByValue:true});
 assert.equal(after.result.value,true,'QRW1009_RETURN_TIMING_OFF');
 assert.equal(assetRequests,beforeAssets,'QRW1009_NO_ASSETS_AFTER_LEAVING');
 const afterTargets=await rpc('Target.getTargets');
 for(const t of readerTargets)assert.ok(!afterTargets.targetInfos.some(x=>x.targetId===t.targetId),'QRW1009_READER_WORKER_RETAINED');
 assert.equal(mutationRequests,0);
 console.log('QRW1009_HARD_NAVIGATION_RETURN_TIMING_OFF_NO_TRANSFER_PASS');

}catch(e){console.error('08WEB_REAL_CHROME_FAIL',String(e?.stack||e).slice(0,1800));process.exitCode=1}
finally{
 for(const p of pending.values())p.reject(Error('CDP_CLOSED'));pending.clear();
 try{ws?.close()}catch{}
 if(chrome){chrome.kill('SIGTERM');await delay(250);
   if(chrome.exitCode===null)chrome.kill('SIGKILL')}
 if(server)await new Promise(r=>server.close(r));
 await rm(profile,{recursive:true,force:true,maxRetries:3});
}
