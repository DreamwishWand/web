// 05 QR independent Node crypto/zlib/CRC archive oracle for NEW Rust P1G.
// Test key is synthetic 0x42, never a game key. No private P1G or media.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=root+'Cargo.toml';
const key=Buffer.alloc(32,0x42);
const raw=Buffer.from('{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2126-08-20T00:00:00Z"}}}},"Unknown":{"alpha":"\\u00e9","decimal":1.00,"deep":{"child":{"str":"KEEP"}}}}');
const hash=x=>createHash('sha256').update(x).digest('hex');
function crc32(data){
 let crc=0xffffffff;
 for(const byte of data){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function archive(plain,{method=8,flags=0,extraLocal=Buffer.alloc(0),extraCentral=Buffer.alloc(0),
                   comment=Buffer.alloc(0),name='profile'}={}){
 const nameBytes=Buffer.from(name);
 const packed=method===8?deflateRawSync(plain):plain;
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);
 local.writeUInt16LE(method,8);local.writeUInt16LE(0x4521,10);local.writeUInt16LE(0x5124,12);
 local.writeUInt32LE(crc32(plain),14);local.writeUInt32LE(packed.length,18);
 local.writeUInt32LE(plain.length,22);local.writeUInt16LE(nameBytes.length,26);
 local.writeUInt16LE(extraLocal.length,28);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(0x0314,4);
 central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);
 central.writeUInt16LE(0x4521,12);central.writeUInt16LE(0x5124,14);
 central.writeUInt32LE(crc32(plain),16);central.writeUInt32LE(packed.length,20);
 central.writeUInt32LE(plain.length,24);central.writeUInt16LE(nameBytes.length,28);
 central.writeUInt16LE(extraCentral.length,30);central.writeUInt16LE(0,32);
 central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);
 central.writeUInt32LE(0x12345678,38);central.writeUInt32LE(0,42);
 const data=Buffer.concat([local,nameBytes,extraLocal,packed]);
 const directory=Buffer.concat([central,nameBytes,extraCentral]);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(data.length,16);
 end.writeUInt16LE(comment.length,20);
 return Buffer.concat([data,directory,end,comment]);
}
function encrypted(zip){
 const cipher=createCipheriv('aes-256-ecb',key,null);
 return Buffer.concat([cipher.update(zip),cipher.final()]);
}
function decrypted(input){
 const cipher=createDecipheriv('aes-256-ecb',key,null);
 return Buffer.concat([cipher.update(input),cipher.final()]);
}
function rust(mode,input){
 const r=spawnSync('cargo',['run','--quiet','--manifest-path',manifest,
  '--example','p1g_synthetic_oracle','--',mode],
  {encoding:null,input,maxBuffer:4*1024*1024,timeout:45000});
 return {status:r.status,stdout:Buffer.from(r.stdout||[]),stderr:Buffer.from(r.stderr||[]).toString()};
}
function independentReopen(input) {
 const zip=decrypted(input);
 const end=zip.length-22;
 assert.equal(zip.readUInt32LE(0),0x04034b50);
 assert.equal(zip.readUInt32LE(end),0x06054b50);
 const cen=zip.readUInt32LE(end+16),n=zip.readUInt16LE(26),size=zip.readUInt32LE(18);
 assert.equal(zip.readUInt32LE(cen),0x02014b50);
 assert.equal(zip.subarray(30,30+n).toString('utf8'),'profile');
 assert.equal(zip.subarray(cen+46,cen+53).toString('utf8'),'profile');
 assert.equal(cen,30+n+size);
 const method=zip.readUInt16LE(8),data=zip.subarray(30+n,cen);
 const decoded=method===8?inflateRawSync(data):data;
 assert.equal(decoded.length,zip.readUInt32LE(22));
 assert.equal(crc32(decoded),zip.readUInt32LE(14));
 assert.equal(crc32(decoded),zip.readUInt32LE(cen+16));
 return {plain:decoded,zip,method,cen};
}
test('05 QR independent Node-generated method-8 and stored method-0 P1G are Rust-parseable/editable',()=>{
 for(const method of [8,0]) {
  const input=encrypted(archive(raw,{method}));
  const inspect=rust('inspect',input);assert.equal(inspect.status,0,inspect.stderr);
  assert.equal(hash(inspect.stdout),hash(raw));
  const edit=rust('edit',input);assert.equal(edit.status,0,edit.stderr);
  const reopened=independentReopen(edit.stdout); // Node, NEVER Rust reopen.
  assert.equal(reopened.method,method);
  const expected=Buffer.from(raw.toString('utf8').replace(
   '"NextOccurrence":"2126-08-20T00:00:00Z"',
   '"NextOccurrence":"2022-09-06T00:00:00Z"'));
  assert.deepEqual(reopened.plain,expected);
  assert.equal(hash(input),hash(encrypted(archive(raw,{method}))));
  assert(reopened.plain.includes(Buffer.from('"decimal":1.00')));
  assert(reopened.plain.includes(Buffer.from('"str":"KEEP"')));
  assert.equal(reopened.zip.readUInt16LE(10),0x4521);
  assert.equal(reopened.zip.readUInt16LE(reopened.cen+4),0x0314);
  assert.equal(reopened.zip.readUInt32LE(reopened.cen+38),0x12345678);
 }
});
test('05 QR independent malformed ZIP metadata and CRC are FAIL CLOSED',()=>{
 const cases=[
  ['unknown central extra',{extraCentral:Buffer.from([0,0])}],
  ['unknown local extra',{extraLocal:Buffer.from([0,0])}],
  ['EOCD comment',{comment:Buffer.from('x')}],
  ['non-profile entry',{name:'private'}],
  ['ZIP data descriptor flag',{flags:8}]
 ];
 for(const [label,opts] of cases){
  const result=rust('inspect',encrypted(archive(raw,opts)));
  assert.notEqual(result.status,0,label+' incorrectly accepted');
 }
 const zip=archive(raw);
 const mutators=[
  ['CRC inconsistent both headers',x=>{
   const cen=x.readUInt32LE(x.length-22+16);
   const crc=(x.readUInt32LE(14)^1)>>>0;
   x.writeUInt32LE(crc,14);x.writeUInt32LE(crc,cen+16);
  }],
  ['CRC local-central disagreement',x=>x.writeUInt32LE(0,14)],
  ['ZIP64 fake sentinel',x=>x.writeUInt32LE(0xffffffff,18)],
  ['method unknown',x=>{
   const cen=x.readUInt32LE(x.length-22+16);
   x.writeUInt16LE(99,8);x.writeUInt16LE(99,cen+10);
  }],
  ['central/local method mismatch',x=>x.writeUInt16LE(0,8)],
  ['central directory offset out of bounds',x=>x.writeUInt32LE(0xffffffff,x.length-22+16)]
 ];
 for(const [label,mutate] of mutators){
  const altered=Buffer.from(zip);mutate(altered);
  assert.notEqual(rust('inspect',encrypted(altered)).status,0,label);
 }
 const bad=encrypted(zip);bad[0]^=0x20;
 assert.notEqual(rust('inspect',bad).status,0,'tampered AES must reject');
 const short=bad.subarray(0,bad.length-1);
 assert.notEqual(rust('inspect',short).status,0,'partial AES block must reject');
});
test('05 QR independent Rust fixture opened by independent Node oracle, source hash changes only after edit',()=>{
 const first=rust('fixture');assert.equal(first.status,0,first.stderr);
 const original=independentReopen(first.stdout);
 assert.equal(JSON.parse(original.plain.toString('utf8')).GameInfo.Version,626);
 assert(original.plain.includes(Buffer.from('"decimal":1.00')));
 const edited=rust('edit',first.stdout);assert.equal(edited.status,0,edited.stderr);
 const after=independentReopen(edited.stdout);
 assert.notEqual(hash(edited.stdout),hash(first.stdout));
 assert.equal(after.plain.length,original.plain.length);
 assert.equal(after.plain.toString(),original.plain.toString().replace(
  '"NextOccurrence":"2126-08-20T00:00:00Z"',
  '"NextOccurrence":"2022-09-06T00:00:00Z"'));
});
