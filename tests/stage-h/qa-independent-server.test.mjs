// 05 QR-C independent Stage H localhost HTTP / DEV opt-in boundary, no fixtures needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {request as rawRequest} from 'node:http';
import {startOwnerLocalV1Server} from '../../tools/owner-local-steam-v1/server.mjs';

test('H-QA01 owner-local DEV UI is opt-in GET/HEAD and no upload/write method',async()=>{
  const {server,port}=await startOwnerLocalV1Server();
  const base='http://127.0.0.1:'+port;
  try{
    for(const path of [
      '/tools/owner-local-steam-v1/dev-read.html',
      '/tools/owner-local-steam-v1/dev-read-page.mjs',
      '/tools/owner-local-steam-v1/dev-read.worker.mjs'
    ]){
      const res=await fetch(base+path);
      assert.equal(res.status,200,path);
      assert.equal(res.headers.get('cache-control'),'no-store');
      assert.equal(res.headers.get('access-control-allow-origin'),null);
      const csp=res.headers.get('content-security-policy')||'';
      assert.match(csp,/connect-src 'self'/);
      assert.match(csp,/form-action 'none'/);
      assert.match(csp,/worker-src 'self'/);
      const head=await fetch(base+path,{method:'HEAD'});
      assert.equal(head.status,200);
      assert.equal(await head.text(),'');
    }
    for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
      const r=await fetch(base+'/tools/owner-local-steam-v1/dev-read.html',
        {method,body:method==='POST'?'NO_P1G_UPLOAD':undefined});
      assert.equal(r.status,405,method);
      assert.equal(await r.text(),'');
    }
  }finally{await new Promise(resolve=>server.close(resolve))}
});

test('H-QA02 unlisted CI synthetic file, private/config paths, rogue Host fail closed',async()=>{
  const {server,port}=await startOwnerLocalV1Server();
  const base='http://127.0.0.1:'+port;
  try{
    for(const path of [
      '/package.json','/.git/config','/PRIVATE_STEAM_SAVE.p1g',
      '/tests/stage-h/index.html','/tests/stage-f/fixtures/synthetic626.p1g',
      '/tools/owner-local-steam-v1/qa-independent-page.mjs'
    ]){
      const r=await fetch(base+path);
      assert.equal(r.status,403,path);
    }
    const host=await new Promise((resolve,reject)=>{
      const req=rawRequest({
        hostname:'127.0.0.1',port,
        path:'/tools/owner-local-steam-v1/dev-read.html',
        method:'GET',headers:{Host:'evil.attacker.example'}
      },res=>{res.resume();res.once('end',()=>resolve(res.statusCode))});
      req.once('error',reject);req.end();
    });
    assert.equal(host,403);
  }finally{await new Promise(resolve=>server.close(resolve))}
});

test('H-QA03 CI fixture is exposed only by explicit synthetic test server, never owner runtime',async()=>{
  const {server,port}=await startOwnerLocalV1Server({ciFixture:true});
  try{
    const base='http://127.0.0.1:'+port;
    for(const path of ['/tests/stage-h/index.html','/tests/stage-h/page.mjs',
      '/tests/stage-h/worker.mjs'])
      assert.equal((await fetch(base+path)).status,200,path);
    assert.equal((await fetch(base+'/package.json')).status,403);
    assert.equal((await fetch(base+'/tests/stage-h/index.html',
      {method:'POST',body:'do-not-upload'})).status,405);
  }finally{await new Promise(resolve=>server.close(resolve))}
});
