// 05 QR CORE329 exact NEW two-path source and PRIVATE provenance boundary.
// Independent local actual artifact inspection is separate from this public CI.
// This CI must NEVER take a real P1G or log a private key/payload.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const old='4c8cf5568ad767c5712dbe948fc6d9dc4dbbac76';
const head='9c2945a6ac41e584a49394bd1b39865c6d68daeb';
const list=['.github/workflows/01a-offline-v2-research.yml',
 'crates/ddv-save-core/scripts/offline-real-save-v2.mjs'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('QR329 exact two-file newer delta only; previous tri-Codec synthetic QA332 remains untouched',()=>{
 assert.deepEqual(git('diff','--name-only',old,head).split('\n').sort(),list.sort());
 for(const f of ['crates/ddv-save-core/src/p1g.rs',
   'crates/ddv-save-core/examples/p1g_offline_private_probe.rs',
   'crates/ddv-save-core/tests/p1g_noop_offline_research.rs']){
   assert.equal(git('rev-parse',head+':'+f),git('rev-parse',old+':'+f),f);
 }
});
test('QR329 source-only CI bundles whitelisted code/binary but no personal source/edited save',async()=>{
 const wf=await readFile(new URL('../.github/workflows/01a-offline-v2-research.yml',import.meta.url),'utf8');
 assert(wf.includes('PRIVATE_SAVE_IN_CI=NO'));
 assert(wf.includes('REAL_SAVE_RUST_REOPEN=REQUIRES_SEPARATE_PRIVATE_LOCAL_EXECUTION'));
 assert(wf.includes('ref: 393222e7832461ef5fea847b6fff475fedc45017'));
 assert(wf.includes('cargo build --release'));
 const start=wf.indexOf('tar -czf offline-codecs-329-source-only.tar.gz');
 assert(start>=0);
 const end=wf.indexOf('\n          sha256sum offline-codecs-329-source-only.tar.gz',start);
 assert(end>start);
 const tar=wf.slice(start,end);
 assert.equal(tar.match(/\S+\.(?:js|mjs)\b/g)?.length,8);
 assert(tar.includes('crates/ddv-save-core/target/release/examples/p1g_offline_private_probe'));
 assert(tar.includes('package.json'));
 assert(!/\.p1g\b|\.zip\b|\.json\b|prod\.keys|DDV_PRIVATE_P1G_PATH|\.env|user-save/i.test(tar.replace('package.json','')));
 assert(wf.includes('retention-days: 1'));
 assert(!/DDV_PRIVATE_P1G_PATH:|DDV_PRIVATE_CODEC_KEY_HEX:/.test(wf));
});
test('QR329 harness needs explicit immutable source, optional full tri-Codec comparators never silently PASS',async()=>{
 const f=await readFile(new URL('../crates/ddv-save-core/scripts/offline-real-save-v2.mjs',import.meta.url),'utf8');
 assert(f.includes("required('DDV_EXPECTED_P1G_SHA256')"));
 assert(f.includes("required('DDV_EXPECTED_JSON_SHA256')"));
 assert(f.includes("required('DDV_EXTERNAL_SWITCH_BID')"));
 assert(f.includes("required('DDV_PRIVATE_P1G_PATH')"));
 assert(f.includes('DDV_RUST_PROBE_BINARY'));
 assert(f.includes("let timekeeper='NOT_RUN'"));
 assert(f.includes("let rust='NOT_RUN'"));
 assert(f.includes("DDV_REQUIRE_RUST==='1'"));
 assert(f.includes('RUST_OFFLINE_PROBE_FAILED'));
 assert(f.includes("original_unchanged:true"));
 assert(f.includes("product_encode_copy_authorized:false,persistent_replace_authorized:false"));
 assert(!f.includes('writeFileSync('));
 assert(!f.includes('createWriteStream('));
 assert(!f.includes('fetch('));
 assert(!f.includes('https.request('));
});
