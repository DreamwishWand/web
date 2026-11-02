// Independent Node crypto+zlib oracle for synthetic Rust P1G.
import {spawnSync} from 'node:child_process';
import {createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=root+'/Cargo.toml';
const key=Buffer.alloc(32,0x42); // TEST KEY ONLY, not a game/interoperability secret.
function rust(mode,input){
 const r=spawnSync('cargo',['run','--quiet','--manifest-path',manifest,
  '--example','p1g_synthetic_oracle','--',mode],{
  input,maxBuffer:4*1024*1024,encoding:null
 });
 return {exit:r.status,out:Buffer.from(r.stdout||[]),err:String(r.stderr||'')};
}
function enc(zip){const c=createCipheriv('aes-256-ecb',key,null);return Buffer.concat([c.update(zip),c.final()]);}
function dec(cipher){const c=createDecipheriv('aes-256-ecb',key,null);return Buffer.concat([c.update(cipher),c.final()]);}
function crc32(data) {
 let crc=0xffffffff;
 for(const byte of data){
  crc^=byte;
  for(let k=0;k<8;k++)crc=(crc>>>1)^(crc&1?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
function jsOpen(cipher) {
 const zip=dec(cipher),end=zip.length-22;
 assert.equal(zip.readUInt32LE(0),0x04034b50);
 assert.equal(zip.readUInt32LE(end),0x06054b50);
 const cOff=zip.readUInt32LE(end+16);
 assert.equal(zip.readUInt32LE(cOff),0x02014b50);
 assert.equal(zip.subarray(30,37).toString(),'profile');
 assert.equal(zip.subarray(cOff+46,cOff+53).toString(),'profile');
 assert.equal(zip.readUInt16LE(end+8),1);
 const method=zip.readUInt16LE(8);
 assert.equal(zip.readUInt16LE(cOff+10),method);
 const len=zip.readUInt32LE(18);
 const payload=zip.subarray(37,37+len);
 const plain=method===8?inflateRawSync(payload):payload;
 assert.equal(plain.length,zip.readUInt32LE(22));
 assert.equal(crc32(plain),zip.readUInt32LE(14));
 assert.equal(crc32(plain),zip.readUInt32LE(cOff+16));
 assert.equal(cOff,37+len);
 return {plain,zip,method};
}
const first=rust('fixture');
assert.equal(first.exit,0,first.err);
const before=Buffer.from(first.out),origin=jsOpen(before);
assert.equal(origin.method,8);
assert.equal(JSON.parse(origin.plain.toString()).GameInfo.Version,626);
const actual=rust('edit',before);
assert.equal(actual.exit,0,actual.err);
const after=jsOpen(actual.out);
assert.equal(after.method,origin.method);
const beforeText=origin.plain.toString('utf8'),afterText=after.plain.toString('utf8');
const old='"NextOccurrence":"2126-08-20T00:00:00Z"';
const next='"NextOccurrence":"2022-09-06T00:00:00Z"';
assert.equal(afterText,beforeText.replace(old,next),'unknown bytes and unrelated tokens untouched');
assert(afterText.includes('"decimal":1.00')&&afterText.includes('"opaque":"\\u00e9"'));
assert(afterText.includes('"LastOccurrence":"2126-08-20T00:00:00Z"'));
assert.equal(rust('inspect',actual.out).out.toString('utf8'),afterText);
assert.equal(createHash('sha256').update(before).digest('hex'),
 createHash('sha256').update(first.out).digest('hex'));
// Known fixed-width DOS/header attributes can be preserved without
// inventing unsupported ZIP extras/comments or changing the original.
const augmented=Buffer.from(origin.zip);
const centralOffset=augmented.readUInt32LE(augmented.length-22+16);
augmented.writeUInt16LE(0x4521,10);augmented.writeUInt16LE(0x4521,centralOffset+12);
augmented.writeUInt16LE(0x5124,12);augmented.writeUInt16LE(0x5124,centralOffset+14);
augmented.writeUInt16LE(0x0314,centralOffset+4);
augmented.writeUInt32LE(0x12345678,centralOffset+38);
const fromAugmented=rust('edit',enc(augmented));
assert.equal(fromAugmented.exit,0,fromAugmented.err);
const preserved=jsOpen(fromAugmented.out);
const editedCentral=preserved.zip.readUInt32LE(preserved.zip.length-22+16);
assert.equal(preserved.zip.readUInt16LE(10),0x4521);
assert.equal(preserved.zip.readUInt16LE(editedCentral+12),0x4521);
assert.equal(preserved.zip.readUInt16LE(12),0x5124);
assert.equal(preserved.zip.readUInt16LE(editedCentral+14),0x5124);
assert.equal(preserved.zip.readUInt16LE(editedCentral+4),0x0314);
assert.equal(preserved.zip.readUInt32LE(editedCentral+38),0x12345678);
assert.equal(preserved.plain.toString('utf8'),afterText);
let denied=0;
function rejectsArchive(transform){
 const zip=Buffer.from(origin.zip);transform(zip);
 const result=rust('inspect',enc(zip));
 assert.notEqual(result.exit,0,'unsupported ZIP metadata must fail closed');
 denied++;
}
rejectsArchive(zip=>zip.writeUInt16LE(1,zip.length-22+20)); // comment length without comment
rejectsArchive(zip=>zip.writeUInt16LE(8,6)); // data descriptor flag
rejectsArchive(zip=>zip.writeUInt16LE(1,28)); // local extra
rejectsArchive(zip=>{ // CRC mismatch, even with internally matching local/central headers
 const off=zip.readUInt32LE(zip.length-22+16),crc=(zip.readUInt32LE(14)^1)>>>0;
 zip.writeUInt32LE(crc,14);zip.writeUInt32LE(crc,off+16);
});
const wrong=Buffer.from(before);wrong[0]^=0xff;
assert.notEqual(rust('inspect',wrong).exit,0);
denied++;
console.log(JSON.stringify({scope:'SYNTHETIC_RUST_P1G_INDEPENDENT_NODE_CRYPTO_ZLIB',
 sourceSha:createHash('sha256').update(before).digest('hex'),
 changedPaths:1,unknownUnchanged:true,negativeCases:denied,
 portableProductWriterAuthorized:false}));
