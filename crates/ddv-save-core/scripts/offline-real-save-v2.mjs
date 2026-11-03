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
const expectedJsonHash=required('DDV_EXPECTED_JSON_SHA256').toLowerCase();
assert.match(expectedJsonHash,/^[a-f0-9]{64}$/,'EXPECTED_DECODED_SHA_SHAPE_INVALID');
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
 // Independent exact supported ZIP32 profile verifier. Never infer
 // local/central header parity from successfully decompressing the entry.
 const dec=createDecipheriv('aes-256-ecb',key,null);
 const zip=Buffer.concat([dec.update(ciphertext),dec.final()]);
 assert(zip.length>=105,'ZIP_TOO_SHORT');
 const end=zip.length-22;
 const r16=i=>zip.readUInt16LE(i),r32=i=>zip.readUInt32LE(i);
 assert.equal(r32(0),0x04034b50,'ZIP_LOCAL_SIGNATURE');
 assert.equal(r32(end),0x06054b50,'ZIP_EOCD_SIGNATURE');
 assert.equal(r16(end+4),0,'ZIP_EOCD_DISK');
 assert.equal(r16(end+6),0,'ZIP_EOCD_CENTRAL_DISK');
 assert.equal(r16(end+8),1,'ZIP_EOCD_ENTRIES_DISK');
 assert.equal(r16(end+10),1,'ZIP_EOCD_ENTRIES_TOTAL');
 assert.equal(r16(end+20),0,'ZIP_ARCHIVE_COMMENT_DENIED');
 const central=r32(end+16),centralSize=r32(end+12);
 assert.equal(centralSize,46+7,'ZIP_CENTRAL_SIZE_DENIED');
 assert.equal(central+centralSize,end,'ZIP_CENTRAL_BOUNDS');
 assert.equal(r32(central),0x02014b50,'ZIP_CENTRAL_SIGNATURE');
 assert.equal(r32(central+42),0,'ZIP_LOCAL_OFFSET');
 assert.equal(r16(central+34),0,'ZIP_CENTRAL_DISK_START');
 assert.equal(r16(26),7,'ZIP_LOCAL_NAME_LENGTH');
 assert.equal(r16(28),0,'ZIP_LOCAL_EXTRA_DENIED');
 assert.equal(r16(central+28),7,'ZIP_CENTRAL_NAME_LENGTH');
 assert.equal(r16(central+30),0,'ZIP_CENTRAL_EXTRA_DENIED');
 assert.equal(r16(central+32),0,'ZIP_FILE_COMMENT_DENIED');
 assert.equal(zip.subarray(30,37).toString('ascii'),'profile','ZIP_LOCAL_NAME');
 assert.equal(zip.subarray(central+46,central+53).toString('ascii'),'profile','ZIP_CENTRAL_NAME');
 assert.equal(r16(4),r16(central+6),'ZIP_EXTRACT_VERSION_PARITY');
 assert.equal(r16(6),r16(central+8),'ZIP_FLAGS_PARITY');
 assert.equal(r16(8),r16(central+10),'ZIP_METHOD_PARITY');
 assert.equal(r16(10),r16(central+12),'ZIP_TIME_PARITY');
 assert.equal(r16(12),r16(central+14),'ZIP_DATE_PARITY');
 assert.equal(r32(14),r32(central+16),'ZIP_CRC_PARITY');
 assert.equal(r32(18),r32(central+20),'ZIP_COMPRESSED_SIZE_PARITY');
 assert.equal(r32(22),r32(central+24),'ZIP_EXPANDED_SIZE_PARITY');
 assert.equal(r16(6),0,'ZIP_FLAGS_UNSUPPORTED');
 assert.equal(r16(8),8,'ZIP_METHOD_UNSUPPORTED');
 assert.notEqual(r32(18),0xffffffff,'ZIP64_COMPRESSED_UNSUPPORTED');
 assert.notEqual(r32(22),0xffffffff,'ZIP64_EXPANDED_UNSUPPORTED');
 const bytes=zip.subarray(37,central);
 assert.equal(bytes.length,r32(18),'ZIP_COMPRESSED_BOUNDS');
 const plain=inflateRawSync(bytes);
 assert.equal(plain.length,r32(22),'ZIP_EXPANDED_SIZE_MISMATCH');
 let crc=0xffffffff;
 for(const v of plain){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 crc=(crc^0xffffffff)>>>0;
 assert.equal(crc,r32(14),'ZIP_CRC_MISMATCH');
 return {plain,meta:{
   filename:'profile',method:r16(8),flags:r16(6),
   extractVersion:r16(4),madeByVersion:r16(central+4),
   dosTime:r16(10),dosDate:r16(12),
   localExtraLen:r16(28),centralExtraLen:r16(central+30),
   fileCommentLen:r16(central+32),archiveCommentLen:r16(end+20),
   diskStart:r16(central+34),internalAttr:r16(central+36),
   externalAttr:r32(central+38),localHeaderOffset:r32(central+42),
   entryCount:r16(end+10)
 },crc};
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
assert.equal(hex(prior.plain),expectedJsonHash,'DECODED_SOURCE_SHA_MISMATCH');
const opened=await wand.loadProfile(new Uint8Array(original));
assert.equal(Buffer.from(opened.jsonText,'utf8').equals(prior.plain),true);
const idx=Number(required('DDV_W1_SAVED_INDEX'));
const id=Number(required('DDV_W1_EVENT_ID'));
assert(Number.isSafeInteger(idx)&&idx>=0&&Number.isSafeInteger(id)&&id>0);
const oneof=required('DDV_W1_ONEOF');
assert(['ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage','FishSpawningInVillage'].includes(oneof));
const old=required('DDV_W1_OLD_UTC'),next=required('DDV_W1_NEW_UTC');
const after=editText(opened.jsonText,idx,id,oneof,old,next);
// Record only stable denial codes, never failed inputs or source data.
// This is a local JS CAS negative matrix, NOT Core Session/Revision CAS.
const localCasNegatives=[
 {name:'wrongEventId',expectedCode:'W1_EVENT_ID_CAS_FAILED',
  attempt:()=>editText(opened.jsonText,idx,id+1,oneof,old,next)},
 {name:'wrongOneof',expectedCode:'W1_ONEOF_CAS_FAILED',
  attempt:()=>editText(opened.jsonText,idx,id,'__wrong_oneof__',old,next)},
 {name:'staleOldUtc',expectedCode:'W1_TIMESTAMP_CAS_FAILED',
  attempt:()=>editText(opened.jsonText,idx,id,oneof,old+'__stale__',next)}
].map(({name,expectedCode,attempt})=>{
 assert.throws(attempt,new RegExp(expectedCode));
 return {name,result:'DENIED',reasonCode:expectedCode,editedOutputBytes:0};
});
const expectedEdited=Buffer.from(after,'utf8');
assert.notEqual(hex(expectedEdited),expectedJsonHash,'EDITED_JSON_SHA_UNCHANGED');
const noop=Buffer.from(await wand.createEncodedProfile(opened.jsonText,opened.metadata));
const changed=Buffer.from(await wand.createEncodedProfile(after,opened.metadata));
const no=independentOpen(noop),ed=independentOpen(changed);
assert(no.plain.equals(prior.plain));
assert(ed.plain.equals(expectedEdited));
assert(isDeepStrictEqual(no.meta,prior.meta));
assert(isDeepStrictEqual(ed.meta,prior.meta));
assert.equal(hex(readFileSync(inputPath)),expectedHash,'ORIGINAL_MUTATED');
// Check direct JS reopen again separately from independent crypto+zlib.
assert.equal((await wand.loadProfile(new Uint8Array(noop))).jsonText,opened.jsonText);
assert.equal((await wand.loadProfile(new Uint8Array(changed))).jsonText,after);
let timekeeper='NOT_RUN';
let tkHashes=[null,null];
let tk=null;
if(process.env.DDV_TIMEKEEPER_CODEC_MODULE){
 const module=await import(pathToFileURL(process.env.DDV_TIMEKEEPER_CODEC_MODULE).href);
 tk=module.p1gPackagedProfileCodec;
 assert(tk&&typeof tk.loadProfile==='function'&&typeof tk.createEncodedProfile==='function','TIMEKEEPER_CODEC_INVALID');
 const tkOriginal=await tk.loadProfile(new Uint8Array(original));
 assert.equal(tkOriginal.jsonText,opened.jsonText,'TIMEKEEPER_ORIGINAL_SOURCE_DIFFERENT');
 const tkNoop=Buffer.from(await tk.createEncodedProfile(tkOriginal.jsonText,tkOriginal.metadata));
 const tkEdit=Buffer.from(await tk.createEncodedProfile(after,tkOriginal.metadata));
 tkHashes=[hex(tkNoop),hex(tkEdit)];
 for(const [cipher,expectedPlain] of [[tkNoop,prior.plain],[tkEdit,expectedEdited]]){
  const independent=independentOpen(cipher);
  assert(independent.plain.equals(expectedPlain),'TIMEKEEPER_ENCODE_INDEPENDENT_REOPEN_MISMATCH');
  assert(isDeepStrictEqual(independent.meta,prior.meta),'TIMEKEEPER_ZIP_METADATA_MISMATCH');
  assert.equal((await wand.loadProfile(new Uint8Array(cipher))).jsonText,expectedPlain.toString('utf8'),'WAND_REOPEN_TIMEKEEPER_MISMATCH');
  assert.equal((await tk.loadProfile(new Uint8Array(cipher))).jsonText,expectedPlain.toString('utf8'),'TIMEKEEPER_SELF_REOPEN_MISMATCH');
 }
 assert.equal((await tk.loadProfile(new Uint8Array(noop))).jsonText,opened.jsonText);
 assert.equal((await tk.loadProfile(new Uint8Array(changed))).jsonText,after);
 timekeeper='PASS_ENCODE_AND_CROSS_REOPEN';
}
let rust='NOT_RUN';
let rustHashes=[null,null];
if(process.env.DDV_REQUIRE_RUST==='1'){
 const rustEnv={...process.env,DDV_PRIVATE_CODEC_KEY_HEX:keyMatch[1]};
 // A fixed-head release-built research binary is also accepted for a
 // private offline executor without cargo. It must come from the pinned
 // source-only CI artifact; NEVER ship an actual save into CI to run it.
 const privateBinary=process.env.DDV_RUST_PROBE_BINARY;
 const run=(mode)=>privateBinary
  ? spawnSync(privateBinary,[mode],{input:original,encoding:null,env:rustEnv,maxBuffer:maxBytes})
  : spawnSync('cargo',['run','--quiet','--manifest-path',
      fileURLToPath(new URL('../Cargo.toml',import.meta.url)),
      '--example','p1g_offline_private_probe','--',mode],{
      input:original,encoding:null,env:rustEnv,maxBuffer:maxBytes
    });
 const results=['noop','edit'].map(run);
 rustHashes=results.map(r=>r.status===0&&r.stdout?hex(r.stdout):null);
 for(const result of results){
  assert.equal(result.status,0,'RUST_OFFLINE_PROBE_FAILED');
  assert(result.stdout&&result.stdout.length>0);
 }
 assert.equal(independentOpen(results[0].stdout).plain.equals(prior.plain),true);
 assert.equal(independentOpen(results[1].stdout).plain.equals(expectedEdited),true);
 for(const [result,expectedPlain] of [[results[0],prior.plain],[results[1],expectedEdited]]){
  const independent=independentOpen(result.stdout);
  assert(isDeepStrictEqual(independent.meta,prior.meta),'RUST_ZIP_METADATA_MISMATCH');
  assert.equal((await wand.loadProfile(new Uint8Array(result.stdout))).jsonText,expectedPlain.toString('utf8'),'WAND_REOPEN_RUST_MISMATCH');
  if(tk)assert.equal((await tk.loadProfile(new Uint8Array(result.stdout))).jsonText,expectedPlain.toString('utf8'),'TIMEKEEPER_REOPEN_RUST_MISMATCH');
 }
 rust='PASS_ENCODE_AND_CROSS_REOPEN';
}
console.log(JSON.stringify({
 contract:'dreamwish.ddv.v2-local-redacted-receipt@1',
 evidence:'LOCAL_RESEARCH_EXECUTION_ONLY_NOT_INDEPENDENT_QR_ACCEPTANCE',
 source_sha_verified:true,decoded_sha_verified:true,original_unchanged:true,zip_metadata_supported:true,
 w1:{
  eventId:id,savedIndex:idx,oneof,
  changedPointer:'/World/RecurringEvents/'+String(idx)+'/'+oneof+'/NextOccurrence',
  oldUtcSha256:hex(Buffer.from(old,'utf8')),
  newUtcSha256:hex(Buffer.from(next,'utf8')),
  rawOldCas:'PASS',decodedOldUtcCas:'PASS'
 },
 negativeCases:localCasNegatives,
 registry_sha_verified:'NOT_RUN',full_w1_reference_closure:'NOT_VERIFIED',
 w1_identity_old_utc_negative_cas:'PASS',session_revision_cas:'NOT_RUN',
 no_op:{wand_js_codec_reopen:'PASS',independent_node_crypto_zlib_reopen:'PASS',
  decoded_lexical_equal:true,metadata_equal:true},
 one_field:{wand_js_codec_reopen:'PASS',independent_node_crypto_zlib_reopen:'PASS',
  exact_one_token_delta:true,metadata_equal:true},
 timekeeper_js_codec_reopen:timekeeper,rust_reopen:rust,
 source_ciphertext_sha256:expectedHash,source_json_sha256:expectedJsonHash,
 edited_json_sha256:hex(expectedEdited),
 outputs:{
  wand_noop_sha256:hex(noop),wand_w1_sha256:hex(changed),
  timekeeper_noop_sha256:tkHashes[0],timekeeper_w1_sha256:tkHashes[1],
  rust_noop_sha256:rustHashes[0],rust_w1_sha256:rustHashes[1]
 },
 zip_header_local_central_parity:'PASS',crc_independent_reopen:'PASS',
 product_encode_copy_authorized:false,persistent_replace_authorized:false
}));
