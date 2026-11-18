import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
import {validateTrustedExact8Manifest,inspectTrustedR22Source,MANIFEST} from '../scripts/int-r22-external-protected-selection.mjs';
const pinned=validateTrustedExact8Manifest(JSON.parse(readFileSync(MANIFEST,'utf8')));
const run=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',
 env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'Wand isolated test',GIT_AUTHOR_EMAIL:'none@example.invalid',
 GIT_COMMITTER_NAME:'Wand isolated test',GIT_COMMITTER_EMAIL:'none@example.invalid'}}).trim();
const add=(cwd,p,contents)=>{const path=join(cwd,p);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,contents);};
test('static immutable reviewed Rust/Cargo/R22 input scope is bounded, OFF and exact8',()=>{
 assert.equal(pinned.entries.length,8);
 assert.equal(pinned.newOperationOn,false);assert.equal(pinned.writerAuthorized,false);
 assert.equal(pinned.productSourceHead,'b2735bc63884049a5f3d16423e5970553f168766');
 assert.equal(pinned.entries.find(e=>e.path==='crates/ddv-save-core/Cargo.toml').after.blob,
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 assert.equal(pinned.entries.find(e=>e.path==='scripts/wasm-distribution/protected-release-inputs.json').after.blob,
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
});
test('protected external selection accepts synthetic exact scope and rejects ninth self-authorizing Gate and verifier',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wand-r22-external-'));
 try{
  run(dir,'init','-q');run(dir,'config','user.email','test@example.invalid');
  run(dir,'config','user.name','Wand isolated test');run(dir,'config','core.filemode','true');
  const paths=pinned.entries.map(e=>e.path);
  for(const e of pinned.entries)if(e.before)add(dir,e.path,'prior '+e.path+'\n');
  run(dir,'add','.');run(dir,'commit','-qm','protected original');
  const base=run(dir,'rev-parse','HEAD');
  for(const e of pinned.entries)add(dir,e.path,'accepted '+e.path+'\n');
  run(dir,'add','.');run(dir,'commit','-qm','exact selected eight');
  const accepted=run(dir,'rev-parse','HEAD');
  const fake={...pinned,entries:pinned.entries.map(e=>({...e,
   before:e.before?{mode:'100644',blob:run(dir,'rev-parse',base+':'+e.path)}:null,
   after:{mode:'100644',blob:run(dir,'rev-parse',accepted+':'+e.path)}}))};
  assert.equal(inspectTrustedR22Source(dir,{base,source:accepted,main:base},fake).count,8);
  add(dir,'scripts/wasm-distribution/r22-accepted-rust-scope.mjs','export const verify=()=>true;\n');
  run(dir,'add','.');run(dir,'commit','-qm','unapproved candidate Gate self-authorization');
  const badGate=run(dir,'rev-parse','HEAD');
  assert.throws(()=>inspectTrustedR22Source(dir,{base,source:badGate,main:base},fake),
    /SOURCE_PATH_SET_MISMATCH/);
  add(dir,'scripts/wasm-distribution/verify-protected-release.mjs','process.exit(0);\n');
  run(dir,'add','.');run(dir,'commit','-qm','unapproved candidate verifier self-authorization');
  assert.throws(()=>inspectTrustedR22Source(dir,{base,source:run(dir,'rev-parse','HEAD'),main:base},fake),
    /SOURCE_PATH_SET_MISMATCH/);
  run(dir,'reset','--hard',accepted);
  const first=pinned.entries.find(e=>e.before)?.path;
  chmodSync(join(dir,first),0o755);
  run(dir,'add','.');run(dir,'commit','-qm','unexpected 100755 mode');
  assert.throws(()=>inspectTrustedR22Source(dir,{base,source:run(dir,'rev-parse','HEAD'),main:base},fake),
    /EXACT_GIT_BLOB_MODE_MISMATCH|SOURCE_PATH_SET_MISMATCH/);
  run(dir,'reset','--hard',accepted);
  add(dir,first,'altered malicious Cargo or source\n');
  run(dir,'add','.');run(dir,'commit','-qm','wrong allowed Source blob');
  assert.throws(()=>inspectTrustedR22Source(dir,{base,source:run(dir,'rev-parse','HEAD'),main:base},fake),
    /EXACT_GIT_BLOB_MODE_MISMATCH/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
