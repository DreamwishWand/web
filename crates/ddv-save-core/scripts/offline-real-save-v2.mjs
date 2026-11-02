// Offline-only schema626 verifier. Private P1G bytes are supplied as a local File path.
// No network calls, no uploads, no persistent output and no product Writer grant.
import {readFileSync} from 'node:fs';
import {createHash, createDecipheriv} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {p1gPackagedProfileCodec as wand} from '../../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';

const maxBytes=256*1024*1024;
const hex=(x)=>createHash('sha256').update(x).digest('hex');
function required(name){const v=process.env[name];if(!v)throw Error('REQUIRED_ENV_MISSING:'+name);return v;}
function fromHex(s){if(!/^[a-f0-9]{64}$/i.test(s))throw Error('INVALID_KEY_OR_SHA_SHAPE');return Buffer.from(s,'hex');}
const expectedHash=required('DDV_EXPECTED_P1G_SHA256').toLowerCase();
const inputPath=required('DDV_PRIVATE_P1G_PATH');
const original=readFileSync(inputPath);
assert(original.length>0&&original.length<=maxBytes);
assert.equal(hex(original),expectedHash,'P1G_SOURCE_SHA_MISMATCH');
assert.equal(required('DDV_EXTERNAL_SWITCH_BID'),'9A239D3DB569756D','EXTERNAL_BID_MISMATCH');
const codecSource=readFileSync(fileURLToPath(new URL('../../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js',import.meta.url)),'utf8');
const keyMatch=codecSource.match(/const KEY_BYTES = hexToBytes\('([0-9a-fA-F]{64})'\)/);
assert(keyMatch,'ESTABLISHED_CODEC_KEY_UNAVAILABLE');
const key=fromHex(keyMatch[1]);
// Independently re-open the supported one-entry ZIP32 envelope.
// Never silently normalize extras, comments, descriptor or ZIP64.
function independentOpen(ciphertext){
 const dec=createDecipheriv('aes-256-ecb',key,null);
 const zip=Buffer.concat([dec.update(ciphertext),dec.final()]);
 const end=zip.length-22;
 assert.equal(zip.readUInt32LE(0),0x04034b50);
 assert.equal(zip.readUInt32LE(end),0x06054b50);
 assert.equal(zip.readUInt16LE(end+8),1);
 assert.equal(zip.readUInt16LE(end+10),1);
 assert.equal(zip.readUInt16LE(end+20),0);
 const central=zip.readUInt32LE(end+16),size=zip.readUInt32LE(end+12);
 assert.equal(central+size,end);
 assert.equal(zip.readUInt32LE(central),0x02014b50);
 assert.equal(zip.readUInt16LE(6),0);
 assert.equal(zip.readUInt16LE(central+8),0);
 assert.equal(zip.readUInt16LE(8),8);
 assert.equal(zip.readUInt16LE(central+10),8);
 assert.equal(zip.readUInt16LE(26),7);
 assert.equal(zip.readUInt16LE(28),0);
 assert.equal(zip.readUInt16LE(central+28),7);
 assert.equal(zip.readUInt16LE(central+30),0);
 assert.equal(zip.readUInt16LE(central+32),0);
 assert.equal(zip.subarray(30,37).toString(),'profile');
 assert.equal(zip.subarray(central+46,central+53).toString(),'profile');
 const bytes=zip.subarray(37,central);
 assert.equal(bytes.length,zip.readUInt32LE(18));
 assert.equal(zip.readUInt32LE(central+20),bytes.length);
 const plain=inflateRawSync(bytes);
 assert.equal(plain.length,zip.readUInt32LE(22));
 assert.equal(plain.length,zip.readUInt32LE(central+24));
 let crc=0xffffffff;
 for(const v of plain){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 crc=(crc^0xffffffff)>>>0;
 assert.equal(crc,zip.readUInt32LE(14));
 assert.equal(crc,zip.readUInt32LE(central+16));
 return {plain,meta:{method:8,flags:0,localExtra:0,centralExtra:0,comment:0,version:zip.readUInt16LE(4),time:zip.readUInt16LE(10),date:zip.readUInt16LE(12),made:zip.readUInt16LE(central+4),internal:zip.readUInt16LE(central+36),external:zip.readUInt32LE(central+38)}};
}
function editText(raw,idx,id,oneof,oldUtc,newUtc){
 const sourceObj=JSON.parse(raw);
 assert.equal(sourceObj.GameInfo.Version,626);
 const row=sourceObj.World.RecurringEvents[String(idx)];
 assert(row&&Object.keys(row).length===1&&Object.keys(row)[0]===oneof,'W1_ONEOF_CAS_FAILED');
 const event=row[oneof];
 assert.equal(String(event.RecurringEventItemID),String(id),'W1_EVENT_ID_CAS_FAILED');
 assert.equal(event.NextOccurrence,oldUtc,'W1_TIMESTAMP_CAS_FAILED');
 assert(oldUtc!==newUtc,'W1_NOOP_DENIED');
 const prefix='"RecurringEventItemID"\\s*:\\s*'+String(id)+'\\s*,\\s*"NextOccurrence"\\s*:\\s*';
 const regex=new RegExp(prefix+'("(?:\\\\.|[^"\\\\])*")','g');
 const matches=[...raw.matchAll(regex)];
 assert.equal(matches.length,1,'W1_LEXICAL_IDENTITY_NOT_UNIQUE');
 const rawValue=matches[0][1];
 assert.equal(JSON.parse(rawValue),oldUtc,'W1_RAW_VALUE_CAS_FAILED');
 const at=matches[0].index+matches[0][0].lastIndexOf(rawValue);
 const updated=raw.slice(0,at)+JSON.stringify(newUtc)+raw.slice(at+rawValue.length);
 const edited=JSON.parse(updated);
 assert.equal(edited.World.RecurringEvents[String(idx)][oneof].NextOccurrence,newUtc);
 edited.World.RecurringEvents[String(idx)][oneof].NextOccurrence=oldUtc;
 assert(isDeepStrictEqual(edited,sourceObj),'UNEXPECTED_JSON_DIFFERENCE');
 return updated;
}
const prior=independentOpen(original);
const opened=await wand.loadProfile(new Uint8Array(original));
assert.equal(Buffer.from(opened.jsonText,'utf8').equals(prior.plain),true);
const idx=Number(required('DDV_W1_SAVED_INDEX'));
const id=Number(required('DDV_W1_EVENT_ID'));
assert(Number.isSafeInteger(idx)&&idx>=0&&Number.isSafeInteger(id)&&id>0);
const oneof=required('DDV_W1_ONEOF');
assert(['ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage','FishSpawningInVillage'].includes(oneof));
const old=required('DDV_W1_OLD_UTC'),next=required('DDV_W1_NEW_UTC');
const after=editText(opened.jsonText,idx,id,oneof,old,next);
const noop=Buffer.from(await wand.createEncodedProfile(opened.jsonText,opened.metadata));
const changed=Buffer.from(await wand.createEncodedProfile(after,opened.metadata));
const no=independentOpen(noop),ed=independentOpen(changed);
assert(no.plain.equals(prior.plain));
assert(ed.plain.equals(Buffer.from(after,'utf8')));
assert(isDeepStrictEqual(no.meta,prior.meta));
assert(isDeepStrictEqual(ed.meta,prior.meta));
assert.equal(hex(readFileSync(inputPath)),expectedHash,'ORIGINAL_MUTATED');
// Check direct JS reopen again separately from independent crypto+zlib.
assert.equal((await wand.loadProfile(new Uint8Array(noop))).jsonText,opened.jsonText);
assert.equal((await wand.loadProfile(new Uint8Array(changed))).jsonText,after);
let timekeeper='NOT_RUN';
if(process.env.DDV_TIMEKEEPER_CODEC_MODULE){
 const module=await import(pathToFileURL(process.env.DDV_TIMEKEEPER_CODEC_MODULE).href);
 const tk=module.p1gPackagedProfileCodec;
 assert.equal((await tk.loadProfile(new Uint8Array(noop))).jsonText,opened.jsonText);
 assert.equal((await tk.loadProfile(new Uint8Array(changed))).jsonText,after);
 timekeeper='PASS';
}
let rust='NOT_RUN';
if(process.env.DDV_REQUIRE_RUST==='1'){
 const rustEnv={...process.env,DDV_PRIVATE_CODEC_KEY_HEX:keyMatch[1]};
 const run=(mode)=>spawnSync('cargo',['run','--quiet','--manifest-path',
  fileURLToPath(new URL('../Cargo.toml',import.meta.url)),
  '--example','p1g_offline_private_probe','--',mode],{
  input:original,encoding:null,env:rustEnv,maxBuffer:maxBytes,
 });
 const results=['noop','edit'].map(run);
 for(const result of results){
  assert.equal(result.status,0,'RUST_OFFLINE_PROBE_FAILED');
  assert(result.stdout&&result.stdout.length>0);
 }
 assert.equal(independentOpen(results[0].stdout).plain.equals(prior.plain),true);
 assert.equal(independentOpen(results[1].stdout).plain.equals(Buffer.from(after,'utf8')),true);
 rust='PASS';
}
console.log(JSON.stringify({
 source_sha_verified:true,original_unchanged:true,zip_metadata_supported:true,
 no_op:{wand_js_codec_reopen:'PASS',independent_node_crypto_zlib_reopen:'PASS',
  decoded_lexical_equal:true,metadata_equal:true},
 one_field:{wand_js_codec_reopen:'PASS',independent_node_crypto_zlib_reopen:'PASS',
  exact_one_token_delta:true,metadata_equal:true},
 timekeeper_js_codec_reopen:timekeeper,rust_reopen:rust,
 product_encode_copy_authorized:false,persistent_replace_authorized:false
}));
