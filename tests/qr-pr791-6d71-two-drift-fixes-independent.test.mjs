// 04 QR-S: NEW_ONLY PR791 fixed 6d71 comparator regression.
// Independently re-check *only* the two previously red classification branches.
// Earlier PR793's six unaffected tests, QA693 and QA779 are NOT rerun.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {
  NINE_SECURITY_DEFINERS,
  SIX_LEGACY_SERVICE_WRITERS,
  assessStage116PrivilegeLineage
} from '../scripts/comm-stage116-privilege-lineage-readonly.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const OLD='c803854604fa1ec1174b7508413dafeeb2ec98ee';
const FIXED='6d71caf0f8013a32a3fae6952e1123bf818d8576';
const MAIN='1024d4207245ed99126abedcf3452ef670a44c6a';
const SCRIPT_SHA='355a9baaa2e3bc5333ad0d331dd63e8d8f3ca9a9';
const TEST_SHA='11fcb36ed6ff5f3de4511bc59930c364be3dbaec';
const DOC_SHA='4e9574793c74d85cb24ebee5f276889041354d2c';
const RAW82_SHA='bbf9bc830440d964c5da8b3c3cac7e926d281881';
const expectedFlags=[
  'mayGenerateSql','mayApplyMigration','mayGrantExecute',
  'mayRevokeExecute','mayDeploy','mayMerge','mayEnableWriter',
  'mayEnableCommunityPublic','mayEnableProvider','mayEnableCloud',
  'original82BootstrapPass','stageCloneEquivalent',
  'signedGoTrueTwoPgPass','rollbackProven'
];
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const mark=s=>console.log('QR791FIX_'+s+'_PASS');
const pin=()=>{
  assert.equal(git('rev-parse',FIXED),FIXED);
  assert.deepEqual(git('diff','--name-only',OLD,FIXED).trim().split('\n').sort(),[
    'scripts/comm-stage116-privilege-lineage-readonly.mjs',
    'tests/comm-stage116-privilege-lineage-readonly.test.mjs'
  ]);
  assert.equal(git('hash-object','scripts/comm-stage116-privilege-lineage-readonly.mjs'),SCRIPT_SHA);
  assert.equal(git('hash-object','tests/comm-stage116-privilege-lineage-readonly.test.mjs'),TEST_SHA);
  assert.equal(git('hash-object','docs/community/stage116-nine-definer-six-legacy-grants-hold-20261108.md'),DOC_SHA);
  assert.equal(git('hash-object','supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),RAW82_SHA);
  assert.deepEqual(git('diff','--name-only',MAIN,FIXED).trim().split('\n').sort(),[
    'docs/community/stage116-nine-definer-six-legacy-grants-hold-20261108.md',
    'scripts/comm-stage116-privilege-lineage-readonly.mjs',
    'tests/comm-stage116-privilege-lineage-readonly.test.mjs'
  ]);
  assert.equal(git('diff','--name-only',OLD,FIXED,'src','supabase','docs'),'');
};
const row=(schema,name,args,md5,service_exec)=>({
  schema,function:name,args,function_md5:md5,security_definer:true,
  explicit_search_path:true,service_exec,anon_exec:false,authenticated_exec:false
});
const fixture=()=>{
  const defs=NINE_SECURITY_DEFINERS.map(([s,n,a,h])=>row(s,n,a,h,s==='public'));
  const writers=SIX_LEGACY_SERVICE_WRITERS.map(([n,a,h])=>row('public',n,a,h,true));
  return {staging:[...defs,...writers],sandbox:writers.slice(0,3).map(x=>({...x}))};
};
function assertNoAuthority(r,status){
  assert.ok(Object.isFrozen(r),'all verdicts must be frozen');
  assert.equal(r.status,status);
  for(const f of expectedFlags)assert.equal(r[f],false,'gate '+f+' must stay false');
  return r;
}
test('fixed two MOD blobs only; original3, 82 historical migrations and release flags unchanged',()=>{
  pin();
  const src=readFileSync(join(root,'scripts/comm-stage116-privilege-lineage-readonly.mjs'),'utf8');
  const own=readFileSync(join(root,'tests/comm-stage116-privilege-lineage-readonly.test.mjs'),'utf8');
  assert.match(src,/c\.function_md5!==md5/);
  assert.match(src,/!c\.explicit_search_path/);
  assert.match(src,/!s\.explicit_search_path \|\| s\.anon_exec/);
  assert.match(own,/same-signature sandbox nine definer hash, search_path or EXECUTE drift classified/);
  assert.doesNotMatch(src,/^\s*import\s+/m);
  assert.doesNotMatch(src,/\b(?:fetch|createClient|spawnSync|execSync|writeFileSync|execute_sql)\s*\(/);
  assert.doesNotMatch(src,/(?:https?:\/\/[^\s'"]+|postgres(?:ql)?:\/\/[^\s'"]+|sb_secret_|SUPABASE_ACCESS_TOKEN|pg_get_functiondef\s*\()/i);
  mark('FIXED_TWO_MOD_BLOBS_NO_SECRET_DB_OR_MIGRATION');
});

test('regression RED-A: every one of six legacy Staging writers without explicit search_path reports named DRIFT',()=>{
  for(let k=0;k<SIX_LEGACY_SERVICE_WRITERS.length;k++){
    const snap=fixture();
    const target=snap.staging[NINE_SECURITY_DEFINERS.length+k];
    const key='public:'+target.function+':'+target.args;
    target.explicit_search_path=false;
    const result=assertNoAuthority(assessStage116PrivilegeLineage(snap),
      'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT');
    assert.ok(result.drift.includes(key),'legacy Writer search_path mutation not named: '+key);
    assert.equal(Object.isFrozen(result.drift),true);
  }
  mark('SIX_STAGED_LEGACY_SEARCHPATH_MUTATIONS_NAMED_DRIFT');
});

test('regression RED-B: all nine same-signature Sandbox definers MD5, search_path, service EXECUTE forgery reports named DRIFT',()=>{
  let cases=0;
  for(let i=0;i<NINE_SECURITY_DEFINERS.length;i++){
    for(const mutate of [
      x=>{x.function_md5='0'.repeat(32);},
      x=>{x.explicit_search_path=false;},
      x=>{x.service_exec=!x.service_exec;}
    ]){
      const snap=fixture();
      snap.sandbox=snap.staging.map(x=>({...x}));
      const target=snap.sandbox[i];
      const key='SANDBOX_ROLE:'+target.schema+':'+target.function+':'+target.args;
      mutate(target);
      const result=assertNoAuthority(assessStage116PrivilegeLineage(snap),
        'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT');
      assert.ok(result.drift.includes(key),'sandbox drift not named for '+key);
      assert.equal(Object.isFrozen(result.drift),true);
      cases++;
    }
  }
  assert.equal(cases,27);
  mark('NINE_SANDBOX_DEFINERS_27_FINGERPRINT_PATH_GRANT_DRIFTS_NAMED');
});

test('genuine inventory HOLD, fake full Stage116 + forged approval still HOLD and all 14 permissions OFF',()=>{
  const real=assertNoAuthority(assessStage116PrivilegeLineage(fixture()),
    'HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS');
  assert.equal(real.missingSandboxDefiners,9);
  assert.equal(real.stageLegacyServiceExecute,6);
  assert.equal(real.sandboxLegacyServiceExecute,3);
  assert.equal(real.sourceCandidateGitBlobs,7);
  assert.equal(real.unknownFunctionBodySource,2);

  const fake=fixture();
  fake.sandbox=fake.staging.map(x=>({...x}));
  Object.assign(fake,{ownerApproved:true,stageCloneEquivalent:true,
    signedGoTrueTwoPgPass:true,rollbackProven:true,mayApplyMigration:true});
  const verdict=assertNoAuthority(assessStage116PrivilegeLineage(fake),
    'HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS');
  assert.equal(verdict.missingSandboxDefiners,0);
  assert.equal(verdict.unknownFunctionBodySource,2);
  mark('AUTHENTIC_AND_FABRICATED_COMPLETE_STAGE116_ALWAYS_HOLD_ALL14_OFF');
});
