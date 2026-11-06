// 04 QR-S: new-only independent Stage116 E669 evidence-gate adversarial QA.
// No managed DB, network, SQL generator, private tokens, or Stage116 clone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {
  STAGE116_RECORDED, SOURCE164_PREREQUISITE,
  ORIGINAL82_RPC_GIT_SHA, DERIVED169_PR676_SOURCE_HEAD, LEGACY_SIX,
  SAFE_FORWARD_PHASES, assessRecordedStage116, forbidRemoteDbInCli
} from '../scripts/comm-stage116-safe-forward-gate.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const source=join(root,'scripts/comm-stage116-safe-forward-gate.mjs');
const srcHead='d560fac647ec46889d465d1919f26d539c0ab3f7';
const parent='afeaf2955eb5515624d9ab27b8743e59e5a0145c';
const evidence={
  evidenceId:'E-09P-SQL-R17-STAGING116-LEDGER-SHA256-20261106',
  appliedCount:116,distinctVersions:116,distinctNames:112,duplicateNameGroups:4,
  populatedStatements:116,rollbackStatements:0,
  ledgerManifestSha256:'889bfd7dfa7e2ee9bba65a92f6f1f8675bf98ad165d870df1781b842f03c4861',
  functionCatalogueSha256:'c3c1d224139a633a601f516d815e77a1567a60bd241a42ad3be630ffd01fa6ac',
  historicalRpcAppliedVersion:'20260930025609',
  canonicalRpcVersion:'20260930025132',
  fkHardeningApplied:true,prerequisiteParentMigrationApplied:false,
  prerequisiteParentTableExists:true,source164To169Applied:0,
  signedR16GalleryRpcExists:false,workspaceSignedPrivilegesObserved:true,
  legacyServiceRoleExecutableCount:6,legacyAnonExecutableCount:0,
  legacyAuthenticatedExecutableCount:0,
  original82RpcGitSha:'bbf9bc830440d964c5da8b3c3cac7e926d281881'
};
const forbidden=[
  'mayGenerateSql','mayApplyMigration','mayDeploy','mayMerge',
  'writerEnabled','communityPublicEnabled','providerEnabled',
  'original82RawBootstrapPass','stageEquivalentClonePass',
  'fullSignedGoTrueTwoPgPass','rollbackProven'
];
const recorded=()=>({...evidence});
function assertBlocked(r,status){
  assert.equal(r.status,status);
  for(const field of forbidden)assert.equal(r[field],false,field);
}
function mark(s){console.log('QR688_'+s+'_PASS');}
function git(...params){
  return execFileSync('git',params,{cwd:root,encoding:'utf8'}).trim();
}

