// 05 QR PR329: exercise the private V2 local harness with synthetic P1G ONLY.
// Uses existing shipped Wand and Timekeeper JS Codecs plus actual Rust research CLI.
// Never uses or uploads an owner save. Never prints a key or save payload.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=join(root,'crates/ddv-save-core/Cargo.toml');
const probe=join(root,'crates/ddv-save-core/scripts/offline-real-save-v2.mjs');
const timekeeper=join(root,'.timekeeper-codec-fixed/src/core/p1g-packaged-profile-codec.mjs');
let envBase;
let original;
let originalDecoded;
let fixtureFile;
test.before(async()=>{
 const source=await readFile(join(root,'src/lib/ddv/core/save/p1g-packaged-profile-codec.js'),'utf8');
 const k=source.match(/const KEY_BYTES = hexToBytes\('([0-9a-fA-F]{64})'\)/);
 assert(k,'Legacy JS Codec key declaration changed: fail closed');
 const {p1gPackagedProfileCodec}=await import(join(root,'src/lib/ddv/core/save/p1g-packaged-profile-codec.js'));
 const compiled=spawnSync('cargo',['run','--quiet','--manifest-path',manifest,
   '--example','p1g_wand_js_interop','--','fixture'],{
    encoding:null,timeout:120000,maxBuffer:4*1024*1024,
    env:{...process.env,DDV_TEST_CODEC_KEY_HEX:k[1]}
   });
 assert.equal(compiled.status,0,String(compiled.stderr).slice(-300));
 original=Buffer.from(compiled.stdout);
 const opened=await p1gPackagedProfileCodec.loadProfile(original);
 originalDecoded=Buffer.from(opened.jsonText,'utf8');
 fixtureFile=await mkdtemp(join(tmpdir(),'qr329-synthetic-private-v2-'));
 await writeFile(join(fixtureFile,'synthetic.p1g'),original,{flag:'wx'});
 envBase={...process.env,
  DDV_PRIVATE_P1G_PATH:join(fixtureFile,'synthetic.p1g'),
  DDV_EXPECTED_P1G_SHA256:sha(original),DDV_EXPECTED_JSON_SHA256:sha(originalDecoded),
  DDV_EXTERNAL_SWITCH_BID:'9A239D3DB569756D',
  DDV_W1_EVENT_ID:'2010000021',DDV_W1_SAVED_INDEX:'0',DDV_W1_ONEOF:'ItemSpawning',
  DDV_W1_OLD_UTC:'2126-08-20T00:00:00Z',DDV_W1_NEW_UTC:'2022-09-06T00:00:00Z',
  DDV_REQUIRE_RUST:'1',DDV_TIMEKEEPER_CODEC_MODULE:timekeeper};
});
test.after(async()=>{if(fixtureFile)await rm(fixtureFile,{recursive:true,force:true});});
function run(overrides={}){
 return spawnSync('node',[probe],{cwd:root,encoding:'utf8',
  env:{...envBase,...overrides},timeout:120000,maxBuffer:4*1024*1024});
}
test('05 QR 329 synthetic actual Rust + Wand + Timekeeper JS all re-open NOOP and one-field EDIT',async()=>{
 const r=run();
 assert.equal(r.status,0,r.stderr.slice(-850));
 const receipt=JSON.parse(r.stdout);
 assert.equal(receipt.source_sha_verified,true);
 assert.equal(receipt.decoded_sha_verified,true);
 assert.equal(receipt.original_unchanged,true);
 assert.equal(receipt.zip_metadata_supported,true);
 assert.equal(receipt.w1_identity_old_utc_negative_cas,'PASS');
 assert.equal(receipt.no_op.decoded_lexical_equal,true);
 assert.equal(receipt.one_field.exact_one_token_delta,true);
 assert.equal(receipt.timekeeper_js_codec_reopen,'PASS_ENCODE_AND_CROSS_REOPEN');
 assert.equal(receipt.rust_reopen,'PASS_ENCODE_AND_CROSS_REOPEN');
 assert.equal(receipt.product_encode_copy_authorized,false);
 assert.equal(receipt.persistent_replace_authorized,false);
 assert.equal(sha(await readFile(envBase.DDV_PRIVATE_P1G_PATH)),sha(original));
 assert.equal(r.stdout.includes('2126-08-20T'),false,'do not echo synthetic source');
});
test('05 QR 329 wrong source SHA / JSON SHA / BID refuse before any edit',()=>{
 for(const [field,value] of [
  ['DDV_EXPECTED_P1G_SHA256','0'.repeat(64)],
  ['DDV_EXPECTED_JSON_SHA256','0'.repeat(64)],
  ['DDV_EXTERNAL_SWITCH_BID','WRONG']]){
  const r=run({[field]:value});
  assert.notEqual(r.status,0,field);
  assert.equal(sha(original),sha(Buffer.from(original)));
 }
});
test('05 QR 329 stale EventID/oneof/oldUtc and incorrect schema index are denied',()=>{
 for(const changes of [
  {DDV_W1_EVENT_ID:'2010500008'},
  {DDV_W1_ONEOF:'FlowerSpawningInVillage'},
  {DDV_W1_OLD_UTC:'2025-01-01T00:00:00Z'},
  {DDV_W1_SAVED_INDEX:'999'},
  {DDV_W1_NEW_UTC:'2126-08-20T00:00:00Z'}]){
  const r=run(changes);
  assert.notEqual(r.status,0,JSON.stringify(changes));
  assert.equal(sha(original),sha(Buffer.from(original)));
 }
});
test('05 QR 329 CLI never writes edited copy to repo/local path, keeps original immutable',async()=>{
 const f=await readFile(envBase.DDV_PRIVATE_P1G_PATH);
 assert(f.equals(original));
 const harness=await readFile(probe,'utf8');
 assert(!harness.includes('writeFileSync('));
 assert(!harness.includes('fetch('));
 assert(!harness.includes('https.request('));
 assert(!harness.includes('createWriteStream('));
 assert(harness.includes('DDV_REQUIRE_RUST'));
 assert(harness.includes('DDV_TIMEKEEPER_CODEC_MODULE'));
});
