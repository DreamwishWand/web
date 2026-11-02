// 05 QR: direct existing Wand and Timekeeper packaged JS Codec against Rust.
// Different from 01A author's JS test script; no real save, no emitted key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const crate=join(root,'crates/ddv-save-core/Cargo.toml');
const sources=[
 ['Wand',join(root,'src/lib/ddv/core/save/p1g-packaged-profile-codec.js')],
 ['Timekeeper',join(root,'.timekeeper-codec-fixed/src/core/p1g-packaged-profile-codec.mjs')]
];
const old='"NextOccurrence":"2126-08-20T00:00:00Z"';
const next='"NextOccurrence":"2022-09-06T00:00:00Z"';
function execute(mode,input,key){
 const r=spawnSync('cargo',['run','--quiet','--manifest-path',crate,'--example','p1g_wand_js_interop','--',mode],
  {input,encoding:null,maxBuffer:6*1024*1024,timeout:45000,env:{...process.env,DDV_TEST_CODEC_KEY_HEX:key}});
 return {code:r.status,stdout:Buffer.from(r.stdout||[]),stderr:Buffer.from(r.stderr||[]).toString()};
}
for(const [name,path] of sources){
 test('05QR actual '+name+' JS codec bidirectional SYNTHETIC P1G with Rust',async()=>{
  const js=await readFile(path,'utf8');
  const key=js.match(/const KEY_BYTES = hexToBytes\('([0-9a-fA-F]{64})'\)/);
  assert(key,'source key declaration shifted; fail closed, do not guess');
  const {p1gPackagedProfileCodec:codec}=await import(pathToFileURL(path).href);
  const first=execute('fixture',undefined,key[1]);
  assert.equal(first.code,0,first.stderr);
  const decoded=await codec.loadProfile(new Uint8Array(first.stdout));
  assert.equal(decoded.metadata.profileVersion,626);
  const edited=decoded.jsonText.replace(old,next);
  assert.notEqual(edited,decoded.jsonText);
  assert(edited.includes('"opaque":"\\u00e9"'));
  assert(edited.includes('"decimal":1.00'));
  // Actual independent JS Codec writes, Rust separately parses.
  const encodedByJs=await codec.createEncodedProfile(edited,decoded.metadata);
  const rustOpensJs=execute('inspect',Buffer.from(encodedByJs),key[1]);
  assert.equal(rustOpensJs.code,0,rustOpensJs.stderr);
  assert.equal(rustOpensJs.stdout.toString(),edited);
  // Rust writes, actual independent JS Codec reopens, not Rust's self audit.
  const encodedByRust=execute('edit',first.stdout,key[1]);
  assert.equal(encodedByRust.code,0,encodedByRust.stderr);
  const jsOpensRust=await codec.loadProfile(new Uint8Array(encodedByRust.stdout));
  assert.equal(jsOpensRust.jsonText,edited);
  for(const field of ['compressType','flagBits','dosTime','dosDate','externalAttr','internalAttr'])
   assert.equal(jsOpensRust.metadata.zip.profileEntry[field],decoded.metadata.zip.profileEntry[field]);
  assert(!('realSaveAccepted' in jsOpensRust.metadata));
  // Expected unrelated token remains lexically unmodified.
  assert(jsOpensRust.jsonText.includes('"LastOccurrence":"2126-08-20T00:00:00Z"'));
  // Unsupported ZIP annotations are outside accepted Rust writer scope.
  const metadata={...decoded.metadata,zip:{...decoded.metadata.zip,
    profileEntry:{...decoded.metadata.zip.profileEntry,extra:new Uint8Array([5,0])}}};
  try{
   const unsupported=await codec.createEncodedProfile(decoded.jsonText,metadata);
   const result=execute('inspect',Buffer.from(unsupported),key[1]);
   assert.notEqual(result.code,0,'Rust accepted unknown ZIP extra for '+name);
  }catch(e){
   assert(name==='Timekeeper'&&String(e).includes('ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED'),
    'unexpected error reason '+String(e));
  }
 });
}
