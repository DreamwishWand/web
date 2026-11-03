// 05 QR: new PR329 0afee519 private V2 source-only delta, NEVER private data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const prev='9c2945a6ac41e584a49394bd1b39865c6d68daeb';
const cur='0afee519eacef719e2d0a44b6258c137ae62a425';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('fixed new HEAD changes only workflow, local Node harness and handoff (no Rust writer)',()=>{
 const list=git('diff','--name-only',prev,cur).split('\n').sort();
 assert.deepEqual(list,[
 '.github/workflows/01a-offline-v2-research.yml',
 'crates/ddv-save-core/docs/01A_REAL_SAVE_V2_INDEPENDENT_QR_HANDOFF_20261103.md',
 'crates/ddv-save-core/scripts/offline-real-save-v2.mjs'
 ].sort());
 for(const path of ['crates/ddv-save-core/src/p1g.rs',
  'crates/ddv-save-core/examples/p1g_offline_private_probe.rs',
  'crates/ddv-save-core/tests/p1g_noop_offline_research.rs']){
  assert.equal(git('rev-parse',prev+':'+path),git('rev-parse',cur+':'+path));
 }
});
test('actual CI never requests private P1G, source-only artifact and versioned older QA fixture',async()=>{
 const w=await readFile(new URL('../.github/workflows/01a-offline-v2-research.yml',import.meta.url),'utf8');
 assert(w.includes('PRIVATE_SAVE_IN_CI=NO'));
 assert(w.includes('PRODUCT_WRITER=OFF'));
 assert(w.includes('ref: 393222e7832461ef5fea847b6fff475fedc45017'));
 assert(w.includes('ref: 6467065e98ace6e5972bfd7096208b632dd076f0'));
 assert(w.includes('node --test qa/05qr-core329-private-v2-harness-synthetic.test.mjs'));
 assert(w.includes('retention-days: 1'));
 assert(w.includes('SOURCE_ONLY_ARTIFACT=YES'));
 assert(!w.includes('DDV_PRIVATE_P1G_PATH:'));
 assert(!w.includes('DDV_PRIVATE_CODEC_KEY_HEX:'));
 assert(!w.includes('actions/download-artifact'));
});
test('real-save harness outputs only hashes and honest optional comparator status, not copied source',async()=>{
 const s=await readFile(new URL('../crates/ddv-save-core/scripts/offline-real-save-v2.mjs',import.meta.url),'utf8');
 assert(s.includes("let rust='NOT_RUN'"));
 assert(s.includes("let timekeeper='NOT_RUN'"));
 assert(s.includes("required('DDV_PRIVATE_P1G_PATH')"));
 assert(s.includes("required('DDV_EXPECTED_P1G_SHA256')"));
 assert(s.includes("required('DDV_EXPECTED_JSON_SHA256')"));
 assert(s.includes("DDV_REQUIRE_RUST==='1'"));
 assert(s.includes("DDV_RUST_PROBE_BINARY"));
 assert(s.includes("zip_header_local_central_parity:'PASS'"));
 assert(s.includes("product_encode_copy_authorized:false,persistent_replace_authorized:false"));
 assert(!/\b(writeFile|createWriteStream|fetch|https\.request)\s*\(/.test(s));
 const res=spawnSync('node',['crates/ddv-save-core/scripts/offline-real-save-v2.mjs'],
  {encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME},timeout:5000});
 assert.notEqual(res.status,0);
 assert.equal(res.stdout.trim(),'');
 assert.match(res.stderr,/REQUIRED_ENV_MISSING/);
});
test('handoff says developer private tri-codec report not QR independent real save PASS',async()=>{
 const doc=await readFile(new URL('../crates/ddv-save-core/docs/01A_REAL_SAVE_V2_INDEPENDENT_QR_HANDOFF_20261103.md',import.meta.url),'utf8');
 for(const s of ['Developer local proof','independent QR','schema626','EventID',
  'savedIndex','oneof','original','ZIP32','V3','PRODUCT']){
  assert(doc.toLowerCase().includes(s.toLowerCase()),s);
 }
 assert(doc.includes('QR_PRIVATE_REAL_SAVE_NOT_YET_RUN'));
 assert(doc.includes('sourceRevisionCas'));
 assert(doc.includes('operationReferenceClosure'));
});
