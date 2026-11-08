// 04 QR-S / PR791 independent NEW_ONLY Stage116 privilege-lineage metadata QA.
// Source metadata is *observational only*; test never accesses DB or secret bodies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  NINE_SECURITY_DEFINERS,SIX_LEGACY_SERVICE_WRITERS,
  TWO_TEST_FIXTURE_TABLE_SOURCES,assessStage116PrivilegeLineage,AUDIT_ID
} from '../scripts/comm-stage116-privilege-lineage-readonly.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const source='c803854604fa1ec1174b7508413dafeeb2ec98ee';
const parent='1024d4207245ed99126abedcf3452ef670a44c6a';
const SHA82='bbf9bc830440d964c5da8b3c3cac7e926d281881';
const expectedAdd=[
  'docs/community/stage116-nine-definer-six-legacy-grants-hold-20261108.md',
  'scripts/comm-stage116-privilege-lineage-readonly.mjs',
  'tests/comm-stage116-privilege-lineage-readonly.test.mjs'
];
const expectedNine=[
  ['private','community_configure_provider_cleanup_scheduler','p_worker_url text, p_schedule text','3fed889dcb475165cce97b73ca61242d',false],
  ['private','community_invoke_provider_cleanup_worker','','333a25dbeb6def97ffbf70415c5a2c43',false],
  ['private','community_refresh_operations_alerts','','96c26fa78b5c4b2e32cac4423e64e0ae',false],
  ['public','community_admin_ack_operations_alert','p_admin_auth_subject uuid, p_session_id uuid, p_issued_at_epoch bigint, p_alert_id uuid, p_note text','e461fd89421631abef2d0edf9ce901a9',true],
  ['public','community_authorize_identity_bootstrap','p_auth_subject uuid, p_issued_at_epoch bigint','e945748aabd79f4f0bd6a5f4c7e35f08',true],
  ['public','community_consume_account_delete_e2e_nonce','p_nonce text','31b89a24d279abea15deb87243f17417',true],
  ['public','community_get_operations_alerts','p_admin_auth_subject uuid, p_state text, p_limit integer','d89ac7adcb8cb56e44b8f832803c1873',true],
  ['public','community_record_account_delete_e2e_result','p_run_id uuid, p_auth_user_id uuid, p_account_id uuid, p_cleanup_job_id uuid, p_wand_delete_ok boolean, p_error_text text','85618b895327bb31cb591ab0cca033b0',true],
  ['public','community_verify_worker_token','p_worker_name text, p_token text','4958e0e5ee58f166e0739d5a50387785',true]
];
const expectedSix=[
  ['community_add_reaction','p_auth_subject uuid, p_target_entity_id uuid, p_reaction_kind text','07ba872ac8044778ee72182b61be4b8d'],
  ['community_save_entity','p_auth_subject uuid, p_target_entity_id uuid','c4f3cc65787359d46de831197ee2d84f'],
  ['community_unsave_entity','p_auth_subject uuid, p_target_entity_id uuid','cef50fa691ae060f2fde5146eec4a4df'],
  ['community_remove_reaction','p_auth_subject uuid, p_target_entity_id uuid, p_reaction_kind text','6a7133f195139108222f30ca902da34f'],
  ['community_unfollow_creator','p_auth_subject uuid, p_creator_profile_id uuid','d64e87dc5a2d50a66cad4d5865a714f7'],
  ['community_follow_creator','p_auth_subject uuid, p_creator_profile_id uuid','0e2433e8857b3a88be696befc0d9f3b5']
];
const DENIAL=['mayGenerateSql','mayApplyMigration','mayGrantExecute',
  'mayRevokeExecute','mayDeploy','mayMerge','mayEnableWriter',
  'mayEnableCommunityPublic','mayEnableProvider','mayEnableCloud',
  'original82BootstrapPass','stageCloneEquivalent',
  'signedGoTrueTwoPgPass','rollbackProven'];
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const mark=x=>console.log('QR791_'+x+'_PASS');
const verifyDenial=r=>{
  assert.ok(Object.isFrozen(r),'deny verdict must be frozen');
  for(const name of DENIAL)assert.equal(r[name],false,name+' must remain OFF');
  assert.match(r.status,/^HOLD_/);
  return r;
};
const fn=(schema,name,args,md5,service)=>({
  schema,function:name,args,function_md5:md5,
  security_definer:true,explicit_search_path:true,
  service_exec:service,anon_exec:false,authenticated_exec:false
});
function makeCatalog(mode='original'){
 const nine=expectedNine.map(([s,n,a,m,se])=>fn(s,n,a,m,se));
 const six=expectedSix.map(([n,a,m])=>fn('public',n,a,m,true));
 return {staging:[...nine,...six],
   sandbox:mode==='full'?[...nine,...six].map(x=>({...x})):
           six.slice(0,3).map(x=>({...x}))};
}

