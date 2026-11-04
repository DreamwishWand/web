// 01A W-CORE-004: second-process independent Node crypto/zlib/ZIP32 verifier.
// PRIVATE LOCAL FILES ONLY. Does not import Rust Core, Wand JS codec,
// self-reopen helpers or metadata from the producer. NEVER sends a network call.
// Do not run this in CI with genuine private P1G, keys, or decoded Save.
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createHash, createDecipheriv } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const MAX_FILE = 128 * 1024 * 1024;
const MAX_ZIP = 256 * 1024 * 1024;
const HEX64 = /^[0-9a-fA-F]{64}$/;
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const SHA = b => createHash('sha256').update(b).digest('hex');
const assert = (yes, code) => { if (!yes) throw Error(code); };
const required = name => {
  const v = process.env[name];
  assert(typeof v === 'string' && v.length !== 0, 'PRIVATE_ENV_MISSING');
  return v;
};
const hash = name => {
  const value = required(name);
  assert(HEX64.test(value), 'PRIVATE_HASH_INVALID');
  return value.toLowerCase();
};
const expectedKey = () => Buffer.from(hash('DDV_PRIVATE_CODEC_KEY_HEX'), 'hex');
const file = path => {
  const st = lstatSync(path);
  assert(st.isFile() && !st.isSymbolicLink() && st.size > 0 && st.size <= MAX_FILE,
    'PRIVATE_FILE_NOT_REGULAR_OR_BOUNDED');
  const data = readFileSync(path);
  assert(data.length === st.size, 'PRIVATE_FILE_LENGTH_CHANGED');
  return data;
};
// The output of this table is calculated from decoded plaintext, not a
// producer-provided CRC, and detects a bad DEFLATE/header integrity witness.
const crcTable = Uint32Array.from({length:256}, (_, n) => {
  let v = n;
  for (let i=0;i<8;i++) v = v & 1 ? (v >>> 1) ^ 0xedb88320 : v >>> 1;
  return v >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
export function reopenIndependently(encrypted, key) {
  assert(Buffer.isBuffer(encrypted) && encrypted.length > 0 &&
    encrypted.length <= MAX_FILE && encrypted.length % 16 === 0,
  'P1G_CIPHERTEXT_SIZE_DENIED');
  assert(Buffer.isBuffer(key) && key.length === 32, 'P1G_KEY_SHAPE_INVALID');
  let archive;
  try {
    const cipher = createDecipheriv('aes-256-ecb', key, null);
    archive = Buffer.concat([cipher.update(encrypted), cipher.final()]);
  } catch { throw Error('P1G_DECRYPT_OR_PADDING_FAILED'); }
  assert(archive.length >= 105 && archive.length <= MAX_ZIP,
    'ZIP_ARCHIVE_SIZE_DENIED');
  const end = archive.length - 22;
  const r16 = i => { assert(i >= 0 && i + 2 <= archive.length, 'ZIP_BOUNDS'); return archive.readUInt16LE(i); };
  const r32 = i => { assert(i >= 0 && i + 4 <= archive.length, 'ZIP_BOUNDS'); return archive.readUInt32LE(i); };
  assert(r32(0) === 0x04034b50 && r32(end) === 0x06054b50,'ZIP_SIGNATURE_INVALID');
  assert(r16(end+4) === 0 && r16(end+6) === 0 && r16(end+8) === 1 &&
    r16(end+10) === 1 && r16(end+20) === 0,'ZIP_EOCD_DENIED');
  const central = r32(end+16);
  const size = r32(end+12);
  assert(size === 53 && central >= 37 && central + size === end,'ZIP_CENTRAL_LENGTH_DENIED');
  assert(r32(central) === 0x02014b50 && r32(central+42) === 0,'ZIP_CENTRAL_DENIED');
  assert(r16(26) === 7 && r16(28) === 0 && r16(central+28) === 7 &&
    r16(central+30) === 0 && r16(central+32) === 0 &&
    r16(central+34) === 0,'ZIP_UNSUPPORTED_EXTRAS');
  assert(archive.subarray(30,37).toString('ascii') === 'profile' &&
    archive.subarray(central+46,central+53).toString('ascii') === 'profile','ZIP_PROFILE_NAME_INVALID');
  assert(r16(4) === r16(central+6) && r16(6) === r16(central+8) &&
    r16(8) === r16(central+10) && r16(10) === r16(central+12) &&
    r16(12) === r16(central+14) && r32(14) === r32(central+16) &&
    r32(18) === r32(central+20) && r32(22) === r32(central+24),'ZIP_HEADER_PARITY_DENIED');
  const method = r16(8);
  assert(r16(6) === 0 && (method === 0 || method === 8),'ZIP_METHOD_OR_FLAGS_UNSUPPORTED');
  const compressedBytes = r32(18), decodedBytes = r32(22);
  assert(compressedBytes !== 0xffffffff && decodedBytes !== 0xffffffff &&
    decodedBytes > 0 && decodedBytes <= MAX_FILE,'ZIP64_OR_EXPANDED_SIZE_DENIED');
  assert(37 + compressedBytes === central,'ZIP_COMPRESSED_BOUNDS_DENIED');
  const compressed = archive.subarray(37,central);
  let plain;
  try {
    plain = method === 0 ? compressed : inflateRawSync(compressed,{maxOutputLength:MAX_FILE+1});
  } catch { throw Error('ZIP_INFLATE_BOUNDED_FAILED'); }
  assert(plain.length === decodedBytes && (method !== 0 || compressedBytes === decodedBytes),
    'ZIP_PLAINTEXT_LENGTH_INVALID');
  assert(crc32(plain) === r32(14),'ZIP_CRC_MISMATCH');
  return {
    plain,
    metadata: {
      versionNeeded:r16(4),flags:r16(6),method,dosTime:r16(10),dosDate:r16(12),
      madeBy:r16(central+4),disk:r16(central+34),internalAttrs:r16(central+36),
      externalAttrs:r32(central+38),count:r16(end+10)
    }
  };
}
function parseW1(json, expectedOldOrNew) {
  let root;
  try { root = JSON.parse(json.toString('utf8')); }
  catch { throw Error('JSON_FULL_DOCUMENT_INVALID'); }
  assert(root?.GameInfo?.Version === 626 && root.Player !== null &&
    typeof root.Player === 'object' && root.World !== null &&
    typeof root.World === 'object','W1_SCHEMA_OR_ROOT_INVALID');
  const saved = root.World.RecurringEvents?.['155'];
  assert(saved && Object.keys(saved).length === 1 &&
    Object.hasOwn(saved,'ItemSpawning'),'W1_ONEOF_IDENTITY_MISMATCH');
  const item = saved.ItemSpawning;
  assert(String(item?.RecurringEventItemID) === '2010000021','W1_EVENT_ID_MISMATCH');
  assert(item.NextOccurrence === expectedOldOrNew,'W1_OLD_NEW_CAS_MISMATCH');
  return root;
}
function exactOneLexicalReplacement(before, after, oldUtc, newUtc) {
  const oldToken = Buffer.from(JSON.stringify(oldUtc),'utf8');
  const newToken = Buffer.from(JSON.stringify(newUtc),'utf8');
  assert(!oldToken.equals(newToken) && oldToken.length > 2 && newToken.length > 2,
    'W1_NOOP_OR_TOKEN_INVALID');
  assert(before.length + (newToken.length-oldToken.length) === after.length,
    'W1_UNEXPECTED_DIFF_LENGTH');
  let matchingCandidates=0;
  for (let start=before.indexOf(oldToken);start !== -1;
       start=before.indexOf(oldToken,start+1)) {
    if (before.subarray(0,start).equals(after.subarray(0,start)) &&
      before.subarray(start+oldToken.length).equals(after.subarray(start+newToken.length)) &&
      after.subarray(start,start+newToken.length).equals(newToken)){
      matchingCandidates += 1;
    }
    // One unique candidate suffices; deny ambiguity without giant copies.
    assert(matchingCandidates <= 1,'W1_LEXICAL_REPLACEMENT_AMBIGUOUS');
  }
  assert(matchingCandidates === 1,'W1_MORE_THAN_ONE_TOKEN_CHANGED');
}
export function verifyPrivateReopen({source,backup,edited,key,expectedSourceSha,
  expectedDecodedSha,expectedEditedSha,expectedEditedDecodedSha,oldUtc,newUtc}) {
  assert(SHA(source) === expectedSourceSha,'SOURCE_CIPHERTEXT_SHA_FAILED');
  assert(source.equals(backup) && SHA(backup) === expectedSourceSha,
    'ORIGINAL_FIRST_BACKUP_BYTES_MISMATCH');
  assert(SHA(edited) === expectedEditedSha,'EDITED_CIPHERTEXT_SHA_FAILED');
  const before = reopenIndependently(source,key);
  const after = reopenIndependently(edited,key);
  const backupOpen = reopenIndependently(backup,key);
  assert(backupOpen.plain.equals(before.plain),'BACKUP_DECODED_MISMATCH');
  assert(SHA(before.plain) === expectedDecodedSha,'SOURCE_DECODED_SHA_FAILED');
  assert(SHA(after.plain) === expectedEditedDecodedSha,'EDITED_DECODED_SHA_FAILED');
  assert(JSON.stringify(before.metadata) === JSON.stringify(after.metadata),
    'ZIP_METADATA_CHANGED_UNEXPECTEDLY');
  const originalRoot=parseW1(before.plain,oldUtc);
  const editedRoot=parseW1(after.plain,newUtc);
  editedRoot.World.RecurringEvents['155'].ItemSpawning.NextOccurrence=oldUtc;
  assert(isDeepEqualJson(originalRoot,editedRoot),'W1_UNEXPECTED_SEMANTIC_CHANGES');
  exactOneLexicalReplacement(before.plain,after.plain,oldUtc,newUtc);
  return Object.freeze({
    independentProcess:true,sourceCipherShaMatch:true,backupOriginalIdentity:true,
    strictOneEntryZipAndCrc:true,metadataPreserved:true,exactOneLexicalToken:true,
    sourceStillIntact:true,productWriterAuthorized:false,nativeV3Verified:false
  });
}
function isDeepEqualJson(a,b) {
  if (Object.is(a,b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) &&
      a.length===b.length && a.every((v,i)=>isDeepEqualJson(v,b[i]));
  }
  if (a && b && typeof a==='object' && typeof b==='object') {
    const ak=Object.keys(a),bk=Object.keys(b);
    return ak.length===bk.length && ak.every(k=>Object.hasOwn(b,k)&&isDeepEqualJson(a[k],b[k]));
  }
  return false;
}
export function verifyPrivateFiles(args) {
  assert(args.length===3,'PRIVATE_PATH_ARGS_REQUIRED');
  assert(required('DDV_EXTERNAL_PLATFORM')==='switch' &&
    required('DDV_EXTERNAL_FULL_VERSION')==='1.25.3' &&
    required('DDV_EXTERNAL_SWITCH_BID')==='9A239D3DB569756D',
    'PRIVATE_EXTERNAL_SOURCE_IDENTITY_DENIED');
  const canonical=args.map(path=>realpathSync(path));
  assert(new Set(canonical).size===3,'PRIVATE_PATH_ALIAS_DENIED');
  if(process.platform!=='win32') {
    for(const path of args.slice(1)) {
      assert((lstatSync(path).mode & 0o077)===0,'PRIVATE_OUTPUT_MODE_NOT_0600');
    }
  }
  const oldUtc=required('DDV_W1_EXPECTED_OLD_UTC');
  const newUtc=required('DDV_W1_PROPOSED_UTC');
  assert(UTC.test(oldUtc)&&UTC.test(newUtc),'W1_UTC_SHAPE_INVALID');
  const proof=verifyPrivateReopen({
    source:file(args[0]),backup:file(args[1]),edited:file(args[2]),
    key:expectedKey(),expectedSourceSha:hash('DDV_EXPECTED_P1G_SHA256'),
    expectedDecodedSha:hash('DDV_EXPECTED_JSON_SHA256'),
    expectedEditedSha:hash('DDV_EXPECTED_EDITED_P1G_SHA256'),
    expectedEditedDecodedSha:hash('DDV_EXPECTED_EDITED_JSON_SHA256'),
    oldUtc,newUtc
  });
  assert(SHA(file(args[0]))===hash('DDV_EXPECTED_P1G_SHA256'),
    'SOURCE_CHANGED_DURING_INDEPENDENT_REOPEN');
  return proof;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===realpathSync(process.argv[1])) {
  try {
    const result=verifyPrivateFiles(process.argv.slice(2));
    assert(result.independentProcess && result.strictOneEntryZipAndCrc &&
      result.exactOneLexicalToken && !result.productWriterAuthorized,
      'INDEPENDENT_REOPEN_FLAGS_DENIED');
    process.stdout.write('PRIVATE_W1_FRESH_PROCESS_NODE_REOPEN=PASS\nPRODUCT_WRITER=OFF\nNATIVE_V3=NOT_ACCEPTED\n');
  } catch(e) {
    // Fail closed without printing a path, value, Save, key or raw decoded data.
    const code=e instanceof Error&&/^[A-Z0-9_]{3,80}$/.test(e.message)
      ? e.message:'PRIVATE_REOPEN_DENIED';
    process.stderr.write(code+'\n');
    process.exitCode=1;
  }
}
