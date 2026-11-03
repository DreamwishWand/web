// 05 QR: new-only c3b2 private-receipt/old-CAS source delta on synthetic P1G.
// No real save/key/decoded user JSON enters Actions; no product writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { p1gPackagedProfileCodec as wand } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const jsFile=join(root,'crates/ddv-save-core/scripts/offline-real-save-v2.mjs');
const crate=join(root,'crates/ddv-save-core/Cargo.toml');
const source=readFileSync(join(root,'src/lib/ddv/core/save/p1g-packaged-profile-codec.js'),'utf8');
const match=source.match(/const KEY_BYTES = hexToBytes\('([0-9a-fA-F]{64})'\)/);
assert(match,'pinned actual JS Codec key declaration shifted: FAIL CLOSED');
const sha=v=>createHash('sha256').update(v).digest('hex');
function run(command,args,options={}){
 return spawnSync(command,args,{encoding:null,maxBuffer:6*1024*1024,timeout:150000,...options});
}
test('QR c3b2 receipt and W1 CAS new-only synthetic negatives',async()=>{
 const work=mkdtempSync(join(tmpdir(),'qr-c3b2-synthetic-'));
 try {
  const fixture=run('cargo',['run','--quiet','--manifest-path',crate,'--example','p1g_wand_js_interop','--','fixture'],
    {env:{...process.env,DDV_TEST_CODEC_KEY_HEX:match[1]}});
  assert.equal(fixture.status,0,String(fixture.stderr||''));
  const original=Buffer.from(fixture.stdout);
  const decoded=await wand.loadProfile(new Uint8Array(original));
  assert.equal(decoded.metadata.profileVersion,626);
  const originalSha=sha(original),jsonSha=sha(Buffer.from(decoded.jsonText,'utf8'));
  const file=join(work,'synthetic.p1g');
  writeFileSync(file,original,{mode:0o600,flag:'wx'});
  const base={
   ...process.env,
   DDV_PRIVATE_P1G_PATH:file,
   DDV_EXPECTED_P1G_SHA256:originalSha,
   DDV_EXPECTED_JSON_SHA256:jsonSha,
   DDV_EXTERNAL_SWITCH_BID:'9A239D3DB569756D',
   DDV_W1_SAVED_INDEX:'0',
   DDV_W1_EVENT_ID:'2010000021',
   DDV_W1_ONEOF:'ItemSpawning',
   DDV_W1_OLD_UTC:'2126-08-20T00:00:00Z',
   DDV_W1_NEW_UTC:'2022-09-06T00:00:00Z'
  };
  delete base.DDV_TIMEKEEPER_CODEC_MODULE;
  delete base.DDV_REQUIRE_RUST;
  delete base.DDV_RUST_PROBE_BINARY;
  const positive=run(process.execPath,[jsFile],{env:base});
  assert.equal(positive.status,0,String(positive.stderr||''));
  const text=String(positive.stdout),proof=JSON.parse(text);
  assert.equal(proof.contract,'dreamwish.ddv.v2-local-redacted-receipt@1');
  assert.equal(proof.evidence,'LOCAL_RESEARCH_EXECUTION_ONLY_NOT_INDEPENDENT_QR_ACCEPTANCE');
  assert.equal(proof.source_ciphertext_sha256,originalSha);
  assert.equal(proof.source_json_sha256,jsonSha);
  assert.equal(proof.w1.changedPointer,'/World/RecurringEvents/0/ItemSpawning/NextOccurrence');
  assert.equal(proof.w1.eventId,2010000021);
  assert.equal(proof.w1.savedIndex,0);
  assert.equal(proof.w1.oneof,'ItemSpawning');
  assert.equal(proof.w1.rawOldCas,'PASS');
  assert.equal(proof.w1.decodedOldUtcCas,'PASS');
  assert.equal(proof.original_unchanged,true);
  assert.equal(proof.zip_header_local_central_parity,'PASS');
  assert.equal(proof.crc_independent_reopen,'PASS');
  assert.equal(proof.outputs.wand_noop_sha256?.length,64);
  assert.equal(proof.outputs.wand_w1_sha256?.length,64);
  for(const name of ['timekeeper_noop_sha256','timekeeper_w1_sha256','rust_noop_sha256','rust_w1_sha256'])
   assert.equal(proof.outputs[name],null,'unrun comparator claimed present');
  assert.equal(proof.timekeeper_js_codec_reopen,'NOT_RUN');
  assert.equal(proof.rust_reopen,'NOT_RUN');
  assert.equal(proof.registry_sha_verified,'NOT_RUN');
  assert.equal(proof.full_w1_reference_closure,'NOT_VERIFIED');
  assert.equal(proof.session_revision_cas,'NOT_RUN');
  assert.equal(proof.product_encode_copy_authorized,false);
  assert.equal(proof.persistent_replace_authorized,false);
  assert.deepEqual(proof.negativeCases.map(x=>[x.name,x.result,x.reasonCode,x.editedOutputBytes]),[
   ['wrongEventId','DENIED','W1_EVENT_ID_CAS_FAILED',0],
   ['wrongOneof','DENIED','W1_ONEOF_CAS_FAILED',0],
   ['staleOldUtc','DENIED','W1_TIMESTAMP_CAS_FAILED',0]
  ]);
  assert(!text.includes('Unknown') && !text.includes('opaque') && !text.includes('PRIVATE_CODEC_KEY'));
  const cases=[
   ['sourceSha',{DDV_EXPECTED_P1G_SHA256:'0'.repeat(64)}],
   ['decodedSha',{DDV_EXPECTED_JSON_SHA256:'f'.repeat(64)}],
   ['externalBid',{DDV_EXTERNAL_SWITCH_BID:'0000000000000000'}],
   ['eventId',{DDV_W1_EVENT_ID:'2010000022'}],
   ['oneof',{DDV_W1_ONEOF:'FlowerSpawningInVillage'}],
   ['savedIndex',{DDV_W1_SAVED_INDEX:'1'}],
   ['oldUtc',{DDV_W1_OLD_UTC:'2000-01-01T00:00:00Z'}],
   ['newEqualsOld',{DDV_W1_NEW_UTC:'2126-08-20T00:00:00Z'}]
  ];
  for(const [label,changes] of cases){
   const result=run(process.execPath,[jsFile],{env:{...base,...changes}});
   assert.notEqual(result.status,0,label+' must deny');
   assert.equal(result.stdout.length,0,label+' must emit no edited copy or receipt');
  }
  assert.equal(sha(readFileSync(file)),originalSha,'original changed during rejected cases');
 } finally {rmSync(work,{recursive:true,force:true});}
});
