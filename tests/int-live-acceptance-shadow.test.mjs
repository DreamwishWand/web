import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {runLiveAcceptanceShadow} from '../scripts/int-live-acceptance-shadow.mjs';
// Fixed actual public GitHub/Board snapshot, not a live authority or a new QA verdict.
// PR1260 original two files; actual CI run43590060819/attempt1/job132432688108.
// Historic current main b48bd69f was read before and after receipt preparation.
const repository='DreamwishWand/web',root='/repos/'+repository;
const head='cea71bcc15ce602688d3bb2381fde44cae87ac24',base='bae87871d5b7ac3678a3e9db9566ec0cf1a004b1',main='b48bd69f260230090216769de64f8444e2cd7902';
const raw='{"activation":"ACT-20261114-09INT-ACCEPTANCE-RECEIPT-PILOT","ci":{"attempt":1,"runId":43590060819},"dependencies":[],"flagChange":"NONE","qa":{"evidenceRef":"E-04QRS-20261114-ACT891-PR1260-CEA71BCC-ACCEPTANCE-RECEIPT-PASS","sourceHead":"cea71bcc15ce602688d3bb2381fde44cae87ac24","verdict":"QA_SCOPED_PASS"},"repositoryId":1371485649,"risk":"L2","scope":"INT_AUTOMATION_READONLY_PILOT","source":{"base":"bae87871d5b7ac3678a3e9db9566ec0cf1a004b1","entries":[{"after":{"blob":"41b6300258a900180169cd496e8decb2e8084f4c","mode":"100644"},"before":null,"path":"scripts/int-acceptance-pilot.mjs"},{"after":{"blob":"d883bd755942dacf1c692edb100d9773ff268389","mode":"100644"},"before":null,"path":"tests/int-acceptance-pilot.test.mjs"}],"head":"cea71bcc15ce602688d3bb2381fde44cae87ac24","pr":1260},"version":1}';
const expectedDigest='aea88369c0903ccbcaafa3480fdade4e23b536f2c0d29130ace071eb781745ff';
const input={repository,raw,expectedDigest};
const repo={id:1371485649,full_name:repository,default_branch:'main',private:false};
const pr={number:1260,state:'open',merged:false,draft:false,head:{sha:head,repo:{id:1371485649}},base:{ref:'main',sha:main,repo:{id:1371485649}}};
const run={id:43590060819,workflow_id:370723530,path:'.github/workflows/ci.yml',head_sha:head,event:'pull_request',run_attempt:1,
 repository:{id:1371485649},head_repository:{id:1371485649},status:'completed',conclusion:'success',
 pull_requests:[{number:1260,head:{sha:head,repo:{id:1371485649}},base:{sha:base,ref:'main',repo:{id:1371485649}}}]};
const jobs={total_count:1,jobs:[{id:132432688108,name:'verify',run_id:43590060819,run_attempt:1,head_sha:head,status:'completed',conclusion:'success'}]};
function transport(options={}){
 let refs=0,prs=0,runs=0;const calls=[];
 return {calls,get:async p=>{
   calls.push(p);
   if(p===root)return options.repo??repo;
   if(p===root+'/git/ref/heads/main'){refs++;return {ref:'refs/heads/main',object:{type:'commit',sha:refs===2&&options.staleMain?head:main}};}
   if(p===root+'/pulls/1260'){prs++;return prs===2&&options.stalePr?{...pr,state:'closed'}:options.pr??pr;}
   if(p===root+'/actions/runs/43590060819'){runs++;return runs===2&&options.rerun?{...run,run_attempt:2}:options.run??run;}
   if(p===root+'/actions/runs/43590060819/attempts/1/jobs?per_page=100')return options.jobs??jobs;
   throw Error('UNEXPECTED_REQUEST:'+p);
 }};
}
test('actual historical receipt/CI metadata and exact Git objects compose through shadow, no authority',async t=>{
 const cwd=process.cwd();
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{for(const s of [main,base,head])git('cat-file','-e',s+'^{commit}');}
 catch(error){if(process.env.CI==='true')throw error;t.skip('Historical Git objects unavailable in local shallow checkout');return;}
 const before=git('show-ref'),m=transport();
 const out=await runLiveAcceptanceShadow(cwd,input,m.get);
 assert.equal(out.status,'LIVE_ACCEPTANCE_SHADOW_MATCH_ONLY');assert.equal(out.remoteSnapshotMatched,true);
 assert.equal(out.main,main);assert.equal(out.ciJobId,132432688108);assert.equal(out.entries.length,2);
 for(const k of ['issuerVerified','qaSemanticsVerified','remoteFreshnessVerified','mergeAuthorized','writerAuthorized','refsUpdated'])assert.equal(out[k],false);
 assert.equal(git('show-ref'),before);
 for(const [o,re] of [[{staleMain:true},/SHADOW_MAIN_CHANGED/],[{stalePr:true},/SHADOW_PR_CHANGED/],[{rerun:true},/RUN_IDENTITY_MISMATCH/],
  [{repo:{...repo,id:1}},/SHADOW_REPO_IDENTITY/],[{pr:{...pr,head:{...pr.head,sha:main}}},/SHADOW_PR_CHANGED/]]){
  await assert.rejects(runLiveAcceptanceShadow(cwd,input,transport(o).get),re);
 }
 assert.equal(git('show-ref'),before);
 assert.equal(m.calls.length,8);
});
test('bad externally pinned digest rejects before any network',async()=>{
 const m=transport();
 await assert.rejects(runLiveAcceptanceShadow(process.cwd(),{...input,expectedDigest:'0'.repeat(64)},m.get),/SHADOW_INPUT_DENIED/);
 assert.equal(m.calls.length,0);
});
