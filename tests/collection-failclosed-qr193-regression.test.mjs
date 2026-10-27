import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {
  COLLECTION_RUNTIME_INDEX_SHA256,loadCollectionRuntime,assertUniqueCollectionItemIDs
} from '../src/lib/collection/runtime.js';
import {
  collectionWorkspaceState,collectionWorkspaceHref,collectionReferenceSelection
} from '../src/lib/collection/reference-navigation.js';

const root = 'static/ddv/collection/v1.25';
const raw = name => readFileSync(join(root,name));
const hex = bytes => createHash('sha256').update(bytes).digest('hex');
const indexBytes = raw('index.json');
const index = JSON.parse(indexBytes.toString('utf8'));
const toBuffer = bytes => bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
function mockFetch({indexRaw=indexBytes,replacements={},missing=null}={}) {
  return async url => {
    const name=String(url).split('/').pop();
    if(name===missing) return {ok:false,status:503};
    const bytes=name==='index.json'?indexRaw:(replacements[name]??raw(name));
    return {ok:true,status:200,arrayBuffer:async()=>toBuffer(bytes)};
  };
}
function urlState(q){return collectionWorkspaceState(new URL('/collection/'+q,'https://wand.invalid'));}
test('QR193 RED-1 reversed: checked-in Index root pin and dictionary/source/Shard/Count tampering denied before a Shard request',async()=>{
  assert.equal(hex(indexBytes),COLLECTION_RUNTIME_INDEX_SHA256);
  const loaded=await loadCollectionRuntime('',mockFetch());
  assert.equal(loaded.index.n,12552);assert.equal(loaded.rows.length,12552);
  for(const mutate of [
    i=>{i.f[0]='FORGED_CATEGORY';},
    i=>{i.wl[0][0]='FORGED_WORLD';},
    i=>{i.shards[0].sha256='0'.repeat(64);},
    i=>{i.shards[0].bytes++;},
    i=>{i.n++;},
    i=>{i.t.buildID='9A239D3DB569756D';},
    i=>{i.a='UNVERIFIED_SOURCE';}
  ]) {
    const changed=structuredClone(index);mutate(changed);
    const touched=Buffer.from(JSON.stringify(changed),'utf8');
    let calls=0;const orig=mockFetch({indexRaw:touched});
    await assert.rejects(loadCollectionRuntime('',async url=>{calls++;return orig(url);}),/trusted SHA-256 mismatch/);
    assert.equal(calls,1,'tampered root must deny before shard fetch');
  }
});
test('QR193 RED-2 reversed: cross-shard duplicate and unsafe numeric IDs rejected rather than first-match Detail',()=>{
  const a=JSON.parse(raw('records-00.json').toString('utf8')).r;
  const b=JSON.parse(raw('records-01.json').toString('utf8')).r;
  const seen=assertUniqueCollectionItemIDs(a);
  assert.equal(seen.size,a.length);
  const forged=structuredClone(b);
  forged[0][0]=a[0][0];
  assert.throws(()=>assertUniqueCollectionItemIDs(forged,seen),/duplicate or invalid ItemID/);
  assert.throws(()=>assertUniqueCollectionItemIDs([[Number.MAX_SAFE_INTEGER+1,0,0,0,[],[],[],[]]]),/duplicate or invalid ItemID/);
  const first={itemId:a[0][0],label:'first'};
  const duplicate={itemId:a[0][0],label:'forged'};
  assert.equal(collectionReferenceSelection([first,duplicate],String(first.itemId)).status,'unknown-item');
  assert.equal(collectionReferenceSelection([first,duplicate],String(first.itemId)).item,null);
});
test('QR193 RED-3 reversed: malicious, ambiguous and contradictory URL entrance refused with no selected Detail',()=>{
  for(const q of [
    '?item=507&item=abc&view=???&family=Furniture&world=WRONG',
    '?item=507&item=507','?item=0507','?item=5e2','?item=-1','?item=',
    '?view=???&item=507','?view=world&family=Furniture&item=507',
    '?view=category&world=WRONG&item=507',
    '?view=universe&world=IsDreamlightValley&item=507',
    '?view=world&world=One&world=Two&item=507',
    '?view=world&universe=Mickey&item=507',
    '?item=507&unexpected=true','?version=&item=507',
    '?q=one&q=two&item=507'
  ]) {
    const state=urlState(q);
    assert.equal(state.invalid,true,q);
    assert.equal(state.itemId,'',q);
  }
  const valid=urlState('?family=Furniture&universe=Mickey&expansion=BaseGame&q=%E6%A4%85%E5%AD%90&item=507');
  assert.equal(valid.invalid,false);
  assert.equal(valid.itemId,'507');
  const returned=collectionWorkspaceHref('',valid);
  assert.equal(urlState(new URL(returned,'https://wand.invalid').search).invalid,false);
  assert.equal(urlState(new URL(returned,'https://wand.invalid').search).view,'category');
  assert.equal(urlState(new URL(returned,'https://wand.invalid').search).expansion,'BaseGame');
});
test('Stale detail failures are suppressed by route invalid-URL branch and generation-guarded Retry',()=>{
  const page=readFileSync('src/routes/collection/+page.svelte','utf8');
  for(const token of ['invalidUrl = state.invalid','{#if invalidUrl || invalidFacet}','data-collection-state="invalid-url"',
    'const request = ++loadSequence','runtimeIndex = null; rawRows = []',
    'if (request !== loadSequence) return','if (request === loadSequence) loading = false',
    'afterNavigate(({to}) => { if (to?.url) applyUrl(to.url); }'])
    assert(page.includes(token),token);
});
