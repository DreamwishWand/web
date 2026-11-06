import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE116_RECORDED, SOURCE164_PREREQUISITE, LEGACY_SIX,
  assessRecordedStage116, forbidRemoteDbInCli
} from '../scripts/comm-stage116-safe-forward-gate.mjs';
const observed = () => ({...STAGE116_RECORDED});

test('E669 real observed Stage116 is blocked at missing signed R16, never an apply plan',()=>{
  const r = assessRecordedStage116(observed());
  assert.equal(r.status,'HOLD_R16_SIGNED_PREREQUISITE');
  assert.ok(r.blockers.includes('SOURCE164_SIGNED_R16_PREREQUISITE_ABSENT'));
  assert.ok(r.blockers.includes('LEGACY_SIX_SERVICE_ROLE_EXECUTE_STILL_TRUE'));
  assert.equal(r.signedR16RequiredSignature,SOURCE164_PREREQUISITE);
  assert.equal(r.unsafeOldRpcSignatures.length,6);
  assert.equal(new Set(LEGACY_SIX).size,6);
  for (const key of ['mayGenerateSql','mayApplyMigration','mayDeploy','mayMerge',
    'writerEnabled','communityPublicEnabled','providerEnabled',
    'original82RawBootstrapPass','stageEquivalentClonePass','fullSignedGoTrueTwoPgPass','rollbackProven']) {
    assert.equal(r[key],false,key);
  }
  assert.equal(r.historicalAppliedVersion,'20260930025609');
  assert.equal(r.canonicalOriginalVersion,'20260930025132');
  assert.equal(r.phases.length,4);
});

test('changed Stage statement fingerprint cannot be silently accepted',()=>{
  const r=assessRecordedStage116({...observed(),ledgerManifestSha256:'0'.repeat(64)});
  assert.equal(r.status,'HOLD_REATTEST_STAGE116');
  assert.deepEqual(r.mismatchedFields,['ledgerManifestSha256']);
});

test('changed function catalogue, legacy privileges and source applications all require new evidence',()=>{
  for(const [key,value] of [
    ['functionCatalogueSha256','0'.repeat(64)],
    ['legacyServiceRoleExecutableCount',0],
    ['source164To169Applied',6],
    ['signedR16GalleryRpcExists',true],
    ['rollbackStatements',1],
    ['historicalRpcAppliedVersion','20260930025132'],
    ['fkHardeningApplied',false],
    ['prerequisiteParentMigrationApplied',true],
    ['original82RpcGitSha','0'.repeat(40)],
  ]) {
    const r=assessRecordedStage116({...observed(),[key]:value});
    assert.equal(r.status,'HOLD_REATTEST_STAGE116',key);
    assert.ok(r.mismatchedFields.includes(key));
    assert.equal(r.mayGenerateSql,false);
  }
});

test('partial, missing, extra and malformed asserted evidence fails closed',()=>{
  assert.equal(assessRecordedStage116(null).status,'HOLD_INVALID_INPUT');
  assert.equal(assessRecordedStage116([]).status,'HOLD_INVALID_INPUT');
  assert.equal(assessRecordedStage116({}).status,'HOLD_REATTEST_STAGE116');
  const noEvidence=observed();delete noEvidence.evidenceId;
  assert.ok(assessRecordedStage116(noEvidence).mismatchedFields.includes('evidenceId'));
  assert.ok(assessRecordedStage116({...observed(),stageProductionApproved:true})
    .mismatchedFields.includes('unexpected:stageProductionApproved'));
});

test('caller-provided Owner or deploy claims never authorize production',()=>{
  const r=assessRecordedStage116(observed(),{ownerApproved:true, deployReady:true,
    signedRuntimePass:true,stageEquivalentClone:true});
  assert.equal(r.status,'HOLD_R16_SIGNED_PREREQUISITE');
  assert.ok(r.blockers.includes('CALLER_APPROVAL_FLAGS_NOT_EVIDENCE'));
  assert.equal(r.mayDeploy,false);
  assert.equal(r.fullSignedGoTrueTwoPgPass,false);
});

test('CLI disallows remote/credential-bearing environments',()=>{
  assert.doesNotThrow(()=>forbidRemoteDbInCli({}));
  for(const key of ['DATABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD',
    'SUPABASE_PROJECT_ID','PGHOST','PGSERVICE','PGPASSWORD']) {
    assert.throws(()=>forbidRemoteDbInCli({[key]:'synthetic-secret'}),
      /REMOTE_OR_SECRET_ENV_FORBIDDEN/);
  }
});
