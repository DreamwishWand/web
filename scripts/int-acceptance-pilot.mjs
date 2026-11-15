// First restricted integration intake: canonical Board/INT receipt + exact Git/CI binding.
// The caller must independently obtain the digest from the trusted acceptance record
// and CI snapshots from GitHub. Neither the source PR nor this function grants authority.
import { createHash } from 'node:crypto';
import { inspectSelection } from './int-selection-preflight.mjs';
import { inspectRunEvidence } from './int-ci-evidence-preflight.mjs';

const SHA=/^[0-9a-f]{40}$/, DIGEST=/^[0-9a-f]{64}$/;
const sha=x=>typeof x==='string'&&SHA.test(x);
const digest=x=>typeof x==='string'&&DIGEST.test(x);
const int=x=>Number.isSafeInteger(x)&&x>0;
const deny=m=>{throw new Error(m)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,k)=>object(x)&&Object.keys(x).sort().join(',')===[...k].sort().join(',');
const path=x=>typeof x==='string'&&x.endsWith('.mjs')&&(/^(scripts|tests)\/int-[a-z0-9][a-z0-9-]{0,100}\.mjs$/.test(x)||/^tests\/int-[a-z0-9][a-z0-9-]{0,100}\.test\.mjs$/.test(x));
const entry=x=>x===null||(keys(x,['mode','blob'])&&x.mode==='100644'&&sha(x.blob));
const token=(x,p)=>typeof x==='string'&&x.length<=160&&p.test(x);
const equal=(a,b)=>a===null||b===null?a===b:a.mode===b.mode&&a.blob===b.blob;
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
  object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);
const hash=x=>createHash('sha256').update(x,'utf8').digest('hex');

export function inspectAcceptancePilot(cwd,{raw,expectedDigest,main,run,jobs}){
  // Raw text + independently pinned digest; never accept a caller-supplied digest
  // as evidence of issuer identity. This pilot only verifies correspondence.
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>65536||!digest(expectedDigest)||hash(raw)!==expectedDigest||!sha(main))
    deny('RECEIPT_DIGEST_OR_INPUT_DENIED');
  const m=JSON.parse(raw);
  if(!keys(m,['version','repositoryId','activation','scope','risk','flagChange','dependencies','source','qa','ci'])||
     m.version!==1||m.repositoryId!==1371485649||
     !token(m.activation,/^ACT-[A-Z0-9-]+$/)||m.scope!=='INT_AUTOMATION_READONLY_PILOT'||
     m.risk!=='L2'||m.flagChange!=='NONE'||!Array.isArray(m.dependencies)||m.dependencies.length!==0||
     !keys(m.source,['pr','base','head','entries'])||!int(m.source.pr)||!sha(m.source.base)||!sha(m.source.head)||
     !Array.isArray(m.source.entries)||m.source.entries.length<1||m.source.entries.length>16||
     !keys(m.qa,['sourceHead','verdict','evidenceRef'])||m.qa.sourceHead!==m.source.head||
     m.qa.verdict!=='QA_SCOPED_PASS'||!token(m.qa.evidenceRef,/^E-[A-Za-z0-9-]+$/)||
     !keys(m.ci,['runId','attempt'])||!int(m.ci.runId)||!int(m.ci.attempt))
    deny('RECEIPT_SCOPE_DENIED');
  const paths=[];
  for(const e of m.source.entries){
    if(!keys(e,['path','before','after'])||!path(e.path)||!entry(e.before)||!entry(e.after)||
       equal(e.before,e.after)||paths.includes(e.path))deny('RECEIPT_PATH_OR_BLOB_DENIED');
    paths.push(e.path);
  }
  if(paths.some((p,i)=>i>0&&paths[i-1]>=p)||canon(m)!==raw)deny('RECEIPT_NOT_CANONICAL');
  const selection=inspectSelection(cwd,{base:m.source.base,source:m.source.head,main,paths});
  if(selection.entries.length!==m.source.entries.length||selection.entries.some((e,i)=>
      e.path!==m.source.entries[i].path||!equal(e.before,m.source.entries[i].before)||!equal(e.after,m.source.entries[i].after)))
    deny('RECEIPT_SELECTION_MISMATCH');
  const ci=inspectRunEvidence({repositoryId:m.repositoryId,workflowId:370723530,
    workflowPath:'.github/workflows/ci.yml',head:m.source.head,event:'pull_request',
    base:m.source.base,pr:m.source.pr,runId:m.ci.runId,attempt:m.ci.attempt,jobs:['verify']},run,jobs);
  return {version:1,status:'ACCEPTANCE_RECEIPT_BINDING_ONLY',receiptSha256:expectedDigest,
    activation:m.activation,scope:m.scope,sourceHead:m.source.head,sourceBase:m.source.base,
    main,entries:selection.entries,ciRunId:ci.runId,ciAttempt:ci.attempt,ciJobId:ci.jobs[0].id,
    qaEvidenceRef:m.qa.evidenceRef,issuerVerified:false,qaSemanticsVerified:false,
    remoteFreshnessVerified:false,mergeAuthorized:false,writerAuthorized:false};
}
