import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspectAcceptancePilot} from '../scripts/int-acceptance-pilot.mjs';
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':x!==null&&typeof x==='object'?
 '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
test('restricted receipt binds exact Git original blobs and CI without granting authority',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wand-int-intake-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const commit=m=>{git('add','-A');git('commit','-m',m);return git('rev-parse','HEAD');};
 try{
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
  mkdirSync(join(dir,'scripts'));mkdirSync(join(dir,'tests'));writeFileSync(join(dir,'README.md'),'root');const base=commit('base');
  git('checkout','-b','source');writeFileSync(join(dir,'scripts/int-pilot.mjs'),'export const a=1;');writeFileSync(join(dir,'tests/int-pilot.test.mjs'),'// synthetic test');const head=commit('source');
  const blob=git('rev-parse',head+':scripts/int-pilot.mjs');const testBlob=git('rev-parse',head+':tests/int-pilot.test.mjs');
  git('checkout','main');writeFileSync(join(dir,'README.md'),'unrelated main');const main=commit('main');
  const m={version:1,repositoryId:1371485649,activation:'ACT-SYNTHETIC',scope:'INT_AUTOMATION_READONLY_PILOT',risk:'L2',flagChange:'NONE',dependencies:[],
   source:{pr:1,base,head,entries:[{path:'scripts/int-pilot.mjs',before:null,after:{mode:'100644',blob}},{path:'tests/int-pilot.test.mjs',before:null,after:{mode:'100644',blob:testBlob}}]},
   qa:{sourceHead:head,verdict:'QA_SCOPED_PASS',evidenceRef:'E-SYNTHETIC'},ci:{runId:2,attempt:1}};
  const run={id:2,workflow_id:370723530,path:'.github/workflows/ci.yml',head_sha:head,event:'pull_request',run_attempt:1,
   repository:{id:1371485649},head_repository:{id:1371485649},status:'completed',conclusion:'success',
   pull_requests:[{number:1,head:{sha:head,repo:{id:1371485649}},base:{sha:base,ref:'main',repo:{id:1371485649}}}]};
  const jobs={total_count:1,jobs:[{id:3,name:'verify',run_id:2,run_attempt:1,head_sha:head,status:'completed',conclusion:'success'}]};
  const verify=(v=m,extra={})=>{const raw=canon(v);return inspectAcceptancePilot(dir,{raw,expectedDigest:hash(raw),main,run,jobs,...extra});};
  const result=verify();
  assert.equal(result.status,'ACCEPTANCE_RECEIPT_BINDING_ONLY');
  assert.equal(result.ciJobId,3);assert.equal(result.entries[0].after.blob,blob);assert.equal(result.entries[1].path,'tests/int-pilot.test.mjs');assert.equal(result.entries[1].after.blob,testBlob);
  for(const k of ['issuerVerified','qaSemanticsVerified','remoteFreshnessVerified','mergeAuthorized','writerAuthorized'])assert.equal(result[k],false);
  assert.throws(()=>verify(m,{expectedDigest:'0'.repeat(64)}),/RECEIPT_DIGEST/);
  assert.throws(()=>{const raw=JSON.stringify(m);inspectAcceptancePilot(dir,{raw,expectedDigest:hash(raw),main,run,jobs});},/RECEIPT_NOT_CANONICAL/);
  for(const x of [{risk:'L1'},{flagChange:'ON'},{dependencies:[base]},{repositoryId:1},{scope:'Writer'},{extra:true},{qa:{...m.qa,sourceHead:base}},{qa:{...m.qa,verdict:'TRUE_RED'}}])
   assert.throws(()=>verify({...m,...x}),/RECEIPT_SCOPE_DENIED/);
  for(const path of ['.github/workflows/pages.yml','scripts/int-pilot.test.mjs','tests/int-pilot.test.test.mjs','tests/int-pilot.spec.mjs','tests/nested/int-pilot.test.mjs','tests/INT-pilot.test.mjs','src/int-pilot.test.mjs','tests/int-pilot.test.mjs/child']){
   assert.throws(()=>verify({...m,source:{...m.source,entries:[{...m.source.entries[0],path},m.source.entries[1]]}}),/RECEIPT_PATH/);
  }
  assert.throws(()=>verify({...m,source:{...m.source,entries:[{...m.source.entries[0],after:{mode:'100644',blob:'1'.repeat(40)}},m.source.entries[1]]}}),/RECEIPT_SELECTION_MISMATCH/);
  assert.throws(()=>verify(m,{run:{...run,run_attempt:2}}),/RUN_IDENTITY_MISMATCH/);
  assert.throws(()=>verify(m,{run:{...run,conclusion:'failure'}}),/RUN_NOT_SUCCESS/);
  assert.throws(()=>verify(m,{main:head}),/MAIN_PREIMAGE_MISMATCH/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
