import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateBambooProofManifest,inspectBambooProofSubjects} from '../scripts/readonly-release/steam-bamboo-perop-signed.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const source='9'.repeat(40);
const js=Buffer.from('export function read_steam626_bamboo_single_target() {}');
const wasm=Buffer.from([0,97,115,109,1,0,0,0]);
const bytes=[Buffer.from('{}'),js,wasm];
const valid={
 contract:'wand.steam626.bamboo40700007.signed-proof-only@1',
 kind:'THREE_PROOF_SUBJECTS_NO_PUBLIC_DEPLOY',
 source:{repository:'DreamwishWand/web',commit:source,
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  cargoTomlGitBlob:'e4f2e2c5d4451baba2dea699fe497cb7b40668d4',
  cargoLockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',
  rustcVersion:'1.99.1',wasmBindgenCliVersion:'0.2.105',
  features:['product-steam626-bamboo-readonly','worker-wasm'],defaultFeatures:false},
 assets:{js:{path:'ddv_save_core.js',sizeBytes:js.length,sha256:sha(js)},
  wasm:{path:'ddv_save_core_bg.wasm',sizeBytes:wasm.length,sha256:sha(wasm)}},
 release:{proofOnly:true,publicAssets:false,productConsumerEnabled:false,
  writerAuthorized:false,stageAuthorized:false,editedCopyAuthorized:false,
  operationOn:false,autoUpload:false},
 abi:{exportClass:'WorkerWasmSource',method:'read_steam626_bamboo_single_target',
  itemId:40700007,readOnly:true,writerAuthorized:false,stageAuthorized:false,editedCopyAuthorized:false}
};
const clone=()=>structuredClone(valid);
test('exact immutable manifest accepted only as candidate; cannot self-attest',()=>{
 assert.equal(validateBambooProofManifest(valid,bytes,source),true);
 assert.throws(()=>inspectBambooProofSubjects(bytes,source),/BAMBOO_PEROP_PROOF_DENIED/);
});
test('23 authority/source/Build/schema/export grants deny',()=>{
 const mutate=[
  m=>m.contract='fake',m=>m.kind='PUBLIC_RELEASE',
  m=>m.source.repository='foreign/repo',m=>m.source.commit='8'.repeat(40),
  m=>m.source.buildId='Switch626',m=>m.source.cargoTomlGitBlob='0'.repeat(40),
  m=>m.source.cargoLockSha256='0'.repeat(64),m=>m.source.rustcVersion='1.100.0',
  m=>m.source.wasmBindgenCliVersion='0.2.104',m=>m.source.features=['indexed-read','worker-wasm'],
  m=>m.source.features.push('semantic-writer-dev'),m=>m.source.defaultFeatures=true,
  m=>m.release.publicAssets=true,m=>m.release.productConsumerEnabled=true,
  m=>m.release.writerAuthorized=true,m=>m.release.stageAuthorized=true,
  m=>m.release.editedCopyAuthorized=true,m=>m.release.operationOn=true,
  m=>m.release.autoUpload=true,m=>m.release.proofOnly=false,
  m=>m.abi.itemId=40700006,m=>m.abi.method='stage_steam626_bamboo',
  m=>m.abi.writerAuthorized=true
 ];
 for(const change of mutate){const m=clone();change(m);assert.equal(validateBambooProofManifest(m,bytes,source),false)}
});
test('unknown extra field, path substitution, length/hash drift, wrong head fail closed',()=>{
 const bad=clone();bad.unreviewed=true;
 assert.equal(validateBambooProofManifest(bad,bytes,source),false);
 const path=clone();path.assets.js.path='outside.js';
 assert.equal(validateBambooProofManifest(path,bytes,source),false);
 const length=clone();length.assets.wasm.sizeBytes++;
 assert.equal(validateBambooProofManifest(length,bytes,source),false);
 const hash=clone();hash.assets.js.sha256='0'.repeat(64);
 assert.equal(validateBambooProofManifest(hash,bytes,source),false);
 assert.equal(validateBambooProofManifest(valid,bytes,'a'.repeat(39)),false);
 const drift=bytes.slice();drift[1]=Buffer.from('modified');
 assert.equal(validateBambooProofManifest(valid,drift,source),false);
});

test('read-only proof rejects foreign Chest Stage and Export with exact recomputed bytes',()=>{
 const method='read_steam626_bamboo_single_target';
 const sec=(id,d)=>Buffer.from([id,d.length,...d]);
 const exp=Buffer.from(method);
 const wasm=Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),
  sec(1,[1,0x60,0,0]),sec(3,[1,0]),
  sec(7,[1,exp.length,...exp,0,0]),sec(10,[1,2,0,0x0b])]);
 const baseline=Buffer.from('export function '+method+'(){return 0;}\n');
 const packageBytes=(j,w=wasm)=>{
  const m=clone();
  m.assets.js={path:'ddv_save_core.js',sizeBytes:j.length,sha256:sha(j)};
  m.assets.wasm={path:'ddv_save_core_bg.wasm',sizeBytes:w.length,sha256:sha(w)};
  return [Buffer.from(JSON.stringify(m)),j,w];
 };
 const positive=packageBytes(baseline);
 assert.equal(validateBambooProofManifest(JSON.parse(positive[0]),positive,source),true);
 assert.equal(inspectBambooProofSubjects(positive,source).operationOn,false);
 for(const name of ['dev_stage','stage_steam626_bamboo','export_steam626_bamboo',
  'stage_steam626_chest','export_steam626_chest','undo_steam626_chest',
  'write_steam626_inventory','preview_steam626_chest']){
  const j=Buffer.concat([baseline,Buffer.from('export function '+name+'(){}\n')]);
  assert.throws(()=>inspectBambooProofSubjects(packageBytes(j),source),
   /BAMBOO_PEROP_PROOF_DENIED/,name);
 }
 const foreign=Buffer.from('stage_steam626_chest');
 const wasmWithForeign=Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),
  sec(1,[1,0x60,0,0]),sec(3,[2,0,0]),
  sec(7,[2,exp.length,...exp,0,0,foreign.length,...foreign,0,1]),
  sec(10,[2,2,0,0x0b,2,0,0x0b])]);
 assert.throws(()=>inspectBambooProofSubjects(packageBytes(baseline,wasmWithForeign),source),
  /BAMBOO_PEROP_PROOF_DENIED/);
});
