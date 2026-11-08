// 05 QR-C NEW_ONLY independent native CLI boundary/negative test.
// PUBLIC synthetic decoded JSON only; real encrypted Steam P1G stays Owner-local.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const v1=process.env.WAND_QRC_NATIVE_V1;
const v2=process.env.WAND_QRC_NATIVE_V2;
const available=Boolean(v1&&v2);
const steam='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const sha=x=>createHash('sha256').update(x).digest('hex');
const root=()=>{
  const Player={},World={};
  for(let i=0;i<74;i++)Player['test_only_'+String(i).padStart(3,'0')]={i,unicode:'🌿'};
  for(let i=0;i<52;i++)World['synthetic_'+String(i).padStart(3,'0')]={i};
  return {GameInfo:{Version:626},Player,World,UnknownExtension:{
    nested:['STRIP_ONLY_WHITESPACE_NOT_VALUES',{future:'immutable'}]}};
};
const plain=JSON.stringify(root());
if(plain.split('"Version":626').length!==2)throw Error('SYNTHETIC_VERSION_NOT_UNIQUE');
const decoded=Buffer.from(plain.replace('"Version":626','"Version": 626'),'utf8');
const env=(bytes=decoded,delta={})=>({
  ...process.env,
  WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:steam,
  WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64), // synthetic placeholder, NOT original attest
  WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
  WAND_LOCAL_DECODED_SHA256:sha(bytes),
  ...delta
});
const launch=(which,bytes=decoded,args=[],delta={})=>spawnSync(resolve(which),args,{
  input:bytes,env:env(bytes,delta),encoding:null,maxBuffer:4*1024*1024,timeout:45000
});
const utf8=b=>b.toString('utf8');
const expectDeny=(p,tag,prefix)=>{
  assert.notEqual(p.status,0,tag);
  assert.equal(p.stdout.length,0,tag+' must not publish decoded/private bytes');
  assert.match(utf8(p.stderr),new RegExp('^'+prefix+':'),tag);
  assert.ok(p.stderr.length<300,'only constant small denial code, no values');
};

test('QRC-NATIVE-BINARIES available only in focused independent workflow',
  {skip:available?false:'No native binaries supplied to ordinary Node CI; NOT_RUN'},
  ()=>{
    assert.equal(typeof v1,'string');assert.equal(typeof v2,'string');
    assert.notEqual(resolve(v1),resolve(v2));
  });

test('QRC-V1 full JSON + Rust indexed Player74 / World52 is receipt-only',
  {skip:!available},()=>{
  const r=launch(v1);
  assert.equal(r.status,0,'Rust native V1 accepted');
  assert.equal(r.stderr.length,0,'V1 not log input');
  const text=utf8(r.stdout).trim();
  const out=JSON.parse(text);
  assert.equal(out.contract,'wand.native.private.real-steam-v1@1');
  assert.equal(out.coreOwnedIndexedPlayerFields,74);
  assert.equal(out.coreOwnedIndexedWorldFields,52);
  assert.equal(out.decodedSHAValidatedByRust,true);
  assert.equal(out.fullDocumentRustValidated,true);
  assert.equal(out.physicalGameInstallCryptographicallyProven,false);
  assert.equal(out.allNativeReferencesVerified,false);
  assert.equal(out.rustV2EditedCopyVerified,false);
  for(const k of ['writerAuthorized','productReadAccepted','editedCopyAuthorized',
    'applyAuthorized','cloudUploadPerformed','originalModified'])
    assert.equal(out[k],false,k);
  assert.ok(!text.includes('STRIP_ONLY_WHITESPACE_NOT_VALUES'));
  assert.ok(!text.includes('test_only_'));
  assert.ok(!text.includes(sha(decoded)),'private decoded SHA never printed');
  assert.ok(!text.includes('a'.repeat(64)),'claimed original SHA never printed');
});

