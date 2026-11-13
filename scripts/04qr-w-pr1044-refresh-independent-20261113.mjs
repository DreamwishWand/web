// Build the actual shared Svelte ItemThumb and resolver for an isolated private
// local-browser test. This is a test-only artifact, never a Pages route or
// production release authority. CI carries only public source-derived JS/CSS;
// it does not receive any DDV pixels or raw archive. Local tester supplies
// the SHA-pinned WebP bytes via loopback after the build.
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {build} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {prepareSwitch1253ItemImageManifest} from '../src/lib/item-media/switch1253-public-item-images.mjs';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';

import {execFileSync} from 'node:child_process';
import * as M from '../src/lib/item-media/switch1253-public-item-images.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const source='56eed360bd188e028ef29be1f0f0bab6cd7fd13e',base='507f13980db39b888b1e4ba892cf531664656448';
const pins={'.github/workflows/web-shared-catalog-detail.yml':'05ae21cf58fd114cedeba294c1e2501f738f1a6b','scripts/web-switch1253-private-preview-build.mjs':'505f37447c7e35747c2951ba7ed2fb4139f1fb4c','src/lib/item-media/switch1253-public-item-images.mjs':'c55d04028bfdecd3ee62e754c791df7842be8686','src/lib/ui/ItemThumb.svelte':'48a9cd34c70174dc1ffd9f8f828145c08f48718f','tests/web-switch1253-item-thumb-contract.test.mjs':'da07be19e6393df6f62ccd0b289178d3fcdc6e98'};
assert.equal(git('merge-base',source,'HEAD'),source);
assert.deepEqual(git('diff','--name-status',base,source).split('\n').sort(),Object.keys(pins).map(p=>(p.startsWith('scripts/')?'A':'M')+'\t'+p).sort());
assert.deepEqual(git('diff','--name-status',source,'HEAD').split('\n').sort(),['A\tscripts/04qr-w-pr1044-refresh-independent-20261113.mjs','A\t.github/workflows/04qr-w-pr1044-refresh-20261113.yml'].sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('hash-object',p),h);
assert.equal(M.SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);
assert.deepEqual(Object.keys(M.SWITCH1253_REVIEWED_RELEASE.items),[]);
console.log('QRW1044_FIXED_SOURCE5_OFF_PASS');
const raw=M.prepareSwitch1253ItemImageManifest();
const {gate,...pub}=raw.publication;
const review={mediaPublic:true,...pub,rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'c'.repeat(64),items:{}};
for(const [id,e] of Object.entries(raw.items)){e.publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';const {rasterStatus,pixelStatus,assetStatus,...row}=e;review.items[id]=row;}
const {mediaPublic,items,...accepted}=review;raw.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...accepted};
const response=(obj=raw,mime='application/json')=>new Response(JSON.stringify(obj),{headers:{'content-type':mime}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let now=100000,states=[],calls=[];
const c=M.createSwitch1253ManifestController(review,s=>states.push(s),()=>now);
const hit=async(url,init)=>{calls.push({url,init});return response();};
assert.equal((await c.load('/web',hit)).count,2);
assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.redirect,'error');
assert.equal(await c.load('/web',hit),(await c.load('/web',hit)));assert.equal(calls.length,1);
now-=1;assert.equal((await c.load('/web',hit)).count,2);assert.equal(calls.length,2);
const old=deferred(),p1=c.load('/web',(url,init)=>{calls.push({url,init});return old.promise},true);
const p2=c.load('/web',()=>{throw Error('same-base request must coalesce')},true);assert.equal(p1,p2);assert.equal(states.at(-1).catalog,null);
const one=structuredClone(raw);delete one.items['40000047'];
const other=c.load('/other',async()=>response(one),true);
assert.equal(await p1,null);assert.equal((await other).count,1);assert.equal(calls.at(-1).init.signal.aborted,true);
const n=states.length;old.resolve(response());await new Promise(r=>setImmediate(r));assert.equal(states.length,n);
assert.equal(M.scopedSwitch1253ItemImageHref('/other','40000047',states.at(-1).catalog),null);
const stalled=deferred();let signal;
const timed=c.load('/web',(url,init)=>{signal=init.signal;return stalled.promise},true);
assert.equal(await timed,null);assert.equal(signal.aborted,true);assert.equal(states.at(-1).reason,'MANIFEST_REFRESH_TIMEOUT');
const before=states.length;stalled.resolve(response());await new Promise(r=>setImmediate(r));assert.equal(states.length,before);
assert.equal((await c.load('/web',hit,true)).count,2);
for(const invalid of [()=>response({...raw,items:{}}),()=>response(raw,'text/html'),()=>new Response('oops',{status:503}),()=>new Response('{',{headers:{'content-type':'application/json'}})]){assert.equal(await c.load('/web',async()=>invalid(),true),null);assert.equal(states.at(-1).catalog,null);}
for(const mutate of [x=>x.items['40000047'].webpSha256=x.items['40006096'].webpSha256,x=>x.items['40000047'].visibility='HIDDEN',x=>x.source.buildID='0000000000000000',x=>x.items['40002422']=x.items['40000047'],x=>x.publication.operatorReceiptSha256='f'.repeat(64)]){const x=structuredClone(raw);mutate(x);assert.equal(await c.load('/web',async()=>response(x),true),null);assert.equal(states.at(-1).catalog,null);}
const hide=deferred(),hp=c.load('/web',()=>hide.promise,true);c.clear('DOCUMENT_NOT_VISIBLE');assert.equal(await hp,null);const count=states.length;hide.resolve(response());await new Promise(r=>setImmediate(r));assert.equal(states.length,count);
assert.equal((await c.load('/web',hit,true)).count,2);c.clear('NO_VISIBLE_CONSUMER');assert.equal(states.at(-1).catalog,null);
console.log('QRW1044_CONTROLLER_COALESCE_CROSS_BASE_TIMEOUT_LATE_ALL_WITHDRAW_INVALID_PASS');
const repo=resolve('.');
const root=await mkdtemp(join(repo,'.switch1253-private-preview-'));
const out=await mkdtemp(join(tmpdir(),'switch1253-preview-'));
try{
 await writeFile(join(root,'paths.mjs'),"export const base='/web';\n");
 await writeFile(join(root,'Harness.svelte'),`<script>
 import ItemThumb from '$lib/ui/ItemThumb.svelte';
 </script>
 <main data-private-preview="test-only">
  <h1>Private test fixture — not published</h1>
  <div class="cards">
   <article data-preview-item="40000047"><ItemThumb itemId={40000047} label="Wardrobe" /><span>Wardrobe</span></article>
   <article data-preview-item="40006096"><ItemThumb itemId={40006096} label="Dice Tree" /><span>Dice Tree</span></article>
   <article data-preview-item="40002422"><ItemThumb itemId={40002422} label="Excluded" /><span>Excluded</span></article>
  </div>
 </main>
 <style>
 .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr));gap:8px;min-width:0}
 article{min-width:0;display:flex;flex-direction:column;align-items:start;gap:4px;overflow-wrap:anywhere}
 </style>`);
 await writeFile(join(root,'entry.mjs'),`import {mount,tick} from 'svelte';
 import {get} from 'svelte/store';
 import Harness from './Harness.svelte';
 import {prepareSwitch1253ItemImageManifest,validateSwitch1253ItemImageCatalog,
 switch1253PublicItemImageSource,loadSwitch1253PublicItemImageSource,createSwitch1253ManifestController,
 attachSwitch1253ManifestLifecycle} from '$lib/item-media/switch1253-public-item-images.mjs';
 import {itemImagePreferences} from '$lib/item-media/public-item-images.mjs';
 mount(Harness,{target:document.body});
 const draft=prepareSwitch1253ItemImageManifest();
 function fixture(){
  const m=structuredClone(draft);
  const {gate,...pending}=m.publication;
  const release={...pending,mediaPublic:true,rightsReview:'OPERATOR_ACCEPTED',
   receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
   attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
   operatorReceiptSha256:'b'.repeat(64),items:{}};
  for(const [id,e] of Object.entries(m.items)){
   e.publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
   release.items[id]={originalNativeStreamSha256:e.originalNativeStreamSha256,sourcePngSha256:e.sourcePngSha256,
    webpSha256:e.webpSha256,rightsStatus:e.rightsStatus,publicationDecision:e.publicationDecision,visibility:e.visibility};
  }
  const {mediaPublic,items,...pub}=release;
  m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...pub};
  return {manifest:m,release};
 }
 async function init(){
  await tick();
  let detach=null,controller=null;
  window.act418PrivateTest={draft:()=>structuredClone(draft),fixture,state:()=>get(switch1253PublicItemImageSource),
   startRefresh:()=>{detach?.();const f=fixture();controller=createSwitch1253ManifestController(f.release,v=>switch1253PublicItemImageSource.set(v));detach=attachSwitch1253ManifestLifecycle(controller,'/web',window,document);},
   stopRefresh:()=>{detach?.();detach=null;controller=null;},
   apply:(m,r)=>{const catalog=validateSwitch1253ItemImageCatalog(m,r);
    switch1253PublicItemImageSource.set({status:'VERIFIED',catalog,reason:null});return catalog.count;},
   off:()=>loadSwitch1253PublicItemImageSource('/web'),
   prefs:(size,fit)=>itemImagePreferences.set({size,fit,density:'comfortable'})
  };
 }
 void init();`);
 await build({root,configFile:false,plugins:[svelte({configFile:false})],
  resolve:{alias:{'$lib':join(repo,'src/lib'),'$app/paths':join(root,'paths.mjs')}},
  build:{outDir:out,emptyOutDir:true,cssCodeSplit:false,
   lib:{entry:join(root,'entry.mjs'),formats:['es'],fileName:()=> 'preview.js',cssFileName:'preview'},
   rollupOptions:{output:{inlineDynamicImports:true}}}});
 const names=(await readdir(out)).sort();
 if(JSON.stringify(names)!==JSON.stringify(['preview.css','preview.js']))throw Error('UNEXPECTED_TEST_BUNDLE_FILES '+names.join(','));
 for(const name of names){
  const bytes=await readFile(join(out,name)),b64=bytes.toString('base64');
  console.log('ACT418_PRIVATE_BUNDLE '+name+' '+bytes.length+' '+createHash('sha256').update(bytes).digest('hex'));
  // no bundle payload emitted
 }
 const draft=prepareSwitch1253ItemImageManifest();
 const draftBytes=Buffer.from(JSON.stringify(draft,null,2)+'\n');
 console.log('ACT418_PREPARED_DRAFT '+draftBytes.length+' '+createHash('sha256').update(draftBytes).digest('hex')+' '+draftBytes.toString('base64'));
 console.log('ACT418_PRIVATE_PREVIEW_BUILD_NO_GAME_BYTES_PASS');
 if(process.argv.includes('--synthetic-browser'))await syntheticBrowser(out,draft);
}finally{
 await rm(root,{recursive:true,force:true});await rm(out,{recursive:true,force:true});
}

async function syntheticBrowser(out,draft){
 // Distinct, original single-colour test swatches, NOT game bytes and NOT
 // matching the real pinned hashes. Interception exists only in this test.
 // Real asset MIME/SHA is verified on the private staging files separately.
 const {chromium}=await import('playwright-core');
 assert.ok(process.env.CHROME_BIN);
 const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/preview.css"><style>:root{--border:#888;--surface-raised:#eee;--ink-muted:#555}body{margin:8px;font:14px system-ui}</style><script type="module" src="/preview.js"></script>';
 const js=await readFile(join(out,'preview.js')),css=await readFile(join(out,'preview.css'));
 const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}
  else if(req.url==='/preview.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}
  else if(req.url==='/preview.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else{res.statusCode=404;res.end();}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
  const page=await ctx.newPage(),requests=[],errors=[],hits=[];
  ctx.on('request',r=>requests.push([r.method(),r.url()]));
  page.on('pageerror',e=>errors.push(String(e)));
  const pins=Object.entries(draft.items);
  const paths=Object.fromEntries(pins.map(([id,e])=>[id,origin+'/web/ddv/item-images/'+draft.assetVariant+'/'+e.originalNativeStreamSha256.slice(0,2)+'/'+e.originalNativeStreamSha256+'-'+e.sourcePngSha256+'-'+e.webpSha256+'.webp']));
  const swatches={
   '40000047':Buffer.from('UklGRiQAAABXRUJQVlA4TBcAAAAvn8AnAAfQsVo0uf8BAEX6/58i+p/6AQA=','base64'),
   '40006096':Buffer.from('UklGRiQAAABXRUJQVlA4TBcAAAAvn8AnAAdQvU4Xpf8BAEX6/58i+p/6AQA=','base64')};
  for(const [id,b] of Object.entries(swatches))assert.notEqual(createHash('sha256').update(b).digest('hex'),draft.items[id].webpSha256);
  let missing=false,withdrawn=false,allWithdrawn=false,manifestHits=0;
  await page.route('**/ddv/item-images/**',async route=>{
   const url=route.request().url();
   if(url.endsWith('/manifest.json')){
    manifestHits++;const f=await page.evaluate(()=>window.act418PrivateTest.fixture());
    if(withdrawn)delete f.manifest.items['40000047'];
    if(allWithdrawn)f.manifest.items={};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(f.manifest)});
   }
   const id=Object.keys(paths).find(k=>paths[k]===url);
   hits.push({id:id??'UNKNOWN',url});
   if(!id||(missing&&id==='40000047'))return route.fulfill({status:404,body:'not found'});
   await route.fulfill({status:200,contentType:'image/webp',body:swatches[id]});
  });
  await page.goto(origin);await page.waitForFunction(()=>!!window.act418PrivateTest);
  assert.equal(await page.locator('img').count(),0);assert.equal(hits.length,0);
  assert.ok(await page.evaluate(()=>{const {release}=window.act418PrivateTest.fixture();
   try{window.act418PrivateTest.apply(window.act418PrivateTest.draft(),release);return false}catch(e){return String(e).includes('MANIFEST_PUBLICATION_UNVERIFIED')}}));
  const apply=()=>page.evaluate(()=>{const f=window.act418PrivateTest.fixture();return window.act418PrivateTest.apply(f.manifest,f.release)});
  assert.equal(await apply(),2);
  await page.waitForFunction(()=>document.querySelectorAll('img').length===2&&[...document.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth===160&&i.naturalHeight===160));
  for(const id of Object.keys(paths)){
   const img=page.locator('[data-item-thumb-id="'+id+'"] img');
   assert.equal(await img.evaluate(el=>el.src),paths[id]);
   assert.equal(await page.locator('[data-item-thumb-id="'+id+'"]').getAttribute('data-media-status'),'verified-public-image');
  }
  assert.equal(await page.locator('[data-item-thumb-id="40002422"] img').count(),0);
  assert.deepEqual(hits.map(h=>h.id).sort(),['40000047','40006096']);
  for(const [width,zoom] of [[320,1],[640,2]]){
   await page.setViewportSize({width,height:850});
   await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
   await page.evaluate(()=>window.act418PrivateTest.prefs(96,'cover'));
   await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(i=>i.style.objectFit==='cover'));
   const layout=await page.evaluate(()=>({width:innerWidth,rects:[...document.querySelectorAll('[data-item-thumb-id]')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.width]})}));
   assert.ok(layout.rects.every(r=>r[0]>=-1&&r[1]<=layout.width+2&&r[2]>0),JSON.stringify(layout));
  }
  await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1280,height:860});
  await page.evaluate(()=>window.act418PrivateTest.prefs(56,'contain'));
  await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(i=>i.style.objectFit==='contain'));
  assert.ok(await page.evaluate(()=>{const changes=[
   f=>f.manifest.items['40000047'].webpSha256='a'.repeat(64),
   f=>f.manifest.target.schema=624,
   f=>f.manifest.items['40000047'].visibility='HIDDEN',
   f=>f.manifest.items['40000047'].url='https://invalid.example/a.webp',
   f=>{f.manifest.items['40002422']={...f.manifest.items['40000047']};f.release.items['40002422']={...f.release.items['40000047']}},
   f=>f.release.receivingContact='NOT_RUN',
   f=>f.manifest.items['40000047'].rasterStatus=f.manifest.items['40006096'].rasterStatus];
   return changes.every(change=>{const f=window.act418PrivateTest.fixture();change(f);
    try{window.act418PrivateTest.apply(f.manifest,f.release);return false}catch{return true}});
  }));
  missing=true;await page.reload();await page.waitForFunction(()=>!!window.act418PrivateTest);await apply();
  await page.waitForFunction(()=>document.querySelector('[data-item-thumb-id="40000047"]').dataset.mediaStatus==='unavailable'&&document.querySelector('[data-item-thumb-id="40006096"] img')?.naturalWidth===160);
  assert.equal(await page.locator('[data-item-thumb-id="40000047"] img').count(),0);
  missing=false;await page.reload();await page.waitForFunction(()=>!!window.act418PrivateTest);await apply();
  await page.waitForFunction(()=>document.querySelectorAll('img').length===2&&[...document.querySelectorAll('img')].every(i=>i.naturalWidth===160));
  await page.evaluate(()=>window.act418PrivateTest.startRefresh());
  await page.waitForFunction(()=>document.querySelectorAll('img').length===2&&[...document.querySelectorAll('img')].every(i=>i.naturalWidth===160));
  assert.equal(manifestHits,1);
  withdrawn=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('[data-item-thumb-id="40000047"]').dataset.mediaStatus==='unavailable'&&document.querySelector('[data-item-thumb-id="40006096"] img')?.naturalWidth===160);
  assert.equal(manifestHits,2);assert.equal(await page.locator('[data-item-thumb-id="40000047"] img').count(),0);
  allWithdrawn=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelectorAll('img').length===0&&window.act418PrivateTest.state().reason.includes('MAPPING_EMPTY_OR_OVERSIZED'));
  allWithdrawn=false;withdrawn=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelectorAll('img').length===2&&[...document.querySelectorAll('img')].every(i=>i.naturalWidth===160));
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await page.waitForFunction(()=>document.querySelectorAll('img').length===0);
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await page.waitForFunction(()=>document.querySelectorAll('img').length===2&&[...document.querySelectorAll('img')].every(i=>i.naturalWidth===160));
  console.log('QRW1044_ACTUAL_CHROME_ALL_WITHDRAW_RESTORE_PAGEHIDE_PAGESHOW_PASS');
  await page.evaluate(()=>window.act418PrivateTest.stopRefresh());
  await page.waitForFunction(()=>document.querySelectorAll('img').length===0);
  console.log('ACT418_OPEN_TAB_NO_STORE_MANIFEST_REFRESH_WITHDRAW_ONE_KEEP_SURVIVOR_PASS');
  const before=hits.length;await page.evaluate(()=>window.act418PrivateTest.off());await page.waitForFunction(()=>document.querySelectorAll('img').length===0);
  assert.equal(hits.length,before);assert.ok(requests.every(([m,u])=>m==='GET'&&u.startsWith(origin+'/')));
  assert.ok(hits.every(h=>h.id!=='UNKNOWN'));assert.deepEqual(errors,[]);
  console.log('ACT418_ACTUAL_SHARED_ITEMTHUMB_SYNTHETIC_ONLY_2POS_7NEG_OFF_REFLOW_FALLBACK_PASS');
  await ctx.close();
 }finally{await browser?.close();await new Promise(yes=>server.close(yes))}
}
