// Synthetic-only offline Rust V2 SEMANTIC-NOOP native CAS/Undo/Redo test.
// User private P1G is NEVER read by this GitHub Actions test.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {syntheticProfile} from './helpers/p1g-fixture.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const old=process.env.WAND_TEST_NATIVE_RUST_V1,newBin=process.env.WAND_TEST_NATIVE_RUST_V2;
if(!old||!newBin)throw Error('NATIVE_BOTH_RUST_BINARIES_REQUIRED');
const v1=resolve(old),v2=resolve(newBin);
const fixture=syntheticProfile('DeviceType_Windows');
fixture.GameInfo.Version=626;
fixture.Player={};
for(let i=0;i<33;i++)fixture.Player['only_synthetic_'+String(i).padStart(3,'0')]=i;
fixture.World={Root:{nest:'synthetic'},Clock:0};
fixture.UnknownExtension={preserve:[null,{future:true}]};
const json=JSON.stringify(fixture);
if(json.split('"Version":626').length!==2)throw Error('FIXTURE_VERSION_NOT_UNIQUE');
const source=Buffer.from(json.replace('"Version":626','"Version": 626'),'utf8');
const envOf=(bytes,extra={})=>({...process.env,
 WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
 WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
 WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
 WAND_LOCAL_DECODED_SHA256:sha(bytes),...extra});
const run=(bin,decoded,args=[],extra={})=>spawnSync(bin,args,{
 input:decoded,env:envOf(decoded,extra),encoding:null,
 maxBuffer:1024*1024,timeout:40000});
const modified=run(v2,source,['--semantic-noop-proof-only']);
assert.equal(modified.status,0,'Native Rust V2 CAS/Undo/Redo: '+
  modified.stderr.toString('utf8').slice(0,180));
assert.match(modified.stderr.toString('utf8'),
 /PRIVATE_V2_RUST_NOOP_CAS_UNDO_REDO_ONE_TIME_PIPE_PASS/);
assert.equal(modified.stdout.length,source.length+1);
assert.notEqual(sha(modified.stdout),sha(source));
assert.deepEqual(JSON.parse(modified.stdout.toString('utf8')),JSON.parse(source.toString('utf8')));
assert.equal(modified.stdout.toString('utf8'),
 source.toString('utf8').replace('"Version": 626','"Version": 626 '));
const reopened=run(v1,modified.stdout);
assert.equal(reopened.status,0,'Independent new Rust process V1 Reopen');
const receipt=JSON.parse(reopened.stdout.toString('utf8'));
assert.equal(receipt.fullDocumentRustValidated,true);
assert.equal(receipt.coreOwnedIndexedPlayerFields,33);
assert.equal(receipt.coreOwnedIndexedWorldFields,2);
assert.equal(receipt.writerAuthorized,false);
for(const [name,bytes,args,extra] of [
 ['missing opt-in',source,[],{}],
 ['wrong old literal',Buffer.from(json,'utf8'),['--semantic-noop-proof-only'],{}],
 ['wrong decoded source sha',source,['--semantic-noop-proof-only'],
   {WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)}],
 ['wrong Steam Build',source,['--semantic-noop-proof-only'],
   {WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'UNKNOWN'}],
 ['schema624',Buffer.from(JSON.stringify({...fixture,GameInfo:{Version:624}})),
   ['--semantic-noop-proof-only'],{}]
]){
 const denied=run(v2,bytes,args,extra);
 assert.notEqual(denied.status,0,name);
 assert.equal(denied.stdout.length,0,name);
 assert.match(denied.stderr.toString('utf8'),/PRIVATE_V2_DENIED:/,name);
}
console.log('RUST_NATIVE_PRIVATE_V2_SEMANTIC_NOOP_CAS_UNDO_REDO_FRESH_PROCESS_SYNTHETIC_PASS');