test('QRC-V1 external FullVersion+SHA gate invalid / JSON duplicate / arguments deny',
  {skip:!available},()=>{
  for(const [tag,bytes,args,delta] of [
    ['noBuild',decoded,[],{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:''}],
    ['buildWithSuffix',decoded,[],{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:steam+' '}],
    ['switchBid',decoded,[],{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'}],
    ['origShaUpper',decoded,[],{WAND_LOCAL_ORIGINAL_SHA256:'AB'.repeat(32)}],
    ['origShaZero',decoded,[],{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)}],
    ['origSizeOver',decoded,[],{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'}],
    ['origSizeNan',decoded,[],{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'not-a-size'}],
    ['missingDecodedSha',decoded,[],{WAND_LOCAL_DECODED_SHA256:''}],
    ['decodedShaMismatch',decoded,[],{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
    ['decodedEmpty',Buffer.alloc(0),[],{}],
    ['badJson',Buffer.from('{bad'),[],{}],
    ['schema624',Buffer.from('{"GameInfo":{"Version":624},"Player":{},"World":{}}'),[],{}],
    ['duplicateNestedKey',
     Buffer.from('{"GameInfo":{"Version":626},"Player":{"x":1,"x":2},"World":{}}'),[],{}],
    ['missingWorld',Buffer.from('{"GameInfo":{"Version":626},"Player":{}}'),[],{}],
    ['forgedArg',decoded,['--writer-on'],{}]
  ]){
    const r=launch(v1,bytes,args,delta);
    expectDeny(r,tag,'LOCAL_RUST_V1_DENIED');
  }
});

test('QRC-V2 exactly one-byte semantic NOOP + fresh independent Rust V1 reopen',
  {skip:!available},()=>{
  const beforeHash=sha(decoded);
  const r=launch(v2,decoded,['--semantic-noop-proof-only']);
  assert.equal(r.status,0,'native V2 synthetic semantic NOOP accepted, '+utf8(r.stderr));
  assert.match(utf8(r.stderr),/^PRIVATE_V2_RUST_NOOP_CAS_UNDO_REDO_ONE_TIME_PIPE_PASS\s*$/);
  assert.equal(r.stdout.length,decoded.length+1);
  assert.equal(utf8(r.stdout),
    utf8(decoded).replace('"Version": 626','"Version": 626 '));
  assert.deepEqual(JSON.parse(utf8(r.stdout)),JSON.parse(utf8(decoded)));
  assert.notEqual(sha(r.stdout),beforeHash);
  assert.equal(sha(decoded),beforeHash,'original input unchanged');
  const reopened=launch(v1,r.stdout);
  assert.equal(reopened.status,0,'fresh native V1 process re-open');
  const info=JSON.parse(utf8(reopened.stdout));
  assert.equal(info.coreOwnedIndexedPlayerFields,74);
  assert.equal(info.coreOwnedIndexedWorldFields,52);
  assert.equal(info.writerAuthorized,false);
  assert.equal(info.rustV2EditedCopyVerified,false);
});

test('QRC-V2 negative no unsafe stdout, unique old literal and external SHA CAS',
  {skip:!available},()=>{
  const noSpace=Buffer.from(plain,'utf8');
  const duplicate=Buffer.from(
    '{"GameInfo":{"Version": 626},"Player":{},"World":{},"Unknown":{"Version": 626}}');
  const misleading=Buffer.from(
    '{"GameInfo":{"Version":626},"Player":{},"World":{},"Unknown":"\\"Version\\": 626"}');
  for(const [tag,bytes,args,delta] of [
    ['notOptedIn',decoded,[],{}],
    ['unknownArg',decoded,['--writer-on'],{}],
    ['badVersion',decoded,['--semantic-noop-proof-only'],
      {WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'UNKNOWN'}],
    ['badOrigSha',decoded,['--semantic-noop-proof-only'],
      {WAND_LOCAL_ORIGINAL_SHA256:'AB'.repeat(32)}],
    ['badOrigSize',decoded,['--semantic-noop-proof-only'],
      {WAND_LOCAL_ORIGINAL_SIZE_BYTES:'0'}],
    ['badDecodedSha',decoded,['--semantic-noop-proof-only'],
      {WAND_LOCAL_DECODED_SHA256:'0'.repeat(64)}],
    ['noWhitespace',noSpace,['--semantic-noop-proof-only'],{}],
    ['ambiguousVersion',duplicate,['--semantic-noop-proof-only'],{}],
    ['versionInString',misleading,['--semantic-noop-proof-only'],{}],
    ['duplicateJson',Buffer.from(
       '{"GameInfo":{"Version":626},"Player":{"x":1,"x":2},"World":{}}'),
       ['--semantic-noop-proof-only'],{}],
    ['schemaMismatch',Buffer.from(
       '{"GameInfo":{"Version":624},"Player":{},"World":{}}'),
       ['--semantic-noop-proof-only'],{}],
    ['corrupt',Buffer.from('{"bad":'),'--semantic-noop-proof-only'.split(' '),{}]
  ]){
    expectDeny(launch(v2,bytes,args,delta),tag,'PRIVATE_V2_DENIED');
  }
});
