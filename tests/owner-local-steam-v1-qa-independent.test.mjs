// 05 QR-C independent Stage G new-only local attestation + HTTP deny audit.
// No private P1G, keys, raw decoded JSON, upload endpoint, or product Writer.
import test from 'node:test';
import {request as rawHttpRequest} from 'node:http';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {
  OWNER_LOCAL_STEAM_FULL_VERSION,OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
  validateOwnerLocalSteamAttestation
} from '../tools/owner-local-steam-v1/attestation.mjs';
import {startOwnerLocalV1Server} from '../tools/owner-local-steam-v1/server.mjs';

const CLAIM=Object.freeze({
  contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,
  platform:'steam-windows',buildKind:'steam-full-version',
  fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,
  originalSha256:'ab'.repeat(32),evidenceKind:'owner-observed-installed-steam-fullversion',
  observedOutsideSave:true
});
const reject=(bad,msg)=>assert.throws(
  ()=>validateOwnerLocalSteamAttestation(bad),new RegExp(msg));

test('QG01 exact attestation is still a non-cryptographic owner claim only',()=>{
  const p=validateOwnerLocalSteamAttestation({...CLAIM});
  assert.equal(p.physicalBuildVerified,false);
  assert.equal(p.synthetic,false);
  assert.equal(p.build.externallyConfirmed,true);
  assert.equal(p.expectedOriginalSha256,CLAIM.originalSha256);
  assert.equal(Object.isFrozen(p),true);
  assert.equal(Object.isFrozen(p.build),true);
  assert.equal('writerAuthorized' in p,false);
  assert.equal('productReadAccepted' in p,false);
});

test('QG02 no inferred Switch BID, schema, mangled/uppercase Source SHA or extra trust flags',()=>{
  for(const bad of [
    {fullVersion:'v1.25.3'},{fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION+' '},
    {platform:'switch'}, {buildKind:'switch-bid'}, {schema:624},
    {schema:'626'}, {observedOutsideSave:false},
    {evidenceKind:'from-save-metadata'}, {physicalBuildVerified:true},
    {lastSaveDevice:'DeviceType_Windows'}, {sourceSha256:CLAIM.originalSha256},
    {originalSha256:'AB'.repeat(32)},{originalSha256:'f'.repeat(63)},
    {originalSha256:'f'.repeat(65)}, {originalSha256:''}
  ])reject({...CLAIM,...bad},'OWNER_LOCAL_WAIT_');
  reject(Object.assign(Object.create(null),CLAIM),'OWNER_LOCAL_WAIT_');
  reject(Object.assign(Object.create({isSystem:true}),CLAIM),'OWNER_LOCAL_WAIT_');
  reject(null,'OWNER_LOCAL_WAIT_');
});

test('QG03 synthetic attestation allowed only in explicit isolated CI harness, never Owner Worker default',()=>{
  const ci={...CLAIM,evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false};
  reject(ci,'SYNTHETIC_NOT_AUTHORIZED');
  const allowed=validateOwnerLocalSteamAttestation(ci,{allowSyntheticFixture:true});
  assert.equal(allowed.synthetic,true);
  assert.equal(allowed.physicalBuildVerified,false);
  assert.equal(allowed.evidenceKind,'ci-synthetic-fixture');
  reject({...ci,observedOutsideSave:true},'OWNER_LOCAL_WAIT_');
});

test('QG04 production localhost GET/HEAD static allowlist, deny client POST, rogue Host, files and CI fixture',async()=>{
  const {server,port}=await startOwnerLocalV1Server();
  const origin='http://127.0.0.1:'+port;
  try{
    const html=await fetch(origin+'/tools/owner-local-steam-v1/index.html');
    assert.equal(html.status,200);
    assert.match(await html.text(),/Owner-local P1G Rust V1 read-only proof/);
    for(const name of [
      '/tools/owner-local-steam-v1/worker-core.mjs',
      '/tools/owner-local-steam-v1/attestation.mjs',
      '/src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs'
    ])assert.equal((await fetch(origin+name)).status,200,name);
    const head=await fetch(origin+'/tools/owner-local-steam-v1/index.html',
      {method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(await head.text(),'');
    assert.match(html.headers.get('content-security-policy')||'',
      /connect-src 'self'/);
    assert.match(html.headers.get('content-security-policy')||'',
      /form-action 'none'/);
    assert.match(html.headers.get('content-security-policy')||'',
      /img-src 'none'/);
    assert.equal(html.headers.get('cross-origin-resource-policy'),'same-origin');
    assert.equal(html.headers.get('x-frame-options'),'DENY');
    assert.equal(html.headers.get('access-control-allow-origin'),null);
    assert.equal(html.headers.get('cache-control'),'no-store');

    for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
      const r=await fetch(origin+'/tools/owner-local-steam-v1/index.html',
        {method,body:method==='POST'?'owner-encrypted-p1g-in-band':undefined});
      assert.equal(r.status,405,method);
      assert.equal(await r.text(),'');
    }
    for(const path of [
      '/package.json','/.git/config','/README.md',
      '/tests/stage-f/fixtures/synthetic626.p1g',
      '/tests/stage-g/index.html','/tests/stage-e/pkg/../worker.mjs',
      '/private-original-save.p1g','/%2e%2e/package.json'
    ]){
      const r=await fetch(origin+path);
      assert.equal(r.status,403,path);
      assert.equal(await r.text(),'');
    }
    // A high-level fetch client can normalize/override Host; test on raw socket.
    const rogueStatus=await new Promise((resolve,reject)=>{
      const request=rawHttpRequest({
        hostname:'127.0.0.1',port,
        path:'/tools/owner-local-steam-v1/index.html',method:'GET',
        headers:{Host:'attacker.example'}
      },response=>{
        response.resume();
        response.on('end',()=>resolve(response.statusCode));
      });
      request.on('error',reject);
      request.end();
    });
    assert.equal(rogueStatus,403,'DNS rebinding actual HTTP Host refused');
    const originReq=await fetch(origin+'/tools/owner-local-steam-v1/index.html',
      {headers:{Origin:'https://attacker.example'}});
    assert.equal(originReq.headers.get('access-control-allow-origin'),null);
    assert.equal(originReq.headers.get('cross-origin-resource-policy'),'same-origin');
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});

test('QG05 CI-only allowlist enables synthetic fixture only in isolated test server',async()=>{
  const {server,port}=await startOwnerLocalV1Server({ciFixture:true});
  try{
    const origin='http://127.0.0.1:'+port;
    assert.equal((await fetch(origin+'/tests/stage-g/index.html')).status,200);
    // Normal monolithic CI does NOT generate the synthetic fixture; focused QA does.
    const syntheticPresent=existsSync(new URL('./stage-f/fixtures/synthetic626.p1g',import.meta.url));
    assert.equal((await fetch(origin+'/tests/stage-f/fixtures/synthetic626.p1g')).status,
      syntheticPresent?200:404);
    assert.equal((await fetch(origin+'/package.json')).status,403);
    assert.equal((await fetch(origin+'/tests/stage-g/index.html',{method:'POST'})).status,405);
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
