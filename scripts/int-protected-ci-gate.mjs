// Protected Pages CI predecessor: public GitHub GET only; no credentials, no writes.
// This gate supplements existing signatures/lock/host checks; never changes them.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { inspectRunEvidence } from './int-ci-evidence-preflight.mjs';

const REPO_ID=1371485649, CI_ID=370723530, CI_PATH='.github/workflows/ci.yml';
const CI_BLOB='4dbc0572b70a9a8245695fed5e4a6369ee2f529a';
const SHA=/^[0-9a-f]{40}$/;
const repos=new Set(['DreamwishWand/web','DreamwishWand/site']);
const pending=new Set(['queued','in_progress','requested','waiting','pending']);
const deny=m=>{throw new Error(m)};
const integer=n=>Number.isSafeInteger(n)&&n>0;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function githubPublicJson(path,fetcher=fetch) {
  if(typeof path!=='string'||!path.startsWith('/repos/DreamwishWand/')||
     path.includes('..')||path.includes('#')||path.includes('\\'))deny('UNSAFE_API_PATH');
  const url=new URL('https://api.github.com'+path);
  if(url.origin!=='https://api.github.com')deny('UNSAFE_API_ORIGIN');
  const response=await fetcher(url,{method:'GET',redirect:'error',
    headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'DreamwishWand-protected-CI'},
    signal:AbortSignal.timeout(20000)});
  if(!response.ok||response.redirected||!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
    deny('GITHUB_API_DENIED:'+response.status);
  const chunks=[];let n=0;
  if(!response.body)deny('GITHUB_API_EMPTY');
  for await(const chunk of response.body){n+=chunk.length;if(n>4*1024*1024)deny('GITHUB_API_TOO_LARGE');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function inspectProtectedCi({repository,head,workflowBlob},get=githubPublicJson) {
  if(!repos.has(repository)||typeof head!=='string'||!SHA.test(head)||workflowBlob!==CI_BLOB)deny('PROTECTED_CI_INPUT_OR_WORKFLOW_DENIED');
  const root='/repos/'+repository;
  const ref=async()=>{
    const r=await get(root+'/git/ref/heads/main');
    if(r?.ref!=='refs/heads/main'||r.object?.type!=='commit'||r.object?.sha!==head)deny('PROTECTED_MAIN_STALE');
  };
  const repo=await get(root);
  if(repo?.id!==REPO_ID||repo.full_name!==repository||repo.default_branch!=='main'||repo.private!==false)deny('REPOSITORY_IDENTITY_DENIED');
  await ref();
  const list=await get(root+'/actions/runs?branch=main&event=push&head_sha='+head+'&per_page=100');
  if(!Array.isArray(list?.workflow_runs)||list.total_count!==list.workflow_runs.length||list.workflow_runs.length>100)deny('CI_RUN_LIST_INCOMPLETE');
  const candidates=list.workflow_runs.filter(r=>r?.workflow_id===CI_ID);
  if(candidates.length===0)return {status:'WAIT_PROTECTED_CI'};
  if(candidates.length!==1)deny('CI_RUN_AMBIGUOUS');
  const selected=candidates[0];
  if(!integer(selected.id)||selected.head_sha!==head||selected.path!==CI_PATH||selected.event!=='push'||selected.head_branch!=='main')deny('CI_RUN_SELECTION_MISMATCH');
  const run=await get(root+'/actions/runs/'+selected.id);
  if(run?.id!==selected.id||run.workflow_id!==CI_ID||run.path!==CI_PATH||run.head_sha!==head||run.event!=='push'||run.head_branch!=='main'||run.repository?.id!==REPO_ID||run.head_repository?.id!==REPO_ID||!integer(run.run_attempt))deny('CI_RUN_IDENTITY_MISMATCH');
  if(pending.has(run.status))return {status:'WAIT_PROTECTED_CI'};
  if(run.status!=='completed'||run.conclusion!=='success')deny('PROTECTED_CI_NOT_SUCCESS');
  const expected={repositoryId:REPO_ID,workflowId:CI_ID,workflowPath:CI_PATH,head,event:'push',base:null,pr:null,runId:run.id,attempt:run.run_attempt,jobs:['verify']};
  const jobs=await get(root+'/actions/runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs?per_page=100');
  const after=await get(root+'/actions/runs/'+run.id);
  const evidence=inspectRunEvidence(expected,after,jobs);
  await ref();
  return {status:'PROTECTED_CI_PREDECESSOR_MATCH',head,runId:evidence.runId,attempt:evidence.attempt,jobId:evidence.jobs[0].id,mergeAuthorized:false,writerAuthorized:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const e=process.env;
    if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY_ID!==String(REPO_ID)||e.GITHUB_REF!=='refs/heads/main'||!['push','workflow_dispatch'].includes(e.GITHUB_EVENT_NAME))deny('PROTECTED_WORKFLOW_CONTEXT_DENIED');
    const git=(...args)=>execFileSync('git',args,{encoding:'utf8',env:{...e,GIT_NO_REPLACE_OBJECTS:'1'}}).trim();
    if(git('rev-parse','HEAD')!==e.GITHUB_SHA||e.GITHUB_WORKFLOW_SHA!==e.GITHUB_SHA)deny('PROTECTED_CHECKOUT_MISMATCH');
    let result;
    // Bounded wait only for a missing/pending CI, no retry of actual failure.
    for(let i=0;i<6;i++){
      result=await inspectProtectedCi({repository:e.GITHUB_REPOSITORY,head:e.GITHUB_SHA,workflowBlob:git('rev-parse','HEAD:'+CI_PATH)});
      if(result.status==='PROTECTED_CI_PREDECESSOR_MATCH')break;
      if(i<5)await wait(10000);
    }
    if(result?.status!=='PROTECTED_CI_PREDECESSOR_MATCH')deny('PROTECTED_CI_WAIT_TIMEOUT');
    console.log(JSON.stringify(result));
  }catch(error){console.error('PROTECTED_CI_GATE_DENIED:',error.message);process.exitCode=1;}
}
