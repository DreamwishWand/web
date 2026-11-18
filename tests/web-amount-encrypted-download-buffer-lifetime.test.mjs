import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';
import {consumeVerifiedAmountDownloadBytes as consume} from '../src/lib/dev/consume-verified-amount-download-bytes.mjs';
const component=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
const placement=readFileSync(new URL('../src/lib/dev/LocalPlacementEditorDev.svelte',import.meta.url),'utf8');

test('Real Blob copies verified encrypted bytes before synchronous buffer zeroization',async()=>{
 const secret=new Uint8Array([0x50,0x31,0x47,0x00,0xa1,0xf2]);
 const blob=consume(secret,bytes=>new Blob([bytes],{type:'application/octet-stream'}));
 assert.ok(blob instanceof Blob);
 assert.deepEqual([...secret],[0,0,0,0,0,0]);
 assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[0x50,0x31,0x47,0,0xa1,0xf2]);
 assert.equal(blob.type,'application/octet-stream');
});
test('Short-circuit stale Session still zeroizes bytes without creating a Blob or URL',()=>{
 const bytes=new Uint8Array([9,8,7]);
 const value=consume(bytes,()=>undefined);
 assert.equal(value,undefined);
 assert.deepEqual([...bytes],[0,0,0]);
});
test('Synthetic Blob/URL/DOM failure always wipes bytes and preserves original denial',()=>{
 const bytes=new Uint8Array([41,42,43]);
 assert.throws(()=>consume(bytes,()=>{throw Error('SYNTHETIC_CREATE_OBJECT_URL_FAILURE')}),/SYNTHETIC_CREATE_OBJECT_URL_FAILURE/);
 assert.deepEqual([...bytes],[0,0,0]);
});
test('Malformed consumer or asynchronous consumer is rejected with zeroization',()=>{
 const missing=new Uint8Array([5,4,3]);
 assert.throws(()=>consume(missing,null),/AMOUNT_DOWNLOAD_CONSUMER_DENIED/);
 assert.deepEqual([...missing],[0,0,0]);
 const asyncBytes=new Uint8Array([4,5,6]);
 assert.throws(()=>consume(asyncBytes,()=>Promise.resolve('unsafe')),/AMOUNT_DOWNLOAD_CONSUMER_DENIED/);
 assert.deepEqual([...asyncBytes],[0,0,0]);
 assert.throws(()=>consume([1,2,3],()=>{}),/AMOUNT_DOWNLOAD_CONSUMER_DENIED/);
});
test('Verified amount local UI consumes already-scoped download without retaining transient bytes',()=>{
 const fn=component.split('async function downloadCopy(which)')[1]?.split('async function close()')[0]??'';
 assert.match(fn,/await active\.downloadVerifiedCopy\(which\)/);
 assert.match(fn,/consumeVerifiedAmountDownloadBytes\(result\.encryptedBytes,bytes=>\{/);
 assert.match(fn,/workflow!==active\|\|active\.snapshot\(\)\.phase==='closed'/);
 assert.match(fn,/new Blob\(\[bytes\],\{type:'application\/octet-stream'\}\)/);
 assert.doesNotMatch(fn,/new Blob\(\[result\.encryptedBytes\]/);
 assert.match(fn,/URL\.revokeObjectURL\(url\)/);
 assert.match(component,/import \{consumeVerifiedAmountDownloadBytes\} from '\.\/consume-verified-amount-download-bytes\.mjs'/);
 assert.match(component,/data-product-writer="off"/);
 assert.match(component,/data-cloud="off"/);
 assert.match(component,/data-original-overwrite="off"/);
 const compiled=compile(component,{filename:'LocalAmountEditorDev.svelte',generate:'client'});
 assert.ok(compiled.js.code.length>0);
});
test('Existing placement editor bytes are still wiped, no new Worker or Save authority',()=>{
 assert.match(placement,/r\.encryptedBytes\.fill\(0\)/);
 const helper=readFileSync(new URL('../src/lib/dev/consume-verified-amount-download-bytes.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(helper,/fetch\(|localStorage|sessionStorage|new Worker|\.postMessage\(|stageTyped|exportEditedCopy|decode|encrypt/);
});
