import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  AUDIT_ID,NINE_SECURITY_DEFINERS,SIX_LEGACY_SERVICE_WRITERS,
  TWO_TEST_FIXTURE_TABLE_SOURCES,assessStage116PrivilegeLineage
} from '../scripts/comm-stage116-privilege-lineage-readonly.mjs';
const node = (schema,name,args,md5,service_exec,security_definer=true)=>({
  schema,function:name,args,function_md5:md5,
  security_definer,explicit_search_path:true,
  service_exec,anon_exec:false,authenticated_exec:false
});
const snapshot=()=>{
  const defs=NINE_SECURITY_DEFINERS.map(([s,n,a,h])=>node(s,n,a,h,s==='public'));
  const old=SIX_LEGACY_SERVICE_WRITERS.map(([n,a,h])=>node('public',n,a,h,true));
  return {
    staging:[...defs,...old],
    sandbox:old.slice(0,3).map(x=>({...x}))
  };
};
const blocked=r=>{
  for(const f of ['mayGenerateSql','mayApplyMigration','mayGrantExecute','mayRevokeExecute',
    'mayDeploy','mayMerge','mayEnableWriter','mayEnableCommunityPublic',
    'mayEnableProvider','mayEnableCloud','original82BootstrapPass',
    'stageCloneEquivalent','signedGoTrueTwoPgPass','rollbackProven']){
    assert.equal(r[f],false,f);
  }
  assert.equal(Object.isFrozen(r),true);
};

test('R17: catalog scope pins nine exact staged definer signatures but never a PASS gate',()=>{
  assert.equal(AUDIT_ID,'comm.stage116.privilege-lineage.denial@1');
  const x=snapshot(), r=assessStage116PrivilegeLineage(x);
  assert.equal(r.status,'HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS');
  assert.equal(r.recordedNineStagingDefiners,9);
  assert.equal(r.sourceCandidateGitBlobs,7);
  assert.equal(r.unknownFunctionBodySource,2);
  assert.equal(r.missingSandboxDefiners,9);
  assert.equal(r.stageLegacyServiceExecute,6);
  assert.equal(r.sandboxLegacyServiceExecute,3);
  assert.equal(r.secretBearingSchedulerBlocked,true);
  blocked(r);
});
test('R17: two unproven deletion-E2E function bodies cannot be called verified by generated types',()=>{
  assert.deepEqual(
    NINE_SECURITY_DEFINERS.filter(x=>x[4]===null).map(x=>x[1]),
    ['community_consume_account_delete_e2e_nonce','community_record_account_delete_e2e_result']
  );
  assert.equal(TWO_TEST_FIXTURE_TABLE_SOURCES.length,2);
  assert.equal(TWO_TEST_FIXTURE_TABLE_SOURCES[0][0],'private.community_operations_alerts');
  assert.equal(TWO_TEST_FIXTURE_TABLE_SOURCES[1][0],'private.provider_identity_cleanup_jobs');
  assert.match(TWO_TEST_FIXTURE_TABLE_SOURCES[1][3],/UNMERGED/);
  blocked(assessStage116PrivilegeLineage(snapshot()));
});
test('R17: changed SQL body hash, signature, absent search_path or legacy role is not parity',()=>{
  for(const mutate of [
    x=>{x.staging[0].function_md5='0'.repeat(32);},
    x=>{x.staging[0].args='p_worker_url text';},
    x=>{x.staging[0].explicit_search_path=false;},
    x=>{x.staging[0].security_definer=false;},
    x=>{x.staging[9].service_exec=false;},
    x=>{x.staging[9].explicit_search_path=false;},
    x=>{x.staging[9].function_md5='1'.repeat(32);}
  ]){
    const s=snapshot();mutate(s);
    const r=assessStage116PrivilegeLineage(s);
    assert.equal(r.status,'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT');
    blocked(r);
  }
});
test('R17: anon/authenticated grants on SECURITY DEFINER or a legacy Writer are forbidden',()=>{
  for(const mutate of [
    x=>{x.staging[3].anon_exec=true;},
    x=>{x.staging[4].authenticated_exec=true;},
    x=>{x.staging[10].anon_exec=true;},
    x=>{x.sandbox.push({...x.staging[3],anon_exec:true});}
  ]){
    const s=snapshot();mutate(s);
    const r=assessStage116PrivilegeLineage(s);
    assert.equal(r.status,'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT');
    blocked(r);
  }
});
test('R17: same-signature sandbox nine definer hash, search_path or EXECUTE drift classified',()=>{
  for(const index of [0,3,8]) {
    for(const change of [
      x=>{x.function_md5='0'.repeat(32);},
      x=>{x.explicit_search_path=false;},
      x=>{x.service_exec=!x.service_exec;}
    ]) {
      const s=snapshot();
      s.sandbox=s.staging.map(x=>({...x}));
      change(s.sandbox[index]);
      const r=assessStage116PrivilegeLineage(s);
      assert.equal(r.status,'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT',
        'same signature sandbox metadata drift: index '+index);
      assert.ok(r.drift.some(x=>x.startsWith('SANDBOX_ROLE:')));
      blocked(r);
    }
  }
});
test('R17: missing, malformed, duplicate and hostile catalog rows fail closed',()=>{
  for(const bad of [
    null,{}, {staging:[],sandbox:null},
    {staging:[{}],sandbox:[]},
    {staging:[...snapshot().staging,snapshot().staging[0]],sandbox:[]},
    {staging:snapshot().staging,sandbox:[...snapshot().sandbox,snapshot().sandbox[1]]}
  ]){
    const r=assessStage116PrivilegeLineage(bad);
    assert.equal(r.status,'HOLD_INVALID_OR_DUPLICATE_CATALOG');
    blocked(r);
  }
});
test('R17: even imaginary complete sandbox cannot authorize migration, grant, Writer or Provider',()=>{
  const s=snapshot();
  s.sandbox=[...s.staging.map(x=>({...x}))];
  const r=assessStage116PrivilegeLineage(s);
  assert.equal(r.status,'HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS');
  assert.equal(r.missingSandboxDefiners,0);
  blocked(r);
});
test('R17: source is a pure importable catalog gate, no DB/SQL/DNS or secret source body',()=>{
  const raw=readFileSync(new URL('../scripts/comm-stage116-privilege-lineage-readonly.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(raw,/from\s+['"](?:pg|postgres|@supabase\/supabase-js)['"]/);
  assert.doesNotMatch(raw,/\bfetch\s*\(|createClient\s*\(|execute_sql\s*\(/);
  assert.doesNotMatch(raw,/\bBEGIN\b|\bCOMMIT\b|\bALTER\s+TABLE\b|\bGRANT\s+EXECUTE\b|\bCREATE\s+FUNCTION\b/i);
  assert.equal(NINE_SECURITY_DEFINERS.length,9);
  assert.equal(SIX_LEGACY_SERVICE_WRITERS.length,6);
  assert.equal(Object.isFrozen(NINE_SECURITY_DEFINERS[0]),true);
});
