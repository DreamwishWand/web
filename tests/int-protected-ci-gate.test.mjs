import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectProtectedCi,githubPublicJson} from '../scripts/int-protected-ci-gate.mjs';
const head='a'.repeat(40),other='b'.repeat(40),root='/repos/DreamwishWand/web';
const input={repository:'DreamwishWand/web',head,workflowBlob:'4dbc0572b70a9a8245695fed5e4a6369ee2f529a'};
const repo={id:1371485649,full_name:'DreamwishWand/web',default_branch:'main',private:false};
const ref={ref:'refs/heads/main',object:{type:'commit',sha:head}};
const run={id:123,workflow_id:370723530,path:'.github/workflows/ci.yml',head_sha:head,head_branch:'main',event:'push',run_attempt:1,status:'completed',conclusion:'success',repository:{id:1371485649},head_repository:{id:1371485649}};
const job={id:456,name:'verify',run_id:123,run_attempt:1,head_sha:head,status:'completed',conclusion:'success'};
function mock(options={}){
 const calls=[];let refs=0,runs=0;
 const get=async p=>{
  calls.push(p);
  if(p===root)return options.repo??repo;
  if(p===root+'/git/ref/heads/main'){refs++;return refs>1&&options.staleAfter?{...ref,object:{...ref.object,sha:other}}:options.ref??ref;}
  if(p.startsWith(root+'/actions/runs?'))return options.list??{total_count:1,workflow_runs:[run]};
  if(p===root+'/actions/runs/123'){runs++;return runs>1&&options.rerun?{...run,run_attempt:2}:options.run??run;}
  if(p===root+'/actions/runs/123/attempts/1/jobs?per_page=100')return options.jobs??{total_count:1,jobs:[job]};
  throw Error('UNEXPECTED_REQUEST:'+p);
 };
 return {get,calls};
}
test('protected main CI exact successful predecessor and latest ref readback',async()=>{
 const m=mock(),result=await inspectProtectedCi(input,m.get);
 assert.deepEqual(result,{status:'PROTECTED_CI_PREDECESSOR_MATCH',head,runId:123,attempt:1,jobId:456,mergeAuthorized:false,writerAuthorized:false});
 assert.equal(m.calls.filter(p=>p.endsWith('/git/ref/heads/main')).length,2);
 assert.equal(m.calls.filter(p=>p.endsWith('/actions/runs/123')).length,2);
});
test('deny wrong repository/workflow, stale main, failed or changed CI, incomplete jobs',async()=>{
 for(const [options,re] of [
  [{repo:{...repo,id:1}},/REPOSITORY_IDENTITY_DENIED/],
  [{ref:{...ref,object:{...ref.object,sha:other}}},/PROTECTED_MAIN_STALE/],
  [{staleAfter:true},/PROTECTED_MAIN_STALE/],
  [{list:{total_count:2,workflow_runs:[run]}},/CI_RUN_LIST_INCOMPLETE/],
  [{list:{total_count:2,workflow_runs:[run,run]}},/CI_RUN_AMBIGUOUS/],
  [{run:{...run,head_sha:other}},/CI_RUN_IDENTITY_MISMATCH/],
  [{run:{...run,conclusion:'failure'}},/PROTECTED_CI_NOT_SUCCESS/],
  [{run:{...run,event:'pull_request'}},/CI_RUN_IDENTITY_MISMATCH/],
  [{rerun:true},/RUN_IDENTITY_MISMATCH/],
  [{jobs:{total_count:1,jobs:[{...job,conclusion:'skipped'}]}},/JOB_NOT_SUCCESS/],
  [{jobs:{total_count:0,jobs:[]}},/JOB_SET_INCOMPLETE/]
 ]) await assert.rejects(inspectProtectedCi(input,mock(options).get),re);
 await assert.rejects(inspectProtectedCi({...input,workflowBlob:other},mock().get),/WORKFLOW_DENIED/);
 await assert.rejects(inspectProtectedCi({...input,repository:'other/repo'},mock().get),/WORKFLOW_DENIED/);
 for(const o of [{list:{total_count:0,workflow_runs:[]}},{run:{...run,status:'in_progress',conclusion:null}}])
  assert.equal((await inspectProtectedCi(input,mock(o).get)).status,'WAIT_PROTECTED_CI');
});
test('public transport rejects redirects and errors; no credentials or writes',async()=>{
 const p=root+'/git/ref/heads/main';
 const out=await githubPublicJson(p,async(url,options)=>{
  assert.equal(url.origin,'https://api.github.com');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(Object.keys(options.headers).some(k=>k.toLowerCase()==='authorization'),false);
  return new Response(JSON.stringify(ref),{headers:{'content-type':'application/json'}});
 });
 assert.deepEqual(out,ref);
 await assert.rejects(githubPublicJson(p,async()=>new Response('{}',{status:429,headers:{'content-type':'application/json'}})),/GITHUB_API_DENIED/);
 await assert.rejects(githubPublicJson('/repos/DreamwishWand/../bad'),/UNSAFE_API_PATH/);
});
test('existing signed Pages preserves order, permissions and push context',()=>{
 const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const order=['actions/attest-build-provenance@v2','gh attestation verify static/worker-wasm/manifest.json','node scripts/int-protected-ci-gate.mjs','actions/upload-pages-artifact@v3','Refuse stale main immediately before Pages deployment','actions/deploy-pages@v4','Verify actual same-origin HTTPS bytes'];
 let i=-1;for(const marker of order){const n=y.indexOf(marker);assert.ok(n>i,marker);i=n;}
 assert.match(y,/on:\s+push:\s+branches: \[main\]\s+workflow_dispatch:/);
 assert.doesNotMatch(y,/workflow_run:/);
 assert.match(y,/permissions:\s+pages: write\s+id-token: write/);
 assert.match(y,/concurrency:\s+group: github-pages\s+cancel-in-progress: false/);
});
