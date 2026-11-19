import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// 01A SOURCE CONTRACT ONLY: Rust WASM runtime and memory must be independently
// challenged by 05QR-C. This test prevents the old clear()-without-wipe
// regression at both prematurely terminated WorkerWasmSource paths.
const source=await readFile(new URL('../crates/ddv-save-core/src/wasm_worker.rs',import.meta.url),'utf8');
const method=(begin,end)=>{
  const a=source.indexOf(begin);
  const b=source.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,'missing WorkerWasmSource method boundary');
  return source.slice(a,b);
};
const wipe='self.buffer.fill(0);self.buffer.clear();self.entropy.fill(0);';

test('01A Rust append_chunk bounds rejection wipes already accepted decoded plaintext before clear',()=>{
  const body=method('pub fn append_chunk(&mut self,chunk:&[u8])','pub fn finish(&mut self)');
  assert.match(body,/chunk\.is_empty\(\)/);
  assert.match(body,/MAX_WORKER_DOCUMENT/);
  assert.equal(body.split(wipe).length-1,1,'must wipe before reject even when previous chunks were accepted');
  assert.match(body,/return Err\(err\("WORKER_DOCUMENT_BOUNDS"\)\)/);
});

test('01A Rust explicit close wipes pending decoded chunks before revoking session',()=>{
  const body=method('pub fn close(&mut self)->Result<(),JsValue>','impl Drop for WorkerWasmSource');
  assert.equal(body.split(wipe).length-1,1,'close must wipe decoded bytes instead of clear-only');
  assert.match(body,/if let Some\(mut session\)=self\.session\.take\(\)/);
  assert.match(body,/session\.close\(\)/);
});

test('01A Rust Drop preserves existing zeroization fallback and open retains one session',()=>{
  const drop=method('impl Drop for WorkerWasmSource','fn scoped_edit_envelope');
  assert.match(drop,/self\.buffer\.fill\(0\);\s*self\.buffer\.clear\(\);/);
  const finish=method('pub fn finish(&mut self)','pub fn read_core_version_witness');
  assert.match(finish,/ProductSession::open_decoded_in_worker\(bytes,self\.build\.clone\(\),seed\)/);
  assert.match(finish,/self\.session=Some\(guard\);/);
});
