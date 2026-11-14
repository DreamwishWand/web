import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectRunEvidence} from '../scripts/int-ci-evidence-preflight.mjs';
const head='a'.repeat(40), base='b'.repeat(40);
const expected={repositoryId:11,workflowId:12,workflowPath:'.github/workflows/ci.yml',head,event:'pull_request',base,pr:13,runId:14,attempt:2,jobs:['verify']};
const run={id:14,workflow_id:12,path:expected.workflowPath,head_sha:head,event:'pull_request',run_attempt:2,repository:{id:11},head_repository:{id:11},status:'completed',conclusion:'success',pull_requests:[{number:13,head:{sha:head,repo:{id:11}},base:{sha:base,ref:'main',repo:{id:11}}}]};
const job={id:15,name:'verify',run_id:14,run_attempt:2,head_sha:head,status:'completed',conclusion:'success'};
const jobs={total_count:1,jobs:[job]};
test('exact run and attempt evidence, not acceptance',()=>{
 const out=inspectRunEvidence(expected,run,jobs);
 assert.equal(out.status,'CI_EVIDENCE_MATCH_ONLY');
 assert.equal(out.mergeAuthorized,false);assert.equal(out.acceptanceVerified,false);assert.equal(out.remoteFreshnessVerified,false);
 assert.deepEqual(out.jobs,[{id:15,name:'verify'}]);
 const push={...expected,event:'push',pr:null,base:null};
 assert.equal(inspectRunEvidence(push,{...run,event:'push',head_branch:'main'},jobs).event,'push');
 assert.throws(()=>inspectRunEvidence(push,{...run,event:'push',head_branch:'dev'},jobs),/PUSH_NOT_MAIN/);
});
test('reject stale, foreign, missing, skipped and spoofed evidence',()=>{
 for(const delta of [{id:99},{workflow_id:99},{path:'.github/workflows/other.yml'},{head_sha:base},{run_attempt:1},{event:'push'},{repository:{id:99}},{head_repository:{id:99}}])
  assert.throws(()=>inspectRunEvidence(expected,{...run,...delta},jobs),/RUN_IDENTITY_MISMATCH/);
 for(const delta of [{status:'in_progress'},{conclusion:'failure'},{conclusion:'skipped'},{conclusion:'cancelled'}])
  assert.throws(()=>inspectRunEvidence(expected,{...run,...delta},jobs),/RUN_NOT_SUCCESS/);
 for(const p of [{...run.pull_requests[0],number:99},{...run.pull_requests[0],base:{sha:head,ref:'main',repo:{id:11}}},{...run.pull_requests[0],base:{sha:base,ref:'dev',repo:{id:11}}}])
  assert.throws(()=>inspectRunEvidence(expected,{...run,pull_requests:[p]},jobs),/PR_BINDING_MISMATCH/);
 assert.throws(()=>inspectRunEvidence(expected,{...run,pull_requests:[]},jobs),/PR_BINDING_MISSING/);
 for(const d of [{id:0},{name:'other'},{run_id:99},{run_attempt:1},{head_sha:base}])
  assert.throws(()=>inspectRunEvidence(expected,run,{total_count:1,jobs:[{...job,...d}]}),/JOB_IDENTITY_MISMATCH/);
 for(const d of [{status:'queued'},{conclusion:'skipped'},{conclusion:'failure'}])
  assert.throws(()=>inspectRunEvidence(expected,run,{total_count:1,jobs:[{...job,...d}]}),/JOB_NOT_SUCCESS/);
 for(const j of [{total_count:2,jobs:[job]},{total_count:0,jobs:[]},{total_count:2,jobs:[job,job]}])
  assert.throws(()=>inspectRunEvidence(expected,run,j),/JOB_SET_INCOMPLETE/);
 for(const d of [{head:'HEAD'},{attempt:0},{jobs:['verify','verify']},{workflowPath:'../ci.yml'},{extra:true}])
  assert.throws(()=>inspectRunEvidence({...expected,...d},run,jobs),/INVALID_EXPECTATION/);
});
