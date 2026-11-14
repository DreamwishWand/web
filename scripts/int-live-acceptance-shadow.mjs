// Read-only operational shadow. No source checkout, ref writes, CI dispatch or merge.
// The receipt and its digest must originate independently from accepted Board/INT records.
// A matching snapshot is not an atomic freshness guarantee or an authority grant.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {inspectRunEvidence} from './int-ci-evidence-preflight.mjs';

const REPO_ID=1371485649, SHA=/^[0-9a-f]{40}$/, DIGEST=/^[0-9a-f]{64}$/;
const repos=new Set(['DreamwishWand/web','DreamwishWand/site']);
const deny=m=>{throw Error(m)};
const sha=x=>typeof x==='string'&&SHA.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;

function localInspect(cwd,input){
  // Use a child process so ambient Git routing/config cannot be inherited, and
  // never check out the proposed source. The imported implementation is trusted.
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('GIT_')&&!['NODE_OPTIONS','NODE_PATH'].includes(k)));
  Object.assign(env,{GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_OPTIONAL_LOCKS:'0',
    GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'core.fsmonitor',GIT_CONFIG_VALUE_0:'false',GIT_CONFIG_KEY_1:'core.hooksPath',GIT_CONFIG_VALUE_1:'/dev/null'});
  const moduleUrl=JSON.stringify(new URL('./int-acceptance-pilot.mjs',import.meta.url).href);
  const code='import {inspectAcceptancePilot} from '+moduleUrl+'; import {readFileSync} from "node:fs"; console.log(JSON.stringify(inspectAcceptancePilot(process.cwd(),JSON.parse(readFileSync(0,"utf8")))));';
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd,env,encoding:'utf8',input:JSON.stringify(input),maxBuffer:4*1024*1024,stdio:['pipe','pipe','pipe']}));
}

export async function runLiveAcceptanceShadow(cwd,{repository,raw,expectedDigest},get){
  if(!repos.has(repository)||typeof get!=='function'||typeof raw!=='string'||Buffer.byteLength(raw)>65536||
     typeof expectedDigest!=='string'||!DIGEST.test(expectedDigest)||
     createHash('sha256').update(raw).digest('hex')!==expectedDigest)deny('SHADOW_INPUT_DENIED');
  const m=JSON.parse(raw),s=m?.source,c=m?.ci;
  if(m?.repositoryId!==REPO_ID||!positive(s?.pr)||!sha(s?.head)||!sha(s?.base)||!positive(c?.runId)||!positive(c?.attempt))deny('SHADOW_RECEIPT_IDENTITY_DENIED');
  const root='/repos/'+repository;
  const repo=await get(root);
  if(repo?.id!==REPO_ID||repo.full_name!==repository||repo.default_branch!=='main'||repo.private!==false)deny('SHADOW_REPO_IDENTITY_DENIED');
  const readMain=async()=>{
    const ref=await get(root+'/git/ref/heads/main');
    if(ref?.ref!=='refs/heads/main'||ref.object?.type!=='commit'||!sha(ref.object?.sha))deny('SHADOW_MAIN_UNKNOWN');
    return ref.object.sha;
  };
  const readPr=async()=>{
    const p=await get(root+'/pulls/'+s.pr);
    if(p?.number!==s.pr||p.state!=='open'||p.merged!==false||p.draft!==false||p.head?.sha!==s.head||
       p.head?.repo?.id!==REPO_ID||p.base?.repo?.id!==REPO_ID||p.base?.ref!=='main')deny('SHADOW_PR_CHANGED_OR_NOT_READY');
    return p;
  };
  const main=await readMain();
  await readPr();
  const run=await get(root+'/actions/runs/'+c.runId);
  const jobs=await get(root+'/actions/runs/'+c.runId+'/attempts/'+c.attempt+'/jobs?per_page=100');
  const result=localInspect(cwd,{raw,expectedDigest,main,run,jobs});
  // The existing verifier checks the exact original PR base/run/attempt/jobs.
  // Re-read the run, current PR and main so a stale snapshot cannot be called a match.
  const after=await get(root+'/actions/runs/'+c.runId);
  inspectRunEvidence({repositoryId:REPO_ID,workflowId:370723530,workflowPath:'.github/workflows/ci.yml',
    head:s.head,event:'pull_request',base:s.base,pr:s.pr,runId:c.runId,attempt:c.attempt,jobs:['verify']},after,jobs);
  await readPr();
  if(await readMain()!==main)deny('SHADOW_MAIN_CHANGED');
  return {...result,status:'LIVE_ACCEPTANCE_SHADOW_MATCH_ONLY',remoteSnapshotMatched:true,
    issuerVerified:false,qaSemanticsVerified:false,remoteFreshnessVerified:false,
    mergeAuthorized:false,writerAuthorized:false,refsUpdated:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==5)deny('USAGE: node scripts/int-live-acceptance-shadow.mjs repository receipt.json trusted-sha256');
    const [, ,repository,file,expectedDigest]=process.argv;
    if(!statSync(file).isFile()||statSync(file).size>65536)deny('SHADOW_RECEIPT_FILE_DENIED');
    // Reuse the independently accepted public GET transport from PR1249.
    // Until that dependency is present, this command fails closed.
    const {githubPublicJson}=await import('./int-protected-ci-gate.mjs');
    const result=await runLiveAcceptanceShadow(process.cwd(),{repository,raw:readFileSync(file,'utf8'),expectedDigest},githubPublicJson);
    console.log(JSON.stringify(result));
  }catch(error){console.error('INT_LIVE_SHADOW_DENIED:',error.message);process.exitCode=1;}
}
