import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {ROOT,readBatch,validateBatch,verifyLocal,verifyLive,pathFor,digest} from '../scripts/int-steam-public-media-signed-batch.mjs';
const plan=readBatch(),item=plan.items.find(x=>x.itemId==='40300045');
assert.ok(item,'first accepted player-visible Steam image must remain present');
const rel=pathFor(item.sha256);
const pinned=Object.fromEntries(plan.items.map(x=>[x.itemId,{
  webpSha256:x.sha256,rgba160Sha256:x.rgba160Sha256,bytes:x.bytes,
  width:x.width,height:x.height,visibility:x.visibility
}]));
function copyAllMediaInto(base){
  for(const entry of plan.items){
    const relpath=pathFor(entry.sha256),file=join(base,relpath);
    mkdirSync(dirname(file),{recursive:true});
    writeFileSync(file,readFileSync(join(ROOT,'static',relpath)));
  }
}
test('first Steam item and every signed-batch image are physically native-pinned',async()=>{
  assert.equal(item.itemId,'40300045');
  assert.ok(plan.items.length>=1&&plan.items.length<=25);
  assert.equal((await verifyLocal(plan,{kind:'source',pins:pinned})).count,plan.items.length);
  for(const entry of plan.items)
    assert.equal(digest(readFileSync(join(ROOT,'static',pathFor(entry.sha256)))),entry.sha256);
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
    copyAllMediaInto(join(dir,'static'));
    await verifyLocal(plan,{root:dir,kind:'source',pins:pinned});
    const path=join(dir,'static',rel),b=readFileSync(path),bad=Buffer.from(b);
    bad[32]^=1;writeFileSync(path,bad);
    await assert.rejects(verifyLocal(plan,{root:dir,kind:'source',pins:pinned}),/MEDIA_REAL_SHA256/);
    writeFileSync(path,b);writeFileSync(join(dirname(path),'second.webp'),'foreign');
    await assert.rejects(verifyLocal(plan,{root:dir,kind:'source',pins:pinned}),/MEDIA_EXACT_BATCH_ONLY/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('real source and built media paths reject symlinked ddv ancestor, even with authentic pixels',async()=>{
  const fixture=mkdtempSync(join(tmpdir(),'wand-media-ancestor-'));
  try{
    for(const kind of ['source','built']){
      const checkout=join(fixture,kind),base=join(checkout,kind==='source'?'static':'build');
      const external=join(fixture,kind+'-external');
      mkdirSync(base,{recursive:true});
      copyAllMediaInto(external);
      symlinkSync(join(external,'ddv'),join(base,'ddv'),'dir');
      await assert.rejects(verifyLocal(plan,{kind,root:checkout,pins:pinned}),/MEDIA_SYMLINK_ANCESTOR/);
      rmSync(join(base,'ddv'));
      copyAllMediaInto(base);
      assert.equal((await verifyLocal(plan,{kind,root:checkout,pins:pinned})).count,plan.items.length);
    }
  }finally{rmSync(fixture,{recursive:true,force:true});}
});
test('live image proof requires exact HTTPS host, unredirected GET/HEAD MIME and real bytes for ALL subjects',async()=>{
  const u='https://dreamwishwand.github.io/web/',b=readFileSync(join(ROOT,'static',rel));
  const expected=new Map(plan.items.map(x=>[
    new URL(pathFor(x.sha256),u).href,readFileSync(join(ROOT,'static',pathFor(x.sha256)))
  ]));
  const seen=new Set();
  const ok=async (url,{method})=>{
    assert.ok(expected.has(url),'unexpected hosted image URL '+url);
    const body=expected.get(url);seen.add(method+' '+url);
    return new Response(method==='GET'?body:null,{status:200,
      headers:{'content-type':'image/webp','content-length':String(body.length)}});
  };
  assert.deepEqual(await verifyLive(plan,u,ok),{publicItems:plan.items.length,withdrawn:0});
  for(const url of expected.keys())for(const method of ['GET','HEAD'])
    assert.ok(seen.has(method+' '+url),'every publicly signed subject must be read physically');
  await assert.rejects(verifyLive(plan,'https://foreign.example/web/',ok));
  await assert.rejects(verifyLive(plan,u,async()=>new Response(null,{status:302,
    headers:{location:'https://foreign.example'}})),/MEDIA_PUBLIC_NOT_OK_302/);
  await assert.rejects(verifyLive(plan,u,async (_url,{method})=>new Response(method==='GET'?b:null,
    {status:200,headers:{'content-type':'text/html'}})),/MEDIA_PUBLIC_WRONG_MIME/);
  await assert.rejects(verifyLive(plan,u,async (_url,{method})=>new Response(method==='GET'?Buffer.from('fake'):null,
    {status:200,headers:{'content-type':'image/webp'}})),/LIVE_IMAGE_BYTES/);
  if(plan.items.length>1)
    await assert.rejects(verifyLive(plan,u,async (_url,{method})=>new Response(method==='GET'?b:null,
      {status:200,headers:{'content-type':'image/webp'}})),/LIVE_IMAGE_BYTES|LIVE_IMAGE_SHA256/);
});
test('withdrawn image fails closed on still-cached old 200/304 and accepts verified 404 GET HEAD conditional',async()=>{
  const p=structuredClone(plan);p.items=[];p.withdrawn=[{itemId:item.itemId,sha256:item.sha256}];
  const u='https://dreamwishwand.github.io/web/';
  const denied=async()=>new Response(null,{status:404});
  assert.deepEqual(await verifyLive(p,u,denied),{publicItems:0,withdrawn:1});
  await assert.rejects(verifyLive(p,u,async()=>new Response(null,{status:200})),/WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED/);
  await assert.rejects(verifyLive(p,u,async()=>new Response(null,{status:304})),/WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED/);
});