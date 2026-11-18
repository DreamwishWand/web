import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {ROOT,readBatch,validateBatch,verifyLocal,verifyLive,pathFor,digest} from '../scripts/int-steam-public-media-signed-batch.mjs';
const plan=readBatch(),item=plan.items[0],rel=pathFor(item.sha256);
const pinned={[item.itemId]:{webpSha256:item.sha256,rgba160Sha256:item.rgba160Sha256,bytes:item.bytes,width:160,height:160,visibility:item.visibility}};
test('single first Steam public game image is truly on-disk pinned in source',async()=>{
  assert.equal(item.itemId,'40300045');assert.equal(plan.items.length,1);
  assert.equal((await verifyLocal(plan,{kind:'source',pins:pinned})).count,1);
  assert.equal(digest(readFileSync(join(ROOT,'static',rel))),item.sha256);
});
test('signed media batch rejects unknown rights/hidden/duplicates/extra fields',async()=>{
  const bad=fn=>{const copy=structuredClone(plan);fn(copy);assert.throws(()=>validateBatch(copy));};
  bad(p=>p.items[0].visibility='HIDDEN');
  const foreign=structuredClone(plan);foreign.items[0].sha256='0'.repeat(64);
  await assert.rejects(verifyLocal(foreign,{kind:'source',pins:pinned}),/MEDIA_EXACT_BATCH_ONLY/);
  bad(p=>p.items.push({...p.items[0]}));
  bad(p=>p.withdrawn.push({itemId:item.itemId,sha256:'0'.repeat(64)}));
  bad(p=>p.items[0].bytes=200001);
  bad(p=>p.ownerDecision='UNKNOWN');
  bad(p=>p.consumer='ON');
  bad(p=>p.extra=true);
});
test('signed media batch refuses corruption and extra static media; rollback can remove approved path',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'wand-art-source-'));
  try{
    const path=join(dir,'static',rel);mkdirSync(dirname(path),{recursive:true});
    const b=readFileSync(join(ROOT,'static',rel));
    writeFileSync(path,b);
    await verifyLocal(plan,{root:dir,kind:'source',pins:pinned});
    const bad=Buffer.from(b);bad[32]^=1;writeFileSync(path,bad);
    await assert.rejects(verifyLocal(plan,{root:dir,kind:'source',pins:pinned}),/MEDIA_REAL_SHA256/);
    writeFileSync(path,b);writeFileSync(join(dirname(path),'second.webp'),'foreign');
    await assert.rejects(verifyLocal(plan,{root:dir,kind:'source',pins:pinned}),/MEDIA_EXACT_BATCH_ONLY/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('live image proof requires exact HTTPS host, unredirected GET/HEAD MIME and real bytes',async()=>{
  const b=readFileSync(join(ROOT,'static',rel));const u='https://dreamwishwand.github.io/web/';
  const ok=async (_url,{method})=>new Response(method==='GET'?b:null,{status:200,headers:{'content-type':'image/webp','content-length':String(b.length)}});
  assert.deepEqual(await verifyLive(plan,u,ok),{publicItems:1,withdrawn:0});
  await assert.rejects(verifyLive(plan,'https://foreign.example/web/',ok));
  await assert.rejects(verifyLive(plan,u,async()=>new Response(null,{status:302,headers:{location:'https://foreign.example'}})));
  await assert.rejects(verifyLive(plan,u,async()=>new Response(b,{status:200,headers:{'content-type':'text/html'}})),/MEDIA_PUBLIC_WRONG_MIME/);
  await assert.rejects(verifyLive(plan,u,async (_url,{method})=>new Response(method==='GET'?Buffer.from('fake'):null,{status:200,headers:{'content-type':'image/webp'}})),/LIVE_IMAGE_BYTES/);
});
test('withdrawn image fails closed on still-cached old 200/304 and accepts verified 404 GET HEAD conditional',async()=>{
  const p=structuredClone(plan);p.items=[];p.withdrawn=[{itemId:item.itemId,sha256:item.sha256}];
  const u='https://dreamwishwand.github.io/web/';
  const denied=async()=>new Response(null,{status:404});
  assert.deepEqual(await verifyLive(p,u,denied),{publicItems:0,withdrawn:1});
  await assert.rejects(verifyLive(p,u,async()=>new Response(null,{status:200})),/WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED/);
  await assert.rejects(verifyLive(p,u,async()=>new Response(null,{status:304})),/WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED/);
});