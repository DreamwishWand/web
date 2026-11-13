import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {build} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {chromium} from 'playwright-core';
import * as m from '../src/lib/item-media/switch1253-public-item-images.mjs';
const S='e9915da742779d97a932c1d99a5552c3a29eced6',B='f8575691f77a1a83ce2361c30520998d24fd7466';
const pins={
 '.github/workflows/web-shared-catalog-detail.yml':['05ae21cf58fd114cedeba294c1e2501f738f1a6b','e3c5b4a9aef1fc6b31c71d809a39c431b76a6020'],
 'scripts/web-switch1253-private-preview-build.mjs':['505f37447c7e35747c2951ba7ed2fb4139f1fb4c','4f2ec7fbb7027553e3cfb4c421e3046bd9bd94d3'],
 'src/lib/item-media/switch1253-public-item-images.mjs':['c55d04028bfdecd3ee62e754c791df7842be8686','2842d42ea94a8c223161fc6de36069aee58f2578'],
 'tests/web-switch1253-item-thumb-contract.test.mjs':['da07be19e6393df6f62ccd0b289178d3fcdc6e98','ade95028940aed802702b1d52686c71f2b5824b6']
};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('rev-parse',S+'^'),B);
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>'M\t'+p).sort());
for(const [p,[a,b]] of Object.entries(pins)){assert.equal(git('rev-parse',B+':'+p),a);assert.equal(git('rev-parse',S+':'+p),b);assert.equal(git('rev-parse','HEAD:'+p),b)}
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\tscripts/04qr-w-pr1066-eligible60-independent-20261114.mjs','A\t.github/workflows/04qr-w-pr1066-eligible60-20261114.yml'].sort());
assert.equal(git('rev-parse',B+':src/lib/ui/ItemThumb.svelte'),git('rev-parse',S+':src/lib/ui/ItemThumb.svelte'));
const resolver='src/lib/item-media/switch1253-public-item-images.mjs';
const before=git('show',B+':'+resolver),after=git('show',S+':'+resolver);
assert.equal(before.slice(before.indexOf('export const SWITCH1253_REVIEWED_RELEASE=')),after.slice(after.indexOf('export const SWITCH1253_REVIEWED_RELEASE=')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const draft=m.prepareSwitch1253ItemImageManifest(),ids=Object.keys(draft.items);
const rows=ids.map(id=>{const p=m.SWITCH1253_NATIVE_PINS[id];return [id,p.originalNativeStreamSha256,p.sourcePngSha256,p.webpSha256,p.rasterStatus.includes('ASTC')?'A':'D',m.SWITCH1253_PREPARED_WEBP_SIZES[id]]});
assert.equal(sha(JSON.stringify(rows)+'\n'),'93a28ff76265eefa578bf9b2776970a26cb5979c1b0c69ed710e6a5c6a5b4a00'); // independently rebuilt from actual private QA receipts and bytes
assert.equal(ids.length,60);assert.equal(rows.reduce((a,r)=>a+r[5],0),1213430);
assert.equal(sha(JSON.stringify(draft,null,2)+'\n'),'9d152d47c8d780cdf6b8a5109c43089a1bfb6d67c7c2d2daf838cb29a27ca944');
assert.equal(m.SWITCH1253_REVIEWED_RELEASE.mediaPublic,false);assert.deepEqual(Object.keys(m.SWITCH1253_REVIEWED_RELEASE.items),[]);
assert.equal(rows.filter(r=>r[4]==='A').length,22);
const clone=structuredClone;
const {gate,...pending}=draft.publication;
const release={...pending,mediaPublic:true,rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'c'.repeat(64),items:{}};
const manifest=clone(draft);
for(const [id,e] of Object.entries(manifest.items)){e.publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';release.items[id]={originalNativeStreamSha256:e.originalNativeStreamSha256,sourcePngSha256:e.sourcePngSha256,webpSha256:e.webpSha256,rightsStatus:e.rightsStatus,publicationDecision:e.publicationDecision,visibility:e.visibility}}
const {mediaPublic,items,...pub}=release;manifest.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...pub};
const good=m.validateSwitch1253ItemImageCatalog(manifest,release);
assert.equal(good.count,60);
const urls=Object.fromEntries(rows.map(([id,n,p,w])=>[id,'/web/ddv/item-images/'+draft.assetVariant+'/'+n.slice(0,2)+'/'+n+'-'+p+'-'+w+'.webp']));
let n=0;
for(let i=0;i<ids.length;i++){
 const id=ids[i],other=ids[(i+1)%ids.length];
 assert.equal(m.scopedSwitch1253ItemImageHref('/web',id,good),urls[id]);
 // Both manifest and synthetic approval maliciously agree on another real row; immutable pin still denies.
 let a=clone(manifest),r=clone(release);a.items[id]=clone(a.items[other]);r.items[id]=clone(r.items[other]);assert.throws(()=>m.validateSwitch1253ItemImageCatalog(a,r));n++;
 a=clone(manifest);r=clone(release);delete r.items[id];assert.throws(()=>m.validateSwitch1253ItemImageCatalog(a,r));n++;
 a=clone(manifest);r=clone(release);a.items[id].visibility=r.items[id].visibility='HIDDEN';assert.throws(()=>m.validateSwitch1253ItemImageCatalog(a,r));n++;
 a=clone(manifest);delete a.items[id];const c=m.validateSwitch1253ItemImageCatalog(a,release);assert.equal(c.count,59);assert.equal(m.switch1253ItemImagePath(id,c),null);assert.ok(m.switch1253ItemImagePath(other,c));n++;
}
for(const id of ['40002422','40006509','40006573','40006540','40001935','40002113','40001545','40800027','40300018','40001804','999000123']){
 const a=clone(manifest),r=clone(release);a.items[id]=clone(a.items[ids[0]]);r.items[id]=clone(r.items[ids[0]]);assert.throws(()=>m.validateSwitch1253ItemImageCatalog(a,r));assert.equal(m.switch1253ItemImagePath(id,good),null);n++;
}
assert.throws(()=>m.validateSwitch1253ItemImageCatalog(manifest));assert.throws(()=>m.validateSwitch1253ItemImageCatalog(draft,release));
let calls=0;await m.loadSwitch1253PublicItemImageSource('/web',()=>{calls++;throw Error('OFF fetch')});assert.equal(calls,0);
console.log('QRW1066_PRIVATE_RECEIPT_DIGEST_FIXED4_60_CROSSROW_251_CHECKS_PASS',n);
const repo=resolve('.'),root=await mkdtemp(join(repo,'.qrw1066-')),out=await mkdtemp(join(tmpdir(),'qrw1066-'));
let server,browser;
try{
 await writeFile(join(root,'paths.mjs'),"export const base='/web';");
 await writeFile(join(root,'Harness.svelte'),`<script>import ItemThumb from '$lib/ui/ItemThumb.svelte';export let ids=[];</script><main style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px">{#each ids as id (id)}<ItemThumb itemId={id} label={'QA-'+id} />{/each}<ItemThumb itemId="40002422" label="excluded"/></main>`);
 await writeFile(join(root,'entry.mjs'),`import {mount,tick} from 'svelte';import Harness from './Harness.svelte';import * as m from '$lib/item-media/switch1253-public-item-images.mjs';
 mount(Harness,{target:document.body,props:{ids:Object.keys(m.SWITCH1253_NATIVE_PINS)}});
 await tick();let detach,last,options=[];window.qrw={start:r=>{const c=m.createSwitch1253ManifestController(r,v=>{last=v;m.switch1253PublicItemImageSource.set(v)});const observedFetch=(u,o)=>{options.push({u,cache:o.cache,credentials:o.credentials,redirect:o.redirect,signal:o.signal instanceof AbortSignal});return fetch(u,o)};detach=m.attachSwitch1253ManifestLifecycle(c,'/web',window,document,observedFetch);},state:()=>last,options:()=>options,stop:()=>detach?.(),off:()=>m.loadSwitch1253PublicItemImageSource('/web')};`);
 await build({root,configFile:false,plugins:[svelte({configFile:false})],resolve:{alias:{'$lib':join(repo,'src/lib'),'$app/paths':join(root,'paths.mjs')}},build:{target:'esnext',outDir:out,emptyOutDir:true,cssCodeSplit:false,lib:{entry:join(root,'entry.mjs'),formats:['es'],fileName:()=> 'preview.js',cssFileName:'preview'},rollupOptions:{output:{inlineDynamicImports:true}}}});
 assert.deepEqual((await readdir(out)).sort(),['preview.css','preview.js']);
 const js=await readFile(join(out,'preview.js')),css=await readFile(join(out,'preview.css'));
 const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/preview.css"><style>:root{--border:#888;--surface-raised:#eee;--ink-muted:#555}</style><script type="module" src="/preview.js"></script>';
 server=createServer((req,res)=>{const p=req.url;res.setHeader('Cache-Control','no-store');if(p==='/'){res.setHeader('Content-Type','text/html');res.end(html)}else if(p==='/preview.js'){res.setHeader('Content-Type','text/javascript');res.end(js)}else if(p==='/preview.css'){res.setHeader('Content-Type','text/css');res.end(css)}else{res.statusCode=404;res.end()}});
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1600,height:1400},serviceWorkers:'block'}),page=await ctx.newPage();
 const errors=[],unsafe=[],hits=new Set(),manifestHeaders=[];
 page.on('pageerror',e=>errors.push(String(e)));ctx.on('request',r=>{if(r.method()!=='GET'||!r.url().startsWith(origin+'/'))unsafe.push(r.url())});
 const swatch=Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQsnoUuf+BiOh/AAA=','base64');
 for(const row of rows)assert.notEqual(sha(swatch),row[3]);
 let mode='full',hold=null,releaseHold=null;
 await page.route('**/ddv/item-images/**',async route=>{
 const p=new URL(route.request().url()).pathname;
 if(p.endsWith('/manifest.json')){
  manifestHeaders.push(route.request().headers());
  if(hold)await hold;
  const a=clone(manifest);
  if(mode==='half')for(let i=0;i<ids.length;i+=2)delete a.items[ids[i]];
  if(mode==='empty')a.items={};
  if(mode==='swap')a.items[ids[10]]=clone(a.items[ids[11]]);
  return route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify(a)});
 }
 const id=ids.find(id=>urls[id]===p);assert.ok(id,'unexpected media URL '+p);hits.add(id);
 return route.fulfill({status:200,contentType:'image/webp',body:swatch});
 });
 const expect=async wanted=>{await page.waitForFunction(w=>{const got=[...document.querySelectorAll('[data-item-thumb-id] img')];return got.length===w.length&&got.every(i=>i.complete&&i.naturalWidth===8&&w.includes(i.closest('[data-item-thumb-id]').dataset.itemThumbId))},wanted,{timeout:30000});const actual=await page.locator('[data-item-thumb-id] img').evaluateAll(els=>els.map(i=>[i.closest('[data-item-thumb-id]').dataset.itemThumbId,new URL(i.src).pathname,i.alt]));assert.deepEqual(actual.sort(),wanted.map(id=>[id,urls[id],'QA-'+id]).sort())};
 await page.goto(origin);await page.waitForFunction(()=>!!window.qrw);await expect([]);assert.equal(hits.size,0);assert.equal(manifestHeaders.length,0);
 await page.evaluate(r=>window.qrw.start(r),release);await expect(ids);assert.equal(hits.size,60);
 console.log('QRW1066_ACTUAL_COMPILED_60_SYNTHETIC_POS_OFF_EXACT_URL_ALT_PASS');
 const refresh=()=>page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 mode='half';hold=new Promise(yes=>releaseHold=yes);await refresh();await expect([]);releaseHold();hold=null;await expect(ids.filter((_,i)=>i%2===1));
 mode='full';await refresh();await expect(ids);
 mode='swap';await refresh();await expect([]);await page.waitForFunction(()=>window.qrw.state()?.reason?.includes('ITEM_ID_NATIVE_SHA'));
 mode='full';await refresh();await expect(ids);
 mode='empty';await refresh();await expect([]);await page.waitForFunction(()=>window.qrw.state()?.reason?.includes('MAPPING_EMPTY_OR_OVERSIZED'));
 mode='full';await refresh();await expect(ids);
 await page.evaluate(()=>window.qrw.stop());await expect([]);await page.evaluate(()=>window.qrw.off());await expect([]);
 assert.ok(manifestHeaders.length>=7);const options=await page.evaluate(()=>window.qrw.options());assert.equal(options.length,manifestHeaders.length);assert.ok(options.every(o=>o.u==='/web/'+m.SWITCH1253_MANIFEST_PATH&&o.cache==='no-store'&&o.credentials==='omit'&&o.redirect==='error'&&o.signal));console.log('QRW1066_REAL_FETCH_INIT_AND_INTERCEPTED_NETWORK_COUNT_PASS',options.length,JSON.stringify(manifestHeaders.map(h=>({cacheControl:h['cache-control']??null,pragma:h.pragma??null}))));
 assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
 console.log('QRW1066_ACTUAL_60_HALF_WITHDRAW_CLEAR_BEFORE_RESPONSE_RESTORE_SWAP_EMPTY_DISPOSE_PASS',manifestHeaders.length);
 await ctx.close();
}finally{await browser?.close();if(server)await new Promise(yes=>server.close(yes));await rm(root,{recursive:true,force:true});await rm(out,{recursive:true,force:true})}
