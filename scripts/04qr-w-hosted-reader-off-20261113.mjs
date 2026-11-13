// New deployed boundary only, never private Save, never enable Reader.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {savedDiffGridsCopy} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';
const MAIN='7823a2d66a0ae8f9a6a80bbf225734d2c52bf204';
const origin='https://dreamwishwand.github.io',url=origin+'/web/editor/timing/';
const expected='adb4c623d7f7affaca73ae893577cd0cc0dbf9f7582263447530b74779873361';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-status',MAIN,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-hosted-reader-off-20261113.yml','A\tscripts/04qr-w-hosted-reader-off-20261113.mjs'].sort());
for(const [p,h] of Object.entries({'src/lib/wep/SteamSavedDiffGridsReadonly.svelte':'383acc44aed9541ef1d0714531937ebebb893d3a','src/lib/wep/steam-saved-diffgrids.consumer.worker.ts':'8b013ee2fb5d6781eef33bb96d9f67b3a04ce4c3','src/routes/editor/timing/+page.svelte':'7db3d6119755eeb305b49ae38339d636e40edcf6'}))assert.equal(git('rev-parse','HEAD:'+p),h);
async function deployment(){
 const r=await fetch(origin+'/web/worker-wasm/manifest.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
 if(r.status!==200)throw Error('WAIT_ENV_MANIFEST_HTTP_'+r.status);
 const sha=createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
 if(sha!==expected)throw Error('WAIT_HEAD_DEPLOYMENT_DRIFT '+sha);
}
await deployment();
const bin=['google-chrome-stable','google-chrome','chromium'].map(x=>spawnSync('which',[x],{encoding:'utf8'}).stdout?.trim()).find(Boolean);
assert.ok(bin,'ENV_CHROME_NOT_INSTALLED');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:320,height:800},ignoreHTTPSErrors:false,serviceWorkers:'block',acceptDownloads:false});
const req=[],errors=[],downloads=[];
ctx.on('request',r=>req.push({u:r.url(),m:r.method()}));
const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('download',()=>downloads.push(1));
await p.addInitScript(()=>{
 const audit={workers:[],messages:[],sends:[]};
 window.__readerAudit=audit;
 const W=window.Worker;
 window.Worker=new Proxy(W,{construct(target,args){
  const w=Reflect.construct(target,args);const name=args[1]?.name||'';
  if(name==='wand-steam-diffgrids-readonly'){
   audit.workers.push(name);
   w.addEventListener('message',({data})=>audit.messages.push({kind:data?.kind,ready:data?.ready,writerAuthorized:data?.writerAuthorized,keys:Object.keys(data||{}).sort()}));
   const send=w.postMessage;w.postMessage=function(...a){audit.sends.push(a[0]?.kind||'UNKNOWN');return send.apply(this,a)};
  }
  return w;
 }});
});
const panel=p.locator('[data-steam-diffgrids-readonly]'),summary=panel.locator('[data-diffgrids-summary]');
async function boundary(){
 const state=await p.evaluate(()=>window.__readerAudit);
 assert.equal(state.workers.length,1);
 assert.deepEqual(state.messages,[{kind:'DIFFGRIDS_RUNTIME_READY',ready:false,writerAuthorized:false,keys:['kind','ready','writerAuthorized']}]);
 assert.deepEqual(state.sends,[]);
 assert.equal(await panel.count(),1);
 for(const key of ['data-writer','data-cloud','data-product-read'])assert.equal(await panel.getAttribute(key),'off');
 for(const s of ['#steam-diffgrids-file','#steam-diffgrids-sha','[data-diffgrids-open]','[data-diffgrids-close]','[data-diffgrids-count]','[data-diffgrids-manual-only]'])assert.equal(await panel.locator(s).count(),0,s);
}
async function geometry(){
 await summary.scrollIntoViewIfNeeded();
 const r=await summary.evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,w:r.width,viewport:innerWidth,x:scrollX}});
 assert.ok(r.w>0&&r.left>=-1&&r.right<=r.viewport+1&&Math.abs(r.x)<=1,JSON.stringify(r));
}
try{
 const response=await p.goto(url,{waitUntil:'networkidle',timeout:60000});
 assert.equal(response.status(),200);assert.equal(p.url(),url);
 await p.waitForFunction(()=>window.__readerAudit?.messages?.length>0,undefined,{timeout:20000});
 await boundary();
 assert.equal(await panel.getAttribute('open'),null);
 await summary.focus();await p.keyboard.press('Enter');assert.equal(await panel.evaluate(e=>e.open),true);
 const status=await panel.locator('[data-diffgrids-status]').textContent();
 assert.equal(status.trim(),savedDiffGridsCopy('en').unavailable);
 await geometry();await p.evaluate(()=>document.documentElement.style.zoom='2');await geometry();await boundary();
 await summary.focus();await p.keyboard.press('Enter');assert.equal(await panel.evaluate(e=>e.open),false);
 await p.reload({waitUntil:'networkidle',timeout:60000});
 await p.waitForFunction(()=>window.__readerAudit?.messages?.length>0,undefined,{timeout:20000});
 await boundary();
 assert.equal(await panel.getAttribute('open'),null);
 assert.equal(req.filter(r=>r.u.includes('/worker-wasm/')).length,0,'OFF worker must not request signed assets');
 assert.equal(req.filter(r=>!['GET','HEAD'].includes(r.m)).length,0,'no mutations');
 assert.equal(downloads.length,0);assert.deepEqual(errors,[]);
 await deployment();
 console.log('QRW_HOSTED_READER_OFF_REAL_HTTPS_PASS '+JSON.stringify({main:MAIN,url,workerReady:false,writerAuthorized:false,readerCommands:0,assetRequests:0,privateSave:false,keyboard:true,viewport320:true,zoom200:true,reload:true,manifestBeforeAfter:expected}));
 // Copy is deliberately recorded, not treated as permission or runtime verification.
 console.log('QRW_HOSTED_READER_OFF_COPY_OBSERVED '+JSON.stringify({status:status.trim(),buildSignedAssetsAccepted:true,ownerReaderEnabled:false,runtimeVerificationNotRun:true}));
}finally{await ctx.close();await browser.close()}
