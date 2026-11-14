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
const base='/web';
// Preserve the real finite release tuple while serving only isolated local bytes.
const testOrigin='https://dreamwishwand.github.io';
const isolatedHost='dreamwishwand.github.io';
let isolatedRouteRequests=0;
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
 if(req.headers.host!==isolatedHost||req.socket.remoteAddress!=='127.0.0.1'){res.writeHead(403);res.end();return;}
 if(req.url===base+'/editor/steam-reader/'||req.url===base+'/editor/timing/')isolatedRouteRequests++;
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
 // Dedicated Reader exposes manual controls on first visit. Do not
 // programmatically open the disclosure: assert actual default behavior.
 const initialPanel=await currentPair();
 need(initialPanel.panel.open,'DEDICATED_DEFAULT_OPEN');
 need(!initialPanel.panel.querySelector('[data-diffgrids-count]'),'DEDICATED_NO_AUTO_READ');
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
 // Wait for the actual mounted Worker-ready UI, without forcing open.
 await wait(()=>{
  const p=pair();if(!p||!p.panel.open)return false;
  const input=currentElement('#steam-diffgrids-file');
  return input&&!input.disabled&&input.getBoundingClientRect().height>0&&currentElement('#steam-diffgrids-sha')&&
   currentElement('input[type=checkbox]')&&currentElement('[data-diffgrids-open]');
 },'RUST_SIGNED_PROTECTED_WORKER_READY');
 need(present('[data-diffgrids-open]','DEFAULT_OPEN_ACTION').disabled,'NO_IMPLICIT_OPEN_AUTHORITY');
 need(present('#steam-diffgrids-file','DEFAULT_FILE').files.length===0,'NO_IMPLICIT_FILE');
 // Users may still collapse/re-expand by native keyboard disclosure.
 const disclosure=present('[data-diffgrids-summary]','DEFAULT_SUMMARY');
 disclosure.click();need(!pair().panel.open,'MANUAL_COLLAPSE');
 disclosure.click();need(pair().panel.open,'MANUAL_REEXPAND');
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
 need(!document.querySelector('[data-diffgrids-backup]'),'NO_BACKUP_BEFORE_OPEN');
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
 const select=(digest)=>{
  const input=present('#steam-diffgrids-file','FILE');need(!input.disabled,'FILE_DISABLED');
  const fresh=new DataTransfer();fresh.items.add(file);
  input.files=fresh.files;need(input.files.length===1,'FRESH_SYNTHETIC_FILE_LIST');input.dispatchEvent(new Event('change',{bubbles:true}));
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
 const backup=present('[data-diffgrids-backup-download]','BACKUP_DOWNLOAD');
 need(!backup.disabled,'BACKUP_AVAILABLE_AFTER_OPEN');
 const chooseBackup=async(candidate,status)=>{
  const input=present('#steam-diffgrids-backup-file','BACKUP_CANDIDATE');
  const dt=new DataTransfer();dt.items.add(candidate);input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await element('[data-diffgrids-backup-status="'+status+'"]','BACKUP_'+status);
 };
 await chooseBackup(new File([await file.arrayBuffer()],'candidate.p1g'),'backupMatched');
 const changed=new Uint8Array(await file.arrayBuffer());changed[0]^=1;
 await chooseBackup(new File([changed],'wrong.p1g'),'backupRejected');
 await chooseBackup(new File([await file.arrayBuffer()],'candidate.p1g'),'backupMatched');
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
 await wait(()=>pair()?.summary===document.activeElement&&currentElement('#steam-diffgrids-file')&&!currentElement('#steam-diffgrids-file').disabled,'FOCUS_RESTORED',18000);
 need(document.activeElement===present('[data-diffgrids-summary]','FOCUS'),'FOCUS_RESTORED');
 need(!document.querySelector('[data-diffgrids-next]'),'NO_STALE_PAGE_AFTER_CLOSE');
 need(!document.querySelector('[data-diffgrids-backup]'),'NO_STALE_BACKUP_AFTER_CLOSE');
 need(document.activeElement.tabIndex>=0,'NATIVE_KEYBOARD_SUMMARY');
 // Bad externally supplied original SHA must never resurrect the closed
 // ProductSession; a fresh explicit selection is required to try again.
 select('0'.repeat(64));
 await click('[data-diffgrids-open]:not([disabled])','BAD_SHA_OPEN_READY');
 await element('[data-diffgrids-error]','BAD_SHA_FAILCLOSED',25000);
 need(!document.querySelector('[data-diffgrids-count]'),'BAD_SHA_NO_SESSION');
 await element('#steam-diffgrids-sha:not([disabled])','BAD_SHA_CLOSE_SETTLED');
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
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=dreamwishwand.github.io','-keyout',join(profile,'key.pem'),'-out',join(profile,'cert.pem')],{stdio:'ignore'});
 server=createServer({key:await readFile(join(profile,'key.pem')),cert:await readFile(join(profile,'cert.pem'))},serve);
 await new Promise((r,j)=>{server.once('error',j);server.listen(19443,'127.0.0.1',r)});
 const port=server.address().port;
 assert.equal(port,19443,'ISOLATED_TLS_PORT');
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--ignore-certificate-errors','--remote-allow-origins=*','--remote-debugging-port=0',
  '--no-proxy-server','--disable-background-networking',
  '--host-resolver-rules=MAP '+isolatedHost+' 127.0.0.1:'+port+', MAP * ~NOTFOUND',
  '--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await attach();await rpc('Page.enable');await rpc('Runtime.enable');
 await rpc('Page.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
 await rpc('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:false});
 // The regular Timing route must not instantiate the Steam Worker or load
 // signed reader assets, even with a valid preformal anchor in this build.
 await rpc('Page.navigate',{url:testOrigin+'/web/editor/timing/'});
 const outside=await rpc('Runtime.evaluate',{expression:`(async()=>{
  const end=performance.now()+18000;
  while(performance.now()<end){
   const p=document.querySelector('[data-steam-diffgrids-readonly]');
   if(location.pathname==='/web/editor/timing/'&&p?.querySelector('summary')){
    if(p.open)return false;
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
 assert.ok(isolatedRouteRequests>=1,'TIMING_REQUEST_SERVED_ISOLATED');
 assert.equal((await rpc('Runtime.evaluate',{expression:'location.origin',returnByValue:true})).result?.value,testOrigin,'EXACT_LEGACY_BROWSER_ORIGIN');
 assert.equal(assetRequests,0,'ORDINARY_TIMING_NO_SIGNED_READER_ASSETS');
 console.log('08WEB_PREFORMAL_ROUTE_ISOLATION_PASS');
 await rpc('Page.navigate',{url:testOrigin+'/web/editor/steam-reader/'});
 for(let n=0;n<200;n++){
  try{const r=await rpc('Runtime.evaluate',{expression:'location.pathname',returnByValue:true});
    if(r.result?.value==='/web/editor/steam-reader/')break}catch{}
  await delay(40);
 }
 assert.ok(isolatedRouteRequests>=2,'STEAM_ROUTE_REQUEST_SERVED_ISOLATED');
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
   if(!document.querySelector('[data-diffgrids-manual-only]'))throw Error('PRODUCTION_ROUTE_NOT_READY path='+location.pathname+' origin='+location.origin+' panelCount='+document.querySelectorAll('[data-steam-diffgrids-readonly]').length);
   const panel=document.querySelector('[data-steam-diffgrids-readonly]');
   const input=panel?.querySelector('#steam-diffgrids-file');
   if(!panel?.open||!input||input.getBoundingClientRect().height<=0||input.files.length!==0||
      !panel.querySelector('[data-diffgrids-open]')?.disabled||panel.querySelector('[data-diffgrids-count]'))
    throw Error('PRODUCTION_DEFAULT_VISIBLE_MANUAL_ONLY');
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
  assert.ok(assetRequests>=3,'SIGNED_ASSETS_SERVED_ISOLATED');
  console.log('08WEB_LEGACY_ORIGIN_ISOLATED_TLS_TUPLE_PASS');
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
 // Native CDP file selection, not synthetic change dispatch. Install a
 // test-only delivery barrier on the real Worker to hold the actual reply
 // (never forge a receipt), then reload the real route.
 const hook=String.raw`(()=>{
  const Native=window.Worker;
  window.__readerHold={kind:null,held:null,release:null,posts:0};
  window.Worker=class extends Native{
   constructor(url,opts){
    super(url,opts);
    if(opts?.name!=='wand-steam-diffgrids-readonly')return;
    const h=window.__readerHold,ids=new Map();
    const post=this.postMessage.bind(this);
    this.postMessage=(data,...rest)=>{h.posts++;ids.set(data.requestId,data.kind);return post(data,...rest)};
    let cb=null;
    Object.defineProperty(this,'onmessage',{configurable:true,get:()=>cb,set:v=>{cb=v}});
    this.addEventListener('message',event=>{
     if(h.kind&&ids.get(event.data?.requestId)===h.kind&&!h.held){
      h.held=h.kind;h.release=()=>{h.kind=null;h.held=null;h.release=null;cb?.call(this,event)};
     }else cb?.call(this,event);
    });
   }
  };
 })()`;
 await rpc('Page.addScriptToEvaluateOnNewDocument',{source:hook});
 await rpc('Page.navigate',{url:testOrigin+'/web/editor/steam-reader/'});
 const evaluate=async expression=>{
  const x=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(x.exceptionDetails)throw Error(String(x.exceptionDetails.exception?.description||x.exceptionDetails.text).slice(0,700));
  return x.result?.value;
 };
 const waitDom=async check=>evaluate('(async()=>{const end=performance.now()+18000;while(performance.now()<end){if('+check+')return true;await new Promise(r=>setTimeout(r,40))}throw Error("NATIVE_RESELECT_WAIT")})()');
 await waitDom('location.pathname==="/web/editor/steam-reader/"&&document.querySelector("#steam-diffgrids-file:not([disabled])")');
 assert.equal(await evaluate('document.querySelector("[data-steam-diffgrids-readonly]").open&&window.__readerHold.posts===0&&document.querySelector("#steam-diffgrids-file").files.length===0'),true,'NATIVE_DEFAULT_VISIBLE_NO_POSTS');
 await evaluate('window.__nativeChanges=0;document.querySelector("#steam-diffgrids-file").addEventListener("change",()=>window.__nativeChanges++)');
 const fixturePath=join(root,'tests/stage-f/fixtures/synthetic626-diffgrids.p1g');
 const expected=JSON.parse(await readFile(join(root,'tests/stage-f/fixtures/expected-diffgrids.json'),'utf8'));
 const selectNative=async()=>{
  const doc=await rpc('DOM.getDocument');
  const el=await rpc('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#steam-diffgrids-file'});
  assert.ok(el.nodeId);
  await rpc('DOM.setFileInputFiles',{nodeId:el.nodeId,files:[fixturePath]});
  await evaluate('(()=>{const s=document.querySelector("#steam-diffgrids-sha");s.value='+JSON.stringify(expected.originalSha256)+';s.dispatchEvent(new Event("input",{bubbles:true}));const c=document.querySelector("[data-diffgrids-manual-only] input[type=checkbox]");c.click()})()');
  await waitDom('document.querySelector("[data-diffgrids-open]:not([disabled])")');
 };
 await selectNative();
 await evaluate('document.querySelector("[data-diffgrids-open]").click()');
 await waitDom('document.querySelector("[data-diffgrids-page]")?.dataset.diffgridsPage==="1"');
 assert.equal(await evaluate('document.querySelector("[data-diffgrids-open]").disabled'),true,'ACTIVE_SESSION_OPEN_DISABLED');
 // Trusted physical mouse input, not a JavaScript synthetic click.
 // Download the exact native-selected fixture, independently read the disk file,
 // and re-select that file through the actual second native file input.
 const point=await evaluate('(()=>{const b=document.querySelector("[data-diffgrids-backup-download]");if(!b||b.disabled)throw Error("BACKUP_BUTTON_NOT_READY");b.scrollIntoView({block:"center",inline:"nearest"});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()');
 assert.ok(point.x>=0&&point.x<1280&&point.y>=0&&point.y<800,'BACKUP_CLICK_VISIBLE');
 await rpc('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
 await rpc('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
 await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
 await waitDom('document.querySelector("[data-diffgrids-backup-status]")?.dataset.diffgridsBackupStatus==="backupRequested"');
 const downloaded=join(profile,'synthetic626-diffgrids.p1g.original-backup.p1g');
 for(let n=0;n<150&&!existsSync(downloaded);n++)await delay(100);
 const original=await readFile(fixturePath);
 assert.ok(existsSync(downloaded),'ACTUAL_BROWSER_BACKUP_FILE_MISSING');
 assert.deepEqual(await readFile(downloaded),original,'ACTUAL_BROWSER_ORIGINAL_BACKUP_BYTES');
 const backupDoc=await rpc('DOM.getDocument');
 const backupNode=await rpc('DOM.querySelector',{nodeId:backupDoc.root.nodeId,selector:'#steam-diffgrids-backup-file'});
 assert.ok(backupNode.nodeId);
 await rpc('DOM.setFileInputFiles',{nodeId:backupNode.nodeId,files:[downloaded]});
 await waitDom('document.querySelector("[data-diffgrids-backup-status]")?.dataset.diffgridsBackupStatus==="backupMatched"');
 console.log('08WEB_ACTUAL_LOCAL_ORIGINAL_BACKUP_DOWNLOAD_NATIVE_REIMPORT_PASS');
 await evaluate('window.__readerHold.kind="CLOSE_LOCAL_STORED_DIFFGRIDS";document.querySelector("[data-diffgrids-close]").click()');
 await waitDom('window.__readerHold.held==="CLOSE_LOCAL_STORED_DIFFGRIDS"');
 assert.equal(await evaluate('(()=>{const p=document.querySelector("[data-diffgrids-manual-only]");return [...p.querySelectorAll("input,button")].every(e=>e.disabled)&&!document.querySelector("[data-diffgrids-count]")})()'),true,'CLOSE_PENDING_ALL_CONTROLS_DISABLED');
 await evaluate('window.__readerHold.release()');
 await waitDom('!document.querySelector("#steam-diffgrids-file").disabled&&document.activeElement===document.querySelector("[data-diffgrids-summary]")');
 assert.equal(await evaluate('document.querySelector("#steam-diffgrids-file").files.length'),0,'NATIVE_INPUT_CLEARED');
 await selectNative();
 assert.equal(await evaluate('window.__nativeChanges'),2,'SAME_NATIVE_FILE_CHANGE');
 // Hold an actual OPEN reply then close before it is delivered.
 await evaluate('window.__readerHold.kind="OPEN_LOCAL_STORED_DIFFGRIDS";document.querySelector("[data-diffgrids-open]").click()');
 await waitDom('window.__readerHold.held==="OPEN_LOCAL_STORED_DIFFGRIDS"');
 await evaluate('document.querySelector("[data-diffgrids-close]").click()');
 await waitDom('!document.querySelector("#steam-diffgrids-file").disabled&&document.activeElement===document.querySelector("[data-diffgrids-summary]")');
 await evaluate('window.__readerHold.release()');
 assert.equal(await evaluate('!!document.querySelector("[data-diffgrids-count]")'),false,'STALE_OPEN_NO_RESURRECTION');
 await selectNative();
 await evaluate('document.querySelector("[data-diffgrids-open]").click()');
 await waitDom('document.querySelector("[data-diffgrids-page]")?.dataset.diffgridsPage==="1"');
 await evaluate('document.querySelector("[data-diffgrids-close]").click()');
 await waitDom('!document.querySelector("#steam-diffgrids-file").disabled&&document.activeElement===document.querySelector("[data-diffgrids-summary]")');
 console.log('08WEB_DEDICATED_DEFAULT_VISIBLE_MANUAL_ONLY_TIMING_COLLAPSED_PASS');
 console.log('08WEB_NATIVE_SAME_FILE_RESELECT_CLOSE_BARRIER_STALE_OPEN_PASS');
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
}catch(e){console.error('08WEB_REAL_CHROME_FAIL',String(e?.stack||e).slice(0,1800));process.exitCode=1}
finally{
 for(const p of pending.values())p.reject(Error('CDP_CLOSED'));pending.clear();
 try{ws?.close()}catch{}
 if(chrome){chrome.kill('SIGTERM');await delay(250);
   if(chrome.exitCode===null)chrome.kill('SIGKILL')}
 if(server)await new Promise(r=>server.close(r));
 await rm(profile,{recursive:true,force:true,maxRetries:3});
}
