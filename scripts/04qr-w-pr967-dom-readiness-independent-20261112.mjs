// Independent actual Chrome DOM-readiness audit, exact Source helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as sleep} from 'node:timers/promises';
const S='da0670b57ad36a8c75a3e51842ac3dcc350de0e7',OLD='30d5da61aa45dbba52b3f280bc1344787c3cdd9a',BASE='3776c886dd57a0e1c998c839ef3c43a1c933914c';
const P='tests/web-steam-saved-diffgrids-real-chrome.mjs';
const files={'.github/workflows/08web-steam-saved-diffgrids-real-chrome.yml':'5ed97de163b660633b86f57e4a684d2f419422b5','src/lib/wep/steam-saved-diffgrids.consumer.worker.ts':'8b013ee2fb5d6781eef33bb96d9f67b3a04ce4c3',[P]:'ae666f34be2db7a3fb1c9857f8db8f22ff3e2230'};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const fresh=git('show',S+':'+P),old=git('show',OLD+':'+P);
test('exact original3 MOD, repair1, unchanged accepted Worker/workflow, no product route or flag delta',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.deepEqual(git('diff','--name-status',BASE,S).split('\n').sort(),Object.keys(files).map(p=>'M\t'+p).sort());
 assert.equal(git('diff','--name-status',OLD,S),'M\t'+P);
 for(const [p,h] of Object.entries(files)){assert.equal(git('rev-parse',S+':'+p),h);if(p!==P)assert.equal(git('rev-parse',OLD+':'+p),h)}
 assert.equal(git('rev-parse',OLD+':'+P),'1783398322963f72852c20f5ec96bff4c04065e7');
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&x.includes('04qr-w-pr967')));
 assert.match(git('show',S+':src/lib/wep/steam-saved-diffgrids.consumer.worker.ts'),/const PRODUCT_READONLY_CONSUMER_OWNER_ENABLED=false;/);
 assert.equal(git('ls-files','static/worker-wasm','tests/stage-f/fixtures'),'');
});
test('retained genuine signed built Worker and critical positive/negative checks; bounded diagnostics',()=>{
 const tokens=['P1G_SOURCE_SIZE','SYNTHETIC_ONLY_FIXTURE','NO_AUTO_SAVE','NO_READ_BEFORE_CLICK','TOTAL_17','PAGE_BOUNDS_','ONLY_ALLOWED_UI_METADATA','EXTERNAL_LAYOUT_STATUS','GRIDID0_LITERAL_ONLY','MODIFIED_COUNT','REMOVED_COUNT','OVERLAP_COUNT','THREE_PAGES','FIVE_COLUMN_TABLE_INNER_SCROLL','TABLE_SCROLL_DID_NOT_MOVE_PAGE','NO_PRIVATE_','FOCUS_RESTORED','NO_STALE_PAGE_AFTER_CLOSE','NATIVE_KEYBOARD_SUMMARY','BAD_SHA_NO_SESSION','REOPEN_NEW_SESSION','ONE_BUILT_CONSUMER_WORKER','BUILT_CONSUMER_RELEASE_ID','BUILT_PROTECTED_LOADER','REAL_ASSET_REQUEST_','PHYSICAL_REFLOW_NO_CLIP','PAGE_NO_HORIZONTAL_SCROLL','DESKTOP_NO_PAGE_HORIZONTAL_OVERFLOW','08WEB_REAL_SIGNED_PUBLIC_RUST_WASM_CHROME_TYPED_CONSUMER_PASS'];
 for(const t of tokens){assert.ok(old.includes(t),'old '+t);assert.ok(fresh.includes(t),'new '+t)}
 assert.ok(fresh.includes("['manifest','wasm','mime','redirect']"));
 assert.ok(fresh.includes("ready:false,writerAuthorized:false"));
 assert.ok(fresh.includes("realPrivateSave:false,writerAuthorized:false,productEnabled:false"));
 const wait=fresh.slice(fresh.indexOf(' const wait=async'),fresh.indexOf(' // Each lookup'));
 assert.ok(wait.includes("location.pathname")&&wait.includes('document.readyState')&&wait.includes('panelCount=')&&wait.includes('summaryCount='));
 assert.doesNotMatch(wait,/innerHTML|textContent|outerHTML|\.files|\.value|JSON\.stringify/);
});
const chrome=process.env.WAND_CHROME_BIN||['google-chrome','google-chrome-stable','chromium'].find(b=>spawnSync('which',[b],{stdio:'ignore'}).status===0);
async function withChrome(fn){
 assert.ok(chrome,'actual installed Chrome required');
 const profile=await mkdtemp(join(tmpdir(),'qrw967-dom-'));
 const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws=null,err=null;child.on('error',e=>err=e);
 const ended=new Promise(r=>child.once('close',r));
 try{
  let url=null;
  for(let i=0;i<180&&!url;i++){if(err||child.exitCode!==null||child.signalCode!==null)throw Error('QA_CHROME_START_FAILED');try{
   const p=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);
   if(p>0&&p<65536){const r=await fetch('http://127.0.0.1:'+p+'/json/list',{signal:AbortSignal.timeout(500)});url=(await r.json()).find(x=>x.type==='page')?.webSocketDebuggerUrl;}
  }catch{}if(!url)await sleep(100)}
  assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/page\//);
  ws=new WebSocket(url);
  await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('QA_WS_TIMEOUT')),5000);ws.addEventListener('open',()=>{clearTimeout(t);r()},{once:true});ws.addEventListener('error',()=>{clearTimeout(t);j(Error('QA_WS_ERROR'))},{once:true})});
  let serial=0;
  const rpc=(method,params={})=>new Promise((r,j)=>{
   const id=++serial;const timer=setTimeout(()=>{ws.removeEventListener('message',receive);j(Error('QA_CDP_TIMEOUT'))},15000);
   function receive(e){const v=JSON.parse(String(e.data));if(v.id!==id)return;clearTimeout(timer);ws.removeEventListener('message',receive);v.error?j(Error('QA_CDP_ERROR')):r(v.result)}
   ws.addEventListener('message',receive);ws.send(JSON.stringify({id,method,params}));
  });
  await rpc('Runtime.enable');return await fn(rpc);
 }finally{try{ws?.close()}catch{}if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await Promise.race([ended,sleep(5000).then(()=>{throw Error('QA_CHROME_CLEANUP_TIMEOUT')})]);await rm(profile,{recursive:true,force:true,maxRetries:4});await assert.rejects(access(profile))}
}
async function scenario(){
 const seen=[];
 const pass=(v,k)=>{need(v,'INDEPENDENT_'+k);seen.push(k)};
 document.body.replaceChildren();
 const host=document.createElement('section');document.body.append(host);
 const panel=()=>{const p=document.createElement('details');p.setAttribute('data-steam-diffgrids-readonly','');return p};
 const summary=()=>{const s=document.createElement('summary');s.setAttribute('data-diffgrids-summary','');return s};
 const input=()=>{const i=document.createElement('input');i.id='steam-diffgrids-file';i.type='file';return i};
 const a=panel();host.append(a);
 pass(pair(host)===null,'OUTER_ONLY');
 const wrapper=document.createElement('div');wrapper.append(summary());a.append(wrapper);
 pass(pair(host)===null,'NESTED_SUMMARY_ONLY');
 const s=summary();a.append(s);pass(pair(host)?.summary===s,'DIRECT_SUMMARY');
 pass(currentElement('[data-diffgrids-summary]',host)===null,'DUPLICATE_DESCENDANT_SUMMARY');
 wrapper.remove();
 const f=input();a.append(f);pass(currentElement('#steam-diffgrids-file',host)===f,'UNIQUE_CONTROL');
 const dupe=input();a.append(dupe);pass(currentElement('#steam-diffgrids-file',host)===null,'DUPLICATE_CONTROL');dupe.remove();
 const second=panel();second.append(summary());host.append(second);
 pass(pair(host)===null,'DUPLICATE_PANEL');second.remove();
 const p=pair(host);a.remove();pass(!p.panel.isConnected&&!p.summary.isConnected&&pair(host)===null,'DETACHED');
 const replacement=panel();host.append(replacement);
 const waiting=currentPair('INDEPENDENT_DELAYED_REPLACEMENT',host,1200);
 setTimeout(()=>{const third=panel();third.append(summary(),input());replacement.replaceWith(third)},90);
 const freshPair=await waiting;pass(freshPair.panel!==replacement&&freshPair.summary.isConnected,'REPLACED_WHILE_WAITING');
 const currentFile=currentElement('#steam-diffgrids-file',host);currentFile.remove();
 pass(currentElement('#steam-diffgrids-file',host)===null,'CONTROL_REMOVED');
 const newFile=input();freshPair.panel.append(newFile);pass(currentElement('#steam-diffgrids-file',host)===newFile&&newFile!==currentFile,'CONTROL_REPLACED');
 let denied=false;try{present('#absent-control','INDEPENDENT')}catch(e){denied=e.message==='08WEB_CHROME_MISSING_CURRENT_INDEPENDENT'}
 pass(denied,'MISSING_PRESENT_DENIED');
 const secret=document.createElement('p');secret.textContent='PRIVATE_SENTINEL_DO_NOT_LOG';host.append(secret);
 freshPair.summary.remove();
 let bounded=false;try{await currentPair('INDEPENDENT_MISSING',host,160)}catch(e){bounded=e.message.includes('08WEB_WAIT_INDEPENDENT_MISSING')&&e.message.includes('panelCount=1')&&e.message.includes('summaryCount=0')&&!e.message.includes(secret.textContent)&&e.message.length<250}
 pass(bounded,'BOUNDED_MISSING_DIAGNOSTIC');
 host.remove();return seen;
}
test('actual Chrome executing exact Source readiness helpers: 13 distinct DOM states and bounded failures', {timeout:60000},()=>withChrome(async rpc=>{
 const start=fresh.indexOf(' const need=(v,k)'),end=fresh.indexOf(' // Deterministic browser-DOM contract');
 assert.ok(start>=0&&end>start);
 const helpers=fresh.slice(start,end);
 const expression='(async()=>{'+helpers+';return await ('+scenario.toString()+')()})()';
 const r=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));
 assert.deepEqual(r.result.value,['OUTER_ONLY','NESTED_SUMMARY_ONLY','DIRECT_SUMMARY','DUPLICATE_DESCENDANT_SUMMARY','UNIQUE_CONTROL','DUPLICATE_CONTROL','DUPLICATE_PANEL','DETACHED','REPLACED_WHILE_WAITING','CONTROL_REMOVED','CONTROL_REPLACED','MISSING_PRESENT_DENIED','BOUNDED_MISSING_DIAGNOSTIC']);
 console.log('QRW967_ACTUAL_CHROME_EXACT_SOURCE_DOM_HELPERS_13PASS');
}));
