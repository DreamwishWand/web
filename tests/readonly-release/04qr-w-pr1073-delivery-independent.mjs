import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {inspectReleasePins} from '../../scripts/readonly-release/seal.mjs';
import {RELEASE_TUPLES,ACTIVE_RELEASE_TUPLE,releaseDelivery} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {readonlyReleaseIdentityText} from '../../src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs';
const S='ca38dbca655fcf5fd54a9193a7bd18fad2ec892d',B='51fde043e024e2d84fd1c4c28a0c787748b82277';
const expected={
'.github/workflows/01a-stable-readonly-release-loader.yml':'16dbe094b223ecc3fe84a27b25442038a9050a56',
'.github/workflows/pages.yml':'d3e41e1477610fd9dedac30fde87def71d1449ef',
'scripts/readonly-release/seal.mjs':'919b4275c4b9aaeeab0037e832ff5d9480b4e262',
'scripts/wasm-distribution/build-candidate.mjs':'a57df32a076f093164b1bdf59f7094d473426512',
'scripts/wasm-distribution/verify-protected-release.mjs':'d78d0048d2887cb8931bbb5ee453e874441bfb29',
'src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs':'ea7ac6e0f35950b070f72078b0b1ac901890d8e0',
'src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs':'316cf8f5649739a8a20537c5dd5dbb9f77e68711',
'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs':'d5b167f35b10ecc5b16d40e84e9d9bb324288539',
'tests/protected-readonly-release.test.mjs':'456a05309aa838ecd52107622c879945e644ac1d',
'tests/readonly-release/smoke.mjs':'302482b9da7d139f11ac05daac43cc6065160664',
'tests/wasm-distribution/chrome-smoke.mjs':'4677dfddee45ebb72734e4a998168d45d53502ca'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(expected).map(p=>(p.endsWith('release-trust.mjs')?'A':'M')+'\t'+p).sort());
for(const [p,h] of Object.entries(expected)){assert.equal(git('rev-parse',S+':'+p),h);assert.equal(git('rev-parse','HEAD:'+p),h)}
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\ttests/readonly-release/04qr-w-pr1073-delivery-independent.mjs','A\t.github/workflows/04qr-w-pr1073-delivery-independent.yml'].sort());
assert.equal(ACTIVE_RELEASE_TUPLE,RELEASE_TUPLES[0]);
assert.equal(git('show','HEAD:src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs').includes('PROTECTED_READONLY_RELEASE_ANCHOR=null;'),true);
const sha=b=>createHash('sha256').update(b).digest('hex'),dir=resolve(process.argv[2]);
const pins=await inspectReleasePins(dir,B),names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const bytes=Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(join(dir,n))])));
const modules=Object.fromEntries(await Promise.all(['product-rust-wasm-candidate-loader.mjs','product-rust-wasm-release-loader.mjs','product-rust-wasm-release-trust.mjs'].map(async n=>[n,await readFile('src/lib/ddv/core/save/'+n)])));
const root=await mkdtemp(join(tmpdir(),'qrw1073-'));
const worker=`import {loadProtectedReadonlyRustWasm as load} from './product-rust-wasm-release-loader.mjs';
let count=0;const orig=self.fetch.bind(self);self.fetch=(u,o)=>{count++;if(o.cache!=='no-store'||o.redirect!=='error'||o.mode!=='same-origin'||o.credentials!=='same-origin')throw Error('FETCH_POLICY');return orig(u,o)};
self.onmessage=async()=>{let first;try{const r=await load();first={ok:true,abi:typeof r.WorkerWasmSource==='function',flags:[r.runtimeSignatureVerified,r.qaCandidate,r.productConsumerEnabled,r.writerAuthorized,r.nativeV3Verified,r.applyAuthorized],source:r.sourceHead}}catch(e){first={ok:false,error:String(e)}}let replay;try{await load();replay='ACCEPTED'}catch(e){replay=String(e)}self.postMessage({first,replay,count})};`;
let current,network=[],server,browser;
const makeManifest=(t,mut)=>{const m=JSON.parse(bytes['manifest.json']);if(t!==RELEASE_TUPLES[0]){m.source.repository=t.repository;m.delivery=releaseDelivery(t)}if(mut)mut(m);return Buffer.from(JSON.stringify(m))};
const csp="default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";
function response(req,res){
 const u=new URL(req.url,'https://'+req.headers.host),p=u.pathname;
 const headers={'content-security-policy':csp,'cache-control':'no-store','x-content-type-options':'nosniff'};
 const send=(status,type,body,extra={})=>{res.writeHead(status,{...headers,'content-type':type,...extra});res.end(body)};
 if(p==='/fixture.html'||p==='/web/fixture.html')return send(200,'text/html','<!doctype html><title>isolated QR fixture</title>');
 if(p.endsWith('/worker.mjs'))return send(200,'text/javascript',worker);
 if(p.endsWith('/product-rust-wasm-release-anchor.mjs'))return send(200,'text/javascript','export const PROTECTED_READONLY_RELEASE_ANCHOR=Object.freeze('+JSON.stringify(current.anchor)+');');
 const n=p.split('/').at(-1);if(modules[n])return send(200,'text/javascript',modules[n]);
 if(p.includes('/worker-wasm/')&&names.includes(n)){
  network.push([u.origin,p,req.method]);
  let b=n==='manifest.json'?current.manifest:bytes[n],type=n.endsWith('.json')?'application/json':n.endsWith('.wasm')?'application/wasm':'text/javascript';
  if(current.fault==='redirect'&&n==='manifest.json')return send(302,'text/plain','redirect',{'location':u.origin+'/forbidden-redirect-target'});
  if(current.fault==='downgrade'&&n==='manifest.json')return send(301,'text/plain','redirect',{'location':'http://dreamwishwand.com/forbidden-redirect-target'});
  if(current.fault==='mime'&&n==='manifest.json')type='text/html';
  if(current.fault==='short'&&n==='manifest.json')b=b.subarray(0,b.length-1);
  if(current.fault==='tamper'&&n==='ddv_save_core_bg.wasm'){b=Buffer.from(b);b[b.length-1]^=1}
  return send(200,type,b);
 }
 network.push(['UNEXPECTED',p,req.method]);return send(404,'text/plain','denied');
}
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=dreamwishwand.com','-addext','subjectAltName=DNS:dreamwishwand.com,DNS:dreamwishwand.github.io','-keyout',join(root,'key.pem'),'-out',join(root,'cert.pem')],{stdio:'ignore'});
 server=createServer({key:await readFile(join(root,'key.pem')),cert:await readFile(join(root,'cert.pem'))},response);
 await new Promise((y,n)=>{server.once('error',n);server.listen(0,'127.0.0.1',y)});
 const port=server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server',`--host-resolver-rules=MAP dreamwishwand.github.io 127.0.0.1:${port}, MAP dreamwishwand.com 127.0.0.1:${port}, MAP * ~NOTFOUND`]});
 // Self-signed certificate is accepted ONLY in this isolated loopback fixture context.
 // No live-site visit, no public TLS validation bypass.
 const ctx=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'});
 const page=await ctx.newPage();
 const run=async(label,t,{origin=t.origin,base=t.basePath,workerBase=base,manifest=t===RELEASE_TUPLES[0]?bytes['manifest.json']:makeManifest(t),fault='',error=null,count=3}={})=>{
  const p={...pins,manifestSha256:sha(manifest),manifestSizeBytes:manifest.length};
  const anchor={contract:'wand.r22.protected-readonly-release@1',...t,pins:p,attestationVerifiedAtBuild:true};
  anchor.releaseId=sha(readonlyReleaseIdentityText(anchor));current={anchor,manifest,fault};network=[];
  await page.goto(origin+base+'/fixture.html?case='+label,{waitUntil:'load',timeout:20000});
  const result=await page.evaluate(async ({url})=>{return await new Promise((yes,no)=>{const w=new Worker(url,{type:'module'});const timer=setTimeout(()=>{w.terminate();no(Error('WORKER_TIMEOUT'))},20000);w.onmessage=e=>{clearTimeout(timer);w.terminate();yes(e.data)};w.onerror=e=>{clearTimeout(timer);w.terminate();no(Error(e.message))};w.postMessage(1)})},{url:workerBase+'/_app/'+label+'/worker.mjs'});
  assert.equal(result.count,count,label+JSON.stringify(result));assert.match(result.replay,/LOAD_REPLAY_DENIED/,label);
  if(error){assert.equal(result.first.ok,false,label);assert.match(result.first.error,new RegExp(error),label)}
  else{assert.equal(result.first.ok,true,label);assert.equal(result.first.abi,true);assert.equal(result.first.source,B);assert.deepEqual(result.first.flags,[false,false,false,false,false,false])}
  assert.equal(network.length,count,label+JSON.stringify(network));
  assert.ok(network.every(([o,p,method])=>o===origin&&p.startsWith(t.basePath+'/worker-wasm/')&&method==='GET'),label);
  console.log('QRW1073_WIRE_CASE',label,JSON.stringify({count,result}));
 };
 const [legacy,web,site]=RELEASE_TUPLES;
 await run('legacy',legacy);await run('webroot',web);await run('siteroot',site);
 await run('legacy_on_root',legacy,{origin:web.origin,base:'',workerBase:'',error:'WORKER_DELIVERY_SCOPE_DENIED',count:0});
 await run('root_on_legacy',web,{origin:legacy.origin,base:'/web',workerBase:'/web',error:'WORKER_DELIVERY_SCOPE_DENIED',count:0});
 await run('root_old_path',site,{workerBase:'/web',error:'WORKER_DELIVERY_SCOPE_DENIED',count:0});
 await run('legacy_wrong_path',legacy,{workerBase:'',error:'WORKER_DELIVERY_SCOPE_DENIED',count:0});
 await run('real302',site,{fault:'redirect',error:'SAME_ORIGIN_ASSET_FETCH_DENIED',count:1});
 await run('real301downgrade',web,{fault:'downgrade',error:'SAME_ORIGIN_ASSET_FETCH_DENIED',count:1});
 await run('realmime',site,{fault:'mime',error:'ASSET_CONTENT_TYPE',count:1});
 await run('realshort',web,{fault:'short',error:'ASSET_LENGTH_MISMATCH',count:1});
 await run('realtamper',site,{fault:'tamper',error:'ASSET_SHA256_MISMATCH',count:3});
 await run('root_legacy_manifest',site,{manifest:bytes['manifest.json'],error:'MANIFEST_PROVENANCE_OR_ABI_DENIED',count:1});
 await run('root_wrong_repoid',site,{manifest:makeManifest(site,m=>m.delivery.repositoryId='999'),error:'MANIFEST_PROVENANCE_OR_ABI_DENIED',count:1});
 await run('root_wrong_delivery',site,{manifest:makeManifest(site,m=>m.delivery.basePath='/web'),error:'MANIFEST_PROVENANCE_OR_ABI_DENIED',count:1});
 await run('root_cross_manifest',site,{manifest:makeManifest(web),error:'MANIFEST_PROVENANCE_OR_ABI_DENIED',count:1});
 await ctx.close();
 console.log('QRW1073_FIXED11_ACTUAL_CHROME_3POS_13NEG_REAL_WIRE_REPLAY_CSP_PASS; HISTORICAL_LEGACY_SIGNED3; ROOT_SYNTHETIC_ONLY; NO_LIVE_TLS_OR_PRODUCT_AUTHORITY');
}finally{await browser?.close();if(server)await new Promise(y=>server.close(y));await rm(root,{recursive:true,force:true})}