test('exact three source additions, original82 immutable and all Source blob pins',()=>{
 assert.equal(git('rev-parse',source),source);
 assert.deepEqual(git('diff','--name-only',parent,source).split('\n').sort(),expectedAdd);
 assert.equal(git('hash-object',expectedAdd[0]),'4e9574793c74d85cb24ebee5f276889041354d2c');
 assert.equal(git('hash-object',expectedAdd[1]),'d0759c4d8e650e2b6a63cbb5ca5da44d5eb4530a');
 assert.equal(git('hash-object',expectedAdd[2]),'8caa0261784af121259724f741e55816136cacb7');
 assert.equal(git('hash-object','supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),SHA82);
 assert.equal(git('diff','--name-only',parent,source,'supabase','src'), '');
 assert.equal(AUDIT_ID,'comm.stage116.privilege-lineage.denial@1');
 mark('SOURCE_THREE_BLOBS_IMMUTABLE82_AND_NO_PRODUCTION_CHANGES');
});

test('independently pin all nine catalog identities, 6 privileged legacy RPCs and 2 unknown DDLs',()=>{
 assert.deepEqual(NINE_SECURITY_DEFINERS.map(([s,n,a,m,,])=>[s,n,a,m]),
   expectedNine.map(x=>x.slice(0,4)));
 assert.deepEqual(SIX_LEGACY_SERVICE_WRITERS.map(([n,a,m])=>[n,a,m]),expectedSix);
 assert.equal(new Set(expectedNine.map(x=>x[0]+'.'+x[1]+'('+x[2]+')')).size,9);
 assert.equal(new Set(expectedSix.map(x=>x[0]+'('+x[1]+')')).size,6);
 assert.deepEqual(NINE_SECURITY_DEFINERS.filter(x=>x[4]===null).map(x=>x[1]),
   ['community_consume_account_delete_e2e_nonce','community_record_account_delete_e2e_result']);
 assert.equal(NINE_SECURITY_DEFINERS.filter(x=>typeof x[4]==='string').length,7);
 assert.equal(TWO_TEST_FIXTURE_TABLE_SOURCES.length,2);
 assert.match(TWO_TEST_FIXTURE_TABLE_SOURCES[1][1],/^PR442\//);
 assert.match(TWO_TEST_FIXTURE_TABLE_SOURCES[1][3],/UNMERGED_PROPOSED/);
 for(const x of [...NINE_SECURITY_DEFINERS,...SIX_LEGACY_SERVICE_WRITERS,
    ...TWO_TEST_FIXTURE_TABLE_SOURCES])assert.ok(Object.isFrozen(x));
 mark('NINE_SIGNATURE_MD5_SIX_PRIVILEGED_TWO_SOURCE_UNKNOWN_PINNED');
});

test('independent staged 9+6 and existing sandbox 0+3 metadata yields permanent HOLD only',()=>{
 const r=verifyDenial(assessStage116PrivilegeLineage(makeCatalog()));
 assert.equal(r.status,'HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS');
 assert.equal(r.recordedNineStagingDefiners,9);
 assert.equal(r.sourceCandidateGitBlobs,7);
 assert.equal(r.unknownFunctionBodySource,2);
 assert.equal(r.missingSandboxDefiners,9);
 assert.equal(r.stageLegacyServiceExecute,6);
 assert.equal(r.sandboxLegacyServiceExecute,3);
 assert.equal(r.secretBearingSchedulerBlocked,true);
 assert.equal(r.catalogIsNotRuntimeAuthorization,true);
 mark('STAGE9_SIX_SANDBOX0_THREE_HOLD_NO_PARITY');
});

test('every one of staged nine and legacy six: signature, MD5, role and search_path falsification detected',()=>{
 for(let i=0;i<15;i++){
  for(const change of [
    x=>{x.function_md5='0'.repeat(32);},
    x=>{x.function='forged_'+x.function;},
    x=>{x.args=x.args+' extra_arg text';},
    x=>{x.schema=x.schema==='public'?'private':'public';},
    x=>{x.explicit_search_path=false;},
    x=>{x.security_definer=false;},
    x=>{x.anon_exec=true;},
    x=>{x.authenticated_exec=true;},
    x=>{x.service_exec=!x.service_exec;}
  ]){
   const s=makeCatalog();change(s.staging[i]);
   const r=verifyDenial(assessStage116PrivilegeLineage(s));
   assert.equal(r.status,'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT',
     'staging metadata tamper must be declared drift '+i);
  }
 }
 mark('ALL_FIFTEEN_STAGED_CATALOG_MD5_IDENTITY_ROLE_SEARCHPATH_TAMPERS_DETECTED');
});

test('malformed, overload, duplicate and hostile metadata never promote Stage parity',()=>{
 for(const bad of [
   null,{},[],true,{staging:null,sandbox:[]},{staging:[],sandbox:[{}]},
   {staging:[{}],sandbox:[]},
   {staging:Array.from({length:351},()=>({})),sandbox:[]}
 ]){
   const r=verifyDenial(assessStage116PrivilegeLineage(bad));
   assert.equal(r.status,'HOLD_INVALID_OR_DUPLICATE_CATALOG');
 }
 for(const mut of [
   s=>s.staging.push({...s.staging[0]}),
   s=>s.sandbox.push({...s.sandbox[0]}),
   s=>s.staging[0].function_md5='g'.repeat(32),
   s=>s.staging[0].security_definer='true'
 ]){
   const s=makeCatalog();mut(s);
   const r=verifyDenial(assessStage116PrivilegeLineage(s));
   assert.equal(r.status,'HOLD_INVALID_OR_DUPLICATE_CATALOG');
 }
 const overloaded=makeCatalog();
 overloaded.staging.push({...overloaded.staging[0],args:'p_worker_url text'});
 const z=verifyDenial(assessStage116PrivilegeLineage(overloaded));
 assert.equal(z.status,'HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS',
   'extra overload cannot become an accepted matching identity');
 assert.equal(z.stageCloneEquivalent,false);
 mark('HOSTILE_MALFORMED_DUPLICATE_OVERLOADED_ROWS_NO_PARITY');
});

test('forged completed sandbox: wrong MD5, missing search_path, or EXECUTE drift MUST be recorded',()=>{
 // A security provenance inventory must not silently count a same-identity
 // sandbox definer as satisfactory when its deployed body hash or search_path
 // differs from the Staging observation. Approval is always denied, AND the
 // distinct metadata drift must be visible to the owner.
 for(const mutate of [
   x=>{x.function_md5='0'.repeat(32);},
   x=>{x.explicit_search_path=false;},
   x=>{x.service_exec=!x.service_exec;}
 ]){
  const s=makeCatalog('full');mutate(s.sandbox[0]);
  const r=verifyDenial(assessStage116PrivilegeLineage(s));
  assert.equal(r.status,'HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT',
     'forged sandbox body/search_path/privilege must be flagged, not counted as matching');
 }
 mark('SANDBOX_SAME_ID_FORGED_HASH_SEARCHPATH_PRIVILEGE_DRIFT_REPORTED');
});

test('even perfect-looking 9+6 sandbox and fabricated approval never become PASS',()=>{
 const s=makeCatalog('full');
 s.stage116Parity=true;s.signedGoTrueTwoPgPass=true;
 s.ownerApproved=true;s.rollbackProven=true;s.stageLedgerComplete=true;
 const r=verifyDenial(assessStage116PrivilegeLineage(s));
 assert.equal(r.missingSandboxDefiners,0);
 assert.equal(r.original82BootstrapPass,false);
 assert.equal(r.stageCloneEquivalent,false);
 for(const x of ['mayGenerateSql','mayGrantExecute','mayRevokeExecute',
    'mayEnableWriter','mayEnableCommunityPublic'])assert.equal(r[x],false);
 mark('FAKE_FULL_SANDBOX_AND_OWNER_FLAGS_NEVER_AUTHORIZE');
});

test('new three source files: no secrets/URLs/DDL bodies/network/execution may appear in logs',()=>{
 const sources=expectedAdd.map(p=>readFileSync(join(root,p),'utf8'));
 for(const content of sources){
  assert.doesNotMatch(content,/https?:\/\/[A-Za-z0-9.-]+/);
  assert.doesNotMatch(content,/eyJ[A-Za-z0-9_-]{40,}\./);
  assert.doesNotMatch(content,/(?:sb_secret_|service_role_key\s*[:=]|sk_test_|postgresql:\/\/[^\s]+)/i);
 }
 const script=sources[1];
 assert.doesNotMatch(script,/^\s*import\s+/m);
 assert.doesNotMatch(script,/\b(?:fetch|createClient|execute_sql|writeFileSync|execSync|spawnSync|eval)\s*\(/);
 assert.doesNotMatch(script,/\b(?:process\.env|Deno\.env|getServerKey|CRON_SCHEDULE)\b/);
 assert.doesNotMatch(script,/\b(?:GRANT|REVOKE|ALTER|CREATE)\s+(?:ON|FUNCTION|ROLE|TABLE|POLICY)\b/i);
 // Only server-side MD5 catalog fingerprints, never a Staging function body.
 assert.ok(!NINE_SECURITY_DEFINERS.some(x=>x[4]===null && typeof x[4]!=='object'));
 assert.equal(git('diff','--name-only',parent,source,'supabase','src'),'');
 mark('NO_SECRET_URL_JWT_FUNCTION_BODY_SQL_DB_OR_PROD_RUNTIME');
});