test('independent E669 hash and original82 lineage oracle always holds at missing R16',()=>{
  assert.deepEqual(STAGE116_RECORDED,evidence);
  assert.equal(ORIGINAL82_RPC_GIT_SHA,evidence.original82RpcGitSha);
  assert.equal(DERIVED169_PR676_SOURCE_HEAD,parent);
  assert.equal(LEGACY_SIX.length,6);
  assert.equal(new Set(LEGACY_SIX).size,6);
  assert.equal(SOURCE164_PREREQUISITE,
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)');
  assert.equal(SAFE_FORWARD_PHASES.length,4);
  assert.equal(git('rev-parse',srcHead),srcHead);
  assert.deepEqual(git('diff','--name-only',parent,srcHead).split('\n').sort(),[
    'docs/community/stage116-safe-forward-negative-preflight-20261106.md',
    'scripts/comm-stage116-safe-forward-gate.mjs',
    'tests/comm-stage116-safe-forward-gate.test.mjs'
  ]);
  assert.equal(git('hash-object','supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),
    evidence.original82RpcGitSha);
  const result=assessRecordedStage116(recorded());
  assertBlocked(result,'HOLD_R16_SIGNED_PREREQUISITE');
  assert.deepEqual(result.mismatchedFields,[]);
  assert.ok(result.blockers.includes('SOURCE164_SIGNED_R16_PREREQUISITE_ABSENT'));
  assert.ok(result.blockers.includes('LEGACY_SIX_SERVICE_ROLE_EXECUTE_STILL_TRUE'));
  assert.ok(result.blockers.includes('RAW_ORIGINAL82_SQLSTATE42601_TRUE_RED'));
  assert.equal(result.evidenceLevel,'MANAGED_READ_ONLY_METADATA_REUSE_E669_NOT_CLONE_OR_SIGNED');
  assert.equal(result.unsafeOldRpcSignatures.length,6);
  mark('E669_PINNED_HISTORICAL82_R16_MISSING_ALWAYS_HOLD');
});
test('every E669 field: missing, type drift, fabricated value, and extra field reattest',()=>{
  for(const [key,value] of Object.entries(evidence)){
    const missing=recorded();delete missing[key];
    const changed={...recorded(),[key]:typeof value==='number'?'9':
      typeof value==='boolean'?!value: value+'_tampered'};
    const invalid={...recorded(),[key]:null};
    for(const variant of [missing,changed,invalid]){
      const r=assessRecordedStage116(variant);
      assertBlocked(r,'HOLD_REATTEST_STAGE116');
      assert.ok(r.mismatchedFields.includes(key),key);
    }
  }
  for(const extra of ['ownerApproved','signedR16Ready','stage116Approved','rollbackPassed',
    'execute','serviceRoleWriterEnabled']){
    const r=assessRecordedStage116({...recorded(),[extra]:true});
    assertBlocked(r,'HOLD_REATTEST_STAGE116');
    assert.ok(r.mismatchedFields.includes('unexpected:'+extra));
  }
  mark('ALL_FIELDS_MISSING_TAMPER_TYPE_AND_EXTRA_DENIED');
});
test('positive R16, zero legacy grants, applied164-169 or fabricated approval cannot promote',()=>{
  const states=[
    {signedR16GalleryRpcExists:true},
    {legacyServiceRoleExecutableCount:0},
    {source164To169Applied:6},
    {rollbackStatements:1},
    {historicalRpcAppliedVersion:'20260930025132'},
    {prerequisiteParentMigrationApplied:true},
    {workspaceSignedPrivilegesObserved:false},
    {appliedCount:169},
  ];
  for(const patch of states){
    const r=assessRecordedStage116({...recorded(),...patch},
      {ownerApproved:true,deployReady:true, signedRuntimePass:true,
        stageEquivalentClone:true, rollbackProven:true, legacyWriterApproved:true});
    assertBlocked(r,'HOLD_REATTEST_STAGE116');
    assert.ok(r.blockers.includes('CALLER_APPROVAL_FLAGS_NOT_EVIDENCE'));
  }
  assertBlocked(assessRecordedStage116(recorded(),
    {ownerApproved:true,deployReady:true,writerEnabled:true}), 'HOLD_R16_SIGNED_PREREQUISITE');
  mark('FAKE_SIGNED_R16_LEGACY_ROLE_APPROVAL_ROLLBACK_NOT_EVIDENCE');
});
test('malformed inputs and invalid option shape fail closed without SQL or writer rights',()=>{
  for(const obj of [null,undefined,false,true,[],3,'fake',new Date(),Object.create({status:'ready'})]){
    assertBlocked(assessRecordedStage116(obj),'HOLD_INVALID_INPUT');
  }
  for(const options of [null,[],true,42,'approve',new Date(),Object.create({ownerApproved:true})]){
    assertBlocked(assessRecordedStage116(recorded(),options),'HOLD_INVALID_INPUT');
  }
  const nullProto=Object.assign(Object.create(null),recorded());
  assertBlocked(assessRecordedStage116(nullProto),'HOLD_R16_SIGNED_PREREQUISITE');
  const extra=recorded();
  Object.defineProperty(extra,'__proto__',{value:{ownerApproved:true},enumerable:true});
  assertBlocked(assessRecordedStage116(extra),'HOLD_REATTEST_STAGE116');
  mark('MALFORMED_PROTOTYPE_OPTION_INPUT_FAIL_CLOSED');
});
test('CLI explicitly only inspects E669, never remote credentials or executable action',()=>{
  const base={PATH:process.env.PATH??'',HOME:process.env.HOME??''};
  const exec=args=>spawnSync(process.execPath,[source,...args],
    {cwd:root,encoding:'utf8',env:base,timeout:9000});
  const ok=exec(['--inspect-recorded-e669']);
  assert.equal(ok.status,0,ok.stderr?.slice(0,300));
  const result=JSON.parse(ok.stdout);
  assertBlocked(result,'HOLD_R16_SIGNED_PREREQUISITE');
  assert.equal(result.evidenceId,evidence.evidenceId);
  for(const args of [[],['--apply'],['--deploy'],['--inspect-recorded-e669','--merge'],
    ['--execute-sql']])assert.notEqual(exec(args).status,0);
  for(const name of ['DATABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD',
    'SUPABASE_PROJECT_ID','PGHOST','PGSERVICE','PGPASSWORD']){
    assert.throws(()=>forbidRemoteDbInCli({[name]:'synthetic-do-not-log'}),/FORBIDDEN_/);
    const p=spawnSync(process.execPath,[source,'--inspect-recorded-e669'],{
      cwd:root,encoding:'utf8',env:{...base,[name]:'synthetic-do-not-log'},timeout:9000
    });
    assert.notEqual(p.status,0);
    assert.equal(p.stdout,'');
  }
  mark('CLI_READONLY_INSPECT_ONLY_REMOTE_SECRETS_DENIED');
});
test('static module has no imports that could connect/write/execute; contract stays negative',()=>{
  const text=readFileSync(source,'utf8');
  assert.doesNotMatch(text,/\b(?:import|require)\s*(?:\(|['"{])/);
  assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|WebSocket|execFileSync|spawnSync|execSync|writeFileSync|createClient|connect|query|eval)\s*\(/);
  assert.doesNotMatch(text,/\b(?:GRANT|REVOKE|INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:ON|INTO|TABLE|FUNCTION|ROLE|POLICY)\b/i);
  const result=assessRecordedStage116(recorded(),Object.create(null));
  assertBlocked(result,'HOLD_R16_SIGNED_PREREQUISITE');
  assert.equal(git('hash-object','supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),
    evidence.original82RpcGitSha);
  mark('NO_EXECUTION_OR_SQL_GENERATOR_NO_HISTORY_MUTATION');
});
