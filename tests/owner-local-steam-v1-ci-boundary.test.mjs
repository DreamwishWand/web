// Synthetic-only public harness; private Owner UI never checked out in CI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {access,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {startOwnerLocalV1Server} from '../tools/owner-local-steam-v1/server.mjs';
const dir=new URL('../tools/owner-local-steam-v1/',import.meta.url);
const removed=['index.html','page.mjs','dev-read.html','dev-read-page.mjs'];
const shared=['attestation.mjs','worker-core.mjs','worker.mjs','dev-read.worker.mjs'];
const prefix='/tools/owner-local-steam-v1/';
const http=(port,path,method='GET',host='127.0.0.1:'+port)=>new Promise((resolve,reject)=>{
 const req=request({hostname:'127.0.0.1',port,path,method,headers:{host}},res=>{
  const chunks=[];res.on('data',x=>chunks.push(x));
  res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
 });req.on('error',reject);req.end();
});
test('ACT559 public runner cannot start Owner mode and private UI paths absent',async()=>{
 for(const name of removed)await assert.rejects(access(new URL(name,dir)),{code:'ENOENT'});
 for(const options of [undefined,{}, {ciFixture:false},{ciFixture:1},{ciFixture:'true'}])
  await assert.rejects(startOwnerLocalV1Server(options),/OWNER_LOCAL_CI_FIXTURE_REQUIRED/);
 const p=spawnSync(process.execPath,[new URL('server.mjs',dir).pathname],{encoding:'utf8'});
 assert.equal(p.status,12,p.stderr);assert.equal(p.stdout,'');
 assert.match(p.stderr,/OWNER_LOCAL_CI_FIXTURE_REQUIRED/);
});
test('ACT559 exact loopback shared/fixture allowlist, no Owner UI or upload',async()=>{
 const {server,port,url}=await startOwnerLocalV1Server({ciFixture:true});
 try{
  assert.equal(server.address().address,'127.0.0.1');
  assert.equal(url,'http://127.0.0.1:'+port+'/tests/stage-g/index.html');
  for(const name of removed){
   for(const method of ['GET','HEAD']){
    const r=await http(port,prefix+name,method);
    assert.equal(r.status,403,name+' '+method);assert.equal(r.body.length,0);
   }
  }
  assert.equal((await http(port,prefix+'index.html','POST')).status,405);
  for(const path of ['/package.json','/README.md','/crates/ddv-save-core/Cargo.toml',
   '/tools/owner-local-steam-v1/%2e%2e/%2e%2e/package.json',
   '/tools/owner-local-steam-v1/%2fetc%2fpasswd','/tests/stage-f/fixtures/private.p1g'])
   assert.equal((await http(port,path)).status,403,path);
  assert.equal((await http(port,prefix+'worker.mjs','GET','evil.invalid')).status,403);
  assert.equal((await http(port,prefix+'worker.mjs','GET','localhost:'+port)).status,403);
  for(const name of shared){
   const r=await http(port,prefix+name);
   assert.equal(r.status,200,name);assert.deepEqual(r.body,await readFile(new URL(name,dir)));
   const head=await http(port,prefix+name,'HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);
   for(const [k,v] of Object.entries({'cache-control':'no-store','x-content-type-options':'nosniff',
     'x-frame-options':'DENY','referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin',
     'cross-origin-opener-policy':'same-origin'}))assert.equal(r.headers[k],v,k);
   assert.match(r.headers['content-security-policy'],/default-src 'none'/);
   assert.match(r.headers['content-security-policy'],/connect-src 'self'/);
   assert.match(r.headers['content-security-policy'],/form-action 'none'/);
   assert.match(r.headers['content-security-policy'],/frame-ancestors 'none'/);
  }
  for(const path of ['/tests/stage-g/index.html','/tests/stage-h/index.html'])
   assert.equal((await http(port,path)).status,200,path);
 }finally{await new Promise((ok,err)=>server.close(e=>e?err(e):ok()))}
});
