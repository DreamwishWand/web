#!/usr/bin/env node
// CTRL54 operator planning ONLY: never executes SQL, backup, network, storage or commands.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const STAGE = 'ptpdoxhrqopvczpclcij';
const BUCKETS = Object.freeze(['community-media-staging','wand-preset-artifacts-staging']);
const REF = /^(?:[a-z0-9]{20}|offline:[A-Za-z0-9_-]{4,64})$/;
const DRIVE = /^(?:[a-zA-Z]:\\|\\\\[^\\]+\\[^\\]+\\)/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,63}$/;
const ALLOWED = new Set(['sourceRef','targetRef','archiveRoot','ticketId','operatorId','reviewerId','encrypted','approved']);

export function plan(x) {
  const errors = [];
  const requireCheck = (condition, id) => { if (!condition) errors.push(id); };
  requireCheck(x.sourceRef === STAGE, 'SOURCE_REF_MISMATCH');
  requireCheck(REF.test(x.targetRef ?? '') && x.targetRef !== STAGE, 'ISOLATED_TARGET_REQUIRED');
  const root = (x.archiveRoot ?? '').replace(/\//g,'\\').replace(/\\+$/,'');
  requireCheck(DRIVE.test(root) && !/(?:^|\\)(?:\.git|node_modules|Downloads|Desktop|Documents)(?:\\|$)/i.test(root), 'PROTECTED_WINDOWS_ARCHIVE_PATH_REQUIRED');
  requireCheck(ID.test(x.ticketId ?? ''), 'APPROVAL_TICKET_REQUIRED');
  requireCheck(ID.test(x.operatorId ?? '') && ID.test(x.reviewerId ?? '') && x.operatorId !== x.reviewerId, 'DISTINCT_REVIEWER_REQUIRED');
  requireCheck(x.encrypted === 'yes', 'ENCRYPTED_DESTINATION_UNCONFIRMED');
  requireCheck(x.approved === 'yes', 'A0_SCOPED_APPROVAL_UNCONFIRMED');
  requireCheck(Object.keys(x).every(k=>ALLOWED.has(k)), 'UNKNOWN_OPTION');
  if(errors.length) return {status:'NEED_OPERATOR',errors};
  return {status:'DRY_RUN_PLAN_ONLY',executionPermitted:false,
    sourceProject:STAGE,isolatedTarget:x.targetRef,archiveRoot:'[PRIVATE_ENCRYPTED_PATH]',
    buckets:BUCKETS,operatorTicket:x.ticketId,
    actions:[
      'Independently verify A0 ticket, reviewer, target isolation and approval; planner output is not approval',
      'Pin CLI/Docker/psql/rclone versions; keep credentials out of source, shell args and public logs',
      'Archive encrypted DB roles/schema/data AND separately exported 116 migration history/original applied SQL',
      'Capture auth/storage custom definitions and original Stage-only SQL effects, ACL/RLS/triggers/queues',
      'Copy original bytes from both PRIVATE Storage buckets; inventory/version/hold/hash metadata',
      'Verify both encrypted archives and offsite hashes, data continuity, privacy deletion ledger',
      'Restore data-bearing DB into independently isolated NO-EGRESS compatible environment with no active Cron/pg_net/Edge/Workers',
      'Restore Storage objects independently into quarantined target; re-download and compare SHA256/references',
      'Reconcile deletion ledger, tombstones and invalidate/revalidate restored Auth sessions',
      'Independent restore review, DB/Storage RPO<=24h and target RTO<=4h, PR272 receipt-shape check only',
      'Do not enable positive public/worker/Storage/URL/Provider routes or claim A2 acceptance'
    ]};
}
function parse(args) {
  const out={};
  for(let i=0;i<args.length;i++){
    const flag=args[i];
    if(!flag.startsWith('--') || flag==='--' || flag==='--self-test') return null;
    const key=flag.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    if(!key || !ALLOWED.has(key) || Object.hasOwn(out,key) || i+1>=args.length || args[i+1].startsWith('--')) return null;
    out[key]=args[++i];
  }
  return out;
}
function selfTest(){
  const ok={sourceRef:STAGE,targetRef:'offline:pg17-quarantine-01',archiveRoot:'X:\\WandRecovery\\Stage116',
    ticketId:'CTRL54-Test',operatorId:'operatorA',reviewerId:'reviewerB',encrypted:'yes',approved:'yes'};
  assert.equal(plan(ok).status,'DRY_RUN_PLAN_ONLY');
  assert.equal(plan(ok).executionPermitted,false);
  const bad=[{targetRef:STAGE},{targetRef:''},{sourceRef:'abcdefghijklmnopqrst'},
    {archiveRoot:'.\\backup'},{archiveRoot:'C:\\Users\\Desktop\\backup'},{ticketId:''},
    {operatorId:'reviewerB'},{encrypted:'no'},{approved:'no'},{dbPassword:'synthetic'},
    {archiveRoot:'C:\\repo\\.git\\backups'},{reviewerId:'unsafe name'},{targetRef:'offline:unsafe target'}];
  bad.forEach((mutation,i)=>assert.equal(plan({...ok,...mutation}).status,'NEED_OPERATOR','negative '+i));
  assert.equal(parse(['--source-ref',STAGE,'--source-ref',STAGE]),null);
  console.log('STAGE116_RECOVERY_DRY_RUN_13_NEGATIVES_PASS; ZERO SIDE EFFECTS');
}
const invoked=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--self-test') selfTest();
  else{
    const opts=parse(args);
    const result=opts?plan(opts):{status:'NEED_OPERATOR',errors:['INVALID_ARGUMENTS']};
    console.log(JSON.stringify(result,null,2));
    if(result.status!=='DRY_RUN_PLAN_ONLY') process.exitCode=1;
  }
}
