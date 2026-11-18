// 04 QR-W: MEDIA WEB runtime boundary only, independent of 04 QR-S signer/issuer trusted-checkout QA.
// Replays literal shell staging from fixed Pages Source PR2256 under an isolated temporary proof tree.
// No cloud publish, real CDN withdrawal, protected merge, Save, keys or permission change.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(new URL('../',import.meta.url).pathname);
const candidate='baa8337c71f194b379bdd147354def9e55b0f2e8';
const prior='b27819af3ea4d3d8e45a126ba5981e0dfbdc5db5';
const newPages=readFileSync(join(root,'.github/workflows/pages.yml'),'utf8');
const oldPages=execFileSync('git',['show',prior+':.github/workflows/pages.yml'],{cwd:root,encoding:'utf8'});
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'qrw2256-media-proof-'));
after(()=>rmSync(temp,{recursive:true,force:true}));
const registryPath='ops/ddv-steam-public-media-prior-on-cache.json';
const scriptPath='scripts/int-steam-public-media-signed-batch.mjs';
const batchPath='ops/ddv-steam-public-media-signed-batch.json';
const digest=b=>createHash('sha256').update(b).digest('hex');
const rootUrl='https://dreamwishwand.github.io/web/';

function exactStagingBody(yaml){
 const start='          mkdir -p "$RUNNER_TEMP/wand-steam-media-proof/scripts" "$RUNNER_TEMP/wand-steam-media-proof/ops"';
 const end='          (cd "$dir" && node scripts/int-protected-ci-gate.mjs deploy)';
 const a=yaml.indexOf(start),b=yaml.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Pages exact existing deploy staging block missing');
 return yaml.slice(a,b).split('\n').map(s=>s.startsWith('          ')?s.slice(10):s).join('\n');
}
function stage(yaml,sha){
 const runner=mkdtempSync(join(temp,'runner-'));
 const script=exactStagingBody(yaml);
 const res=spawnSync('bash',['-euo','pipefail','-c','dir="$GIT_REPO"\n'+script],{
  cwd:root,encoding:'utf8',env:{...process.env,GIT_REPO:root,GITHUB_SHA:sha,RUNNER_TEMP:runner},
  timeout:30000
 });
 assert.equal(res.status,0,'real Pages shell staging failed: '+res.stderr);
 return {runner,proof:join(runner,'wand-steam-media-proof')};
}
async function loadedModule(proof,stamp){
 // Actual product entrypoint, not an interpreter copy of the validation logic.
 return import(pathToFileURL(join(proof,scriptPath)).href+'?scope='+stamp);
}
test('fixed PR2256 Pages stages exact THREE immutable protected signer inputs with source Git Blob parity',async()=>{
 const shell=exactStagingBody(newPages);
 assert.equal((shell.match(/git -C "\$dir" show/g)||[]).length,3);
 assert.match(shell,/git hash-object --no-filters/);
 assert.equal(git('rev-parse',candidate+':.github/workflows/pages.yml'),'f428f95f047a9564e2d5febd646b02461854f5ac');
 assert.equal(git('rev-parse',prior+':.github/workflows/pages.yml'),'ed8aabff1dc8c8b426054c7dff0d88faa2b02da4');
 const {proof}=stage(newPages,candidate);
 for(const path of [scriptPath,batchPath,registryPath]){
  assert.ok(existsSync(join(proof,path)),path);
  assert.equal(git('hash-object','--no-filters',join(proof,path)),
   git('rev-parse',candidate+':'+path),path);
 }
 const registry=JSON.parse(readFileSync(join(proof,registryPath),'utf8'));
 assert.equal(registry.schema,'wand.int.steam-public-signed-prior-on-cache@1');
 assert.deepEqual(registry.records,[]);
 const mod=await loadedModule(proof,'new');
 assert.equal(mod.readBatch().items.length,3);
 assert.equal(mod.readBatch().withdrawn.length,0);
 assert.equal(mod.readBatch().consumer,'OFF');
});
test('old true red: exact previous Pages source stage does not copy new mandatory registry, signer import ENOENT',async()=>{
 const old=exactStagingBody(oldPages);
 assert.equal(old.includes(registryPath),false);
 const {proof}=stage(oldPages,prior);
 assert.ok(!existsSync(join(proof,registryPath)));
 await assert.rejects(loadedModule(proof,'prior'),/ENOENT/);
});
test('new staged exact signed Steam WebP3 verification still recognizes all 3 original pixel SHA/MIME GET HEAD',async()=>{
 const {proof}=stage(newPages,candidate),mod=await loadedModule(proof,'http');
 const batch=mod.readBatch();
 assert.equal(batch.items.length,3);
 const byURL=new Map(batch.items.map(i=>{
  const path=mod.pathFor(i.sha256),body=readFileSync(join(root,'static',path));
  assert.equal(body.length,i.bytes);
  assert.equal(digest(body),i.sha256);
  assert.equal(body.toString('ascii',0,4),'RIFF');
  assert.equal(body.toString('ascii',8,12),'WEBP');
  return [new URL(path,rootUrl).href,body];
 }));
 const seen=new Set();
 const fakeFetch=async (url,{method,redirect})=>{
  assert.equal(redirect,'manual');
  const body=byURL.get(url);assert.ok(body,'unapproved public WebP '+url);
  seen.add(method+' '+url);
  return new Response(method==='GET'?body:null,
   {status:200,headers:{'content-type':'image/webp','content-length':String(body.length)}});
 };
 assert.deepEqual(await mod.verifyLive(batch,rootUrl,fakeFetch),{publicItems:3,withdrawn:0});
 assert.equal(seen.size,6);
 for(const url of byURL.keys())for(const method of ['GET','HEAD'])
  assert(seen.has(method+' '+url));
});
test('new staged empty actual protected cache remains fail-closed before any network even if forged 404',async()=>{
 const {proof}=stage(newPages,candidate),mod=await loadedModule(proof,'closed');
 const batch=structuredClone(mod.readBatch());
 const item=batch.items[0];batch.items=[];batch.withdrawn=[{itemId:item.itemId,sha256:item.sha256}];
 let calls=0;
 await assert.rejects(mod.verifyLive(batch,rootUrl,async()=>{
  calls++;return new Response(null,{status:404});
 }),/WITHDRAWAL_PRIOR_REAL_ON_VALIDATORS_REQUIRED/);
 assert.equal(calls,0);
});
test('altered, missing, duplicate authority is not silently accepted as published real prior ON proof',async()=>{
 for(const variant of ['missing','malformed','forged']){
  const {proof}=stage(newPages,candidate),target=join(proof,registryPath);
  if(variant==='missing')rmSync(target);
  else if(variant==='malformed')writeFileSync(target,'{"schema":"unknown","records":[]}');
  else writeFileSync(target,JSON.stringify({schema:'wand.int.steam-public-signed-prior-on-cache@1',records:[
   {itemId:'40300045',sha256:'a'.repeat(64),etag:'"old"',lastModified:'Mon, 18 Nov 2026 11:38:36 GMT',
    protectedCommit:'b'.repeat(40),pagesRunId:1,observerRunId:1,signedBundleSha256:'c'.repeat(64),
    releaseState:'SIGNED_PAGES_ON_OBSERVED',recordedBy:'CALLER'}]}));
  if(variant!=='missing')assert.notEqual(git('hash-object','--no-filters',target),
    git('rev-parse',candidate+':'+registryPath));
  await assert.rejects(loadedModule(proof,variant),
   variant==='missing'?/ENOENT/:variant==='malformed'?/PRIOR_ON_CACHE_SCHEMA/:/PRIOR_ON_DATE_INVALID/);
 }
});
