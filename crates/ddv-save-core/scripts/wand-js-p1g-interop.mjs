// Actual existing Wand JS P1G Codec <-> new Rust P1G synthetic fixture.
// The interop key is read at runtime from the already-shipped Wand JS Codec;
// NEVER hardcode, log, send or commit its value elsewhere.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {p1gPackagedProfileCodec as defaultWand} from '../../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const crate=fileURLToPath(new URL('../',import.meta.url));
const isTimekeeper=process.argv.includes('--timekeeper');
const modulePath=new URL(isTimekeeper ?
 '../../../.timekeeper-codec-fixed/src/core/p1g-packaged-profile-codec.mjs' :
 '../../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js',import.meta.url);
const wand=isTimekeeper?(await import(modulePath.href)).p1gPackagedProfileCodec:defaultWand;
const existingSource=fileURLToPath(modulePath);
const source=readFileSync(existingSource,'utf8');
const match=source.match(/const KEY_BYTES = hexToBytes\('([0-9a-fA-F]{64})'\)/);
assert(match,'existing JS Codec key location changed; NEVER guess secret');
const env={...process.env,DDV_TEST_CODEC_KEY_HEX:match[1]};
function rust(mode,bytes){
 const run=spawnSync('cargo',['run','--quiet','--manifest-path',crate+'/Cargo.toml',
  '--example','p1g_wand_js_interop','--',mode],
  {env,input:bytes,maxBuffer:2*1024*1024,encoding:null});
 return {status:run.status,output:Buffer.from(run.stdout||[]),error:String(run.stderr||'')};
}
const generated=rust('fixture');
assert.equal(generated.status,0,generated.error);
const opened=await wand.loadProfile(new Uint8Array(generated.output));
if(isTimekeeper){
 const auditModule=new URL('../../../.timekeeper-codec-fixed/src/core/p1g-envelope-audit.mjs',import.meta.url);
 const {auditP1gEnvelope}=await import(auditModule.href);
 const checked=auditP1gEnvelope({format:'packaged',metadata:opened.metadata});
 assert.equal(checked.repackageShapeObserved,true,
  JSON.stringify({findings:checked.findings,localObserved:checked.localHeaderObserved,
   localParity:checked.localHeaderFieldsMatchCentral,lengths:checked.lengths}));
}
const src=opened.jsonText;
assert.equal(JSON.parse(src).GameInfo.Version,626);
const old='"NextOccurrence":"2126-08-20T00:00:00Z"';
const replacement='"NextOccurrence":"2022-09-06T00:00:00Z"';
const expected=src.replace(old,replacement);
assert.notEqual(expected,src);
assert(expected.includes('"opaque":"\\u00e9"')&&expected.includes('"decimal":1.00'));
// Direction 1: Rust fixture -> existing Wand JS read and edit -> Rust read.
const jsRebuilt=await wand.createEncodedProfile(expected,opened.metadata);
const rustReadJs=rust('inspect',Buffer.from(jsRebuilt));
assert.equal(rustReadJs.status,0,rustReadJs.error);
assert.equal(rustReadJs.output.toString('utf8'),expected);
// Direction 2: Rust edited copy -> existing Wand JS reopen.
const rustCopy=rust('edit',generated.output);
assert.equal(rustCopy.status,0,rustCopy.error);
const jsReadRust=await wand.loadProfile(new Uint8Array(rustCopy.output));
assert.equal(jsReadRust.jsonText,expected);
assert.equal(jsReadRust.metadata.profileVersion,626);
for(const name of ['compressType','flagBits','dosTime','dosDate','externalAttr','internalAttr']){
 assert.equal(jsReadRust.metadata.zip.profileEntry[name],opened.metadata.zip.profileEntry[name],name);
}
let denied=0;
for(const extraField of ['extra','comment']){
 const atypical={...opened.metadata,zip:{...opened.metadata.zip,
  profileEntry:{...opened.metadata.zip.profileEntry,[extraField]:new Uint8Array([7,9,11])}}};
 const zipWithUnknown=await wand.createEncodedProfile(src,atypical);
 assert.notEqual(rust('inspect',Buffer.from(zipWithUnknown)).status,0,'unsupported ZIP '+extraField);
 denied++;
}
assert.notEqual(rust('inspect',Buffer.from(generated.output).subarray(1)).status,0);
denied++;
console.log(JSON.stringify({contract:isTimekeeper ? 'ACTUAL_TIMEKEEPER_JS_CODEC_RUST_P1G_SYNTHETIC_INTEROP' : 'ACTUAL_WAND_JS_CODEC_RUST_P1G_SYNTHETIC_INTEROP',
 rustCreatesJsReads:true,jsCreatesRustReads:true,exactDecodedLexicalParity:true,
 unknownZipMetadataDenied:denied,productWriterAuthority:false}));
