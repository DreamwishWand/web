import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {loadCollectionRuntime,COLLECTION_RUNTIME_INDEX_SHA256} from '../src/lib/collection/runtime.js';
import {collectionWorkspaceState,collectionReferenceSelection,collectionWorkspaceHref} from '../src/lib/collection/reference-navigation.js';

const root='static/ddv/collection/v1.25/';
const bytes=name=>readFileSync(root+name);
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const indexRaw=bytes('index.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixtures({indexData=indexRaw,shardEdit=null}={}){
 const calls=[];
 return {calls,fetch:async url=>{
  const name=String(url).split('/').at(-1);
  calls.push(name);
  const data=name==='index.json'?indexData:(shardEdit?.name===name?shardEdit.data:bytes(name));
  return {ok:true,arrayBuffer:async()=>ab(data)};
 }};
}
test('WEB192 post-fix independently pinned index is byte-exact and forged self-declared digest never reaches shards',async()=>{
 assert.equal(sha(indexRaw),COLLECTION_RUNTIME_INDEX_SHA256);
 const source=JSON.parse(indexRaw.toString('utf8'));
 for(const variant of [
  Buffer.from(JSON.stringify(source,null,2)),
  Buffer.from(JSON.stringify({...source,shards:source.shards.map((s,i)=>i===2?{...s,sha256:'f'.repeat(64)}:s)})),
  Buffer.from(JSON.stringify({...source,a:'COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2',f:['FABRICATED_TYPE',...source.f.slice(1)]})),
  Buffer.concat([indexRaw,Buffer.from('\n')])
 ]){
  const probe=fixtures({indexData:variant});
  await assert.rejects(loadCollectionRuntime('',probe.fetch),/trusted SHA-256 mismatch/);
  assert.deepEqual(probe.calls,['index.json']);
 }
});
test('WEB192 final shard colliding against first shard causes reject before any whole-corpus return',async()=>{
 const verified=await loadCollectionRuntime('',fixtures().fetch);
 assert.equal(verified.rows.length,12552);
 assert.equal(new Set(verified.rows.map(r=>r[0])).size,12552);
 const originalIndex=JSON.parse(indexRaw.toString('utf8'));
 const last=originalIndex.shards.at(-1),first=verified.rows[0][0];
 const altered=JSON.parse(bytes(last.file).toString('utf8'));
 altered.r.at(-1)[0]=first;
 const alteredRaw=Buffer.from(JSON.stringify(altered));
 const changedIndex={...originalIndex,shards:originalIndex.shards.map(s=>s.file===last.file?{...s,sha256:sha(alteredRaw),bytes:alteredRaw.byteLength}:s)};
 const probe=fixtures({indexData:Buffer.from(JSON.stringify(changedIndex)),shardEdit:{name:last.file,data:alteredRaw}});
 await assert.rejects(loadCollectionRuntime('',probe.fetch),/trusted SHA-256 mismatch/);
 assert.deepEqual(probe.calls,['index.json']);
});
test('WEB192 actual reload function late success/failure cannot resurrect earlier retry generation',async()=>{
 const page=readFileSync('src/routes/collection/+page.svelte','utf8');
 const body=page.match(/  async function reload\(\): Promise<void> \{[\s\S]*?\n  \}\n  onMount/);
 assert(body,'extract exact Owner reload implementation');
 const fn=body[0].replace(/\n  onMount$/,'');
 const requests=[];
 const ctx={base:'',loadCollectionRuntime:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),Error};
 const vmSource='let loadSequence=0;let runtimeIndex=null,rawRows=[],loading=false,error="";\n'+fn+'\nglobalThis.reload=reload;globalThis.observe=()=>({loadSequence,runtimeIndex,rawRows,loading,error});';
 vm.runInNewContext(ts.transpileModule(vmSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,ctx);
 const first=ctx.reload(),second=ctx.reload();
 assert.equal(requests.length,2);
 requests[1].resolve({index:{a:'SECOND'},rows:[[234]]});await second;
 requests[0].resolve({index:{a:'FIRST_STALE'},rows:[[123]]});await first;
 assert.equal(ctx.observe().runtimeIndex.a,'SECOND');
 assert.equal(ctx.observe().rawRows[0][0],234);
 const third=ctx.reload(),fourth=ctx.reload();
 requests[3].resolve({index:{a:'FOURTH'},rows:[[456]]});await fourth;
 requests[2].reject(new Error('STALE_FAILED_FIRST'));await third;
 assert.equal(ctx.observe().runtimeIndex.a,'FOURTH');
 assert.equal(ctx.observe().error,'');
 assert.equal(ctx.observe().loading,false);
 assert.match(page,/afterNavigate\(\(\{to\}\) => \{ if \(to\?\.url\) applyUrl\(to\.url\); \}\)/);
 assert.match(page,/\{#if invalidUrl\}/);
 assert.match(page,/version !== COLLECTION_SUPPORTED_VERSION/);
 console.log('QR_WEB192_POSTFIX_NEW_ASYNC_RACE_GUARD',JSON.stringify({lateSuccessIgnored:true,lateErrorIgnored:true,realBrowser:false}));
});
test('WEB192 route changes, contradictory facets and version poisoning cannot select detail; valid world search returns exact facet',()=>{
 const records=[{itemId:123,worlds:['IsDreamlightValley'],family:'Furniture'}];
 for(const suffix of [
 '?item=123&item=123&view=world','?view=universe&family=Furniture&item=123',
 '?view=world&universe=Mickey&item=123','?view=world&world=&item=123',
 '?item=%30%31%32%33','?item=123&version=',
 '?item=123&version=Steam&buildID=52BD625D9B4E0053','?item=123&Q=secret',
 '?item=123&q=%20&q=again'
 ]){
  const state=collectionWorkspaceState(new URL('/collection/'+suffix,'https://offline.invalid'));
  assert(state.invalid || state.version!=='1.25.0',suffix);
  assert(state.invalid || collectionReferenceSelection(records,state.itemId,state.version).status!=='found',suffix);
 }
 const state=collectionWorkspaceState(new URL('/collection/?view=world&world=IsDreamlightValley&q=%E5%AE%B6%E5%85%B7&item=123','https://offline.invalid'));
 assert.equal(state.invalid,false);
 const returned=collectionWorkspaceState(new URL(collectionWorkspaceHref('',state),'https://offline.invalid'));
 assert.equal(returned.itemId,'');assert.equal(returned.world,'IsDreamlightValley');assert.equal(returned.query,'家具');
});
test('WEB192 8 locale/320px/keyboard source structural nonregression, no personal or image-rights inference',()=>{
 const page=readFileSync('src/routes/collection/+page.svelte','utf8'),copy=readFileSync('src/lib/collection/copy.js','utf8');
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'])
  assert(copy.includes(locale+':')||copy.includes("'"+locale+"':"),locale);
 for(const token of ['detailCopy.notOwned','detailCopy.noMedia','data-collection-state="invalid-url"',
 '.item-detail-grid{grid-template-columns:1fr}',':focus-visible',
 '<a class="collection-card" href={referenceHref(item)}>',
 'type="search"','on:click={() => displayLimit += DISPLAY_LIMIT}'])
  assert(page.includes(token),token);
 assert(!/<img[\s>]/i.test(page));
 assert(!/owned:|discovered:|premiumOwned:|dlcOwned:/i.test(readFileSync('src/lib/collection/runtime.js','utf8')));
});
