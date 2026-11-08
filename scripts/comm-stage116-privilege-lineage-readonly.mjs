// 03 COMM R16/R17/R18: read-only privilege provenance. NO SQL, network, or grants.
// pg_get_functiondef MD5 hashes are OBSERVED staging catalog fingerprints,
// not approved function bodies or immutable migration SHA equivalence.
export const AUDIT_ID = 'comm.stage116.privilege-lineage.denial@1';
const freeze = list => Object.freeze(list.map(x => Object.freeze(x)));
// [schema, name, identity_args, staged_def_md5, candidate_source_git_blob, risk]
// A candidate Git blob does NOT prove a deployed function has identical body.
export const NINE_SECURITY_DEFINERS = freeze([
 ['private','community_configure_provider_cleanup_scheduler','p_worker_url text, p_schedule text','3fed889dcb475165cce97b73ca61242d','bfefec90c37cdc89e059d20ea9ac769eda81b426','SECRET_BEARING_SCHEDULER_HOLD'],
 ['private','community_invoke_provider_cleanup_worker','','333a25dbeb6def97ffbf70415c5a2c43','5f97e8f2db847f70d0cf50c63ad064b1357fdbd5','PROVIDER_EGRESS_HOLD'],
 ['private','community_refresh_operations_alerts','','96c26fa78b5c4b2e32cac4423e64e0ae','1e2bd1955cc148a1e6e72b7cd7bd745356351aa6','PRIVATE_ADMIN'],
 ['public','community_admin_ack_operations_alert','p_admin_auth_subject uuid, p_session_id uuid, p_issued_at_epoch bigint, p_alert_id uuid, p_note text','e461fd89421631abef2d0edf9ce901a9','1e2bd1955cc148a1e6e72b7cd7bd745356351aa6','ADMIN_SIGNED_RUNTIME_REQUIRED'],
 ['public','community_authorize_identity_bootstrap','p_auth_subject uuid, p_issued_at_epoch bigint','e945748aabd79f4f0bd6a5f4c7e35f08','5162163e266ac6ef89dcab526c22f05c2a1ec02a','SAME_TX_AUTH_REQUIRED'],
 ['public','community_consume_account_delete_e2e_nonce','p_nonce text','31b89a24d279abea15deb87243f17417',null,'FUNCTION_BODY_SOURCE_UNKNOWN'],
 ['public','community_get_operations_alerts','p_admin_auth_subject uuid, p_state text, p_limit integer','d89ac7adcb8cb56e44b8f832803c1873','1e2bd1955cc148a1e6e72b7cd7bd745356351aa6','ADMIN_SIGNED_RUNTIME_REQUIRED'],
 ['public','community_record_account_delete_e2e_result','p_run_id uuid, p_auth_user_id uuid, p_account_id uuid, p_cleanup_job_id uuid, p_wand_delete_ok boolean, p_error_text text','85618b895327bb31cb591ab0cca033b0',null,'FUNCTION_BODY_SOURCE_UNKNOWN'],
 ['public','community_verify_worker_token','p_worker_name text, p_token text','4958e0e5ee58f166e0739d5a50387785','5f97e8f2db847f70d0cf50c63ad064b1357fdbd5','WORKER_TOKEN_HOLD']
]);
// Staging six direct legacy privileged writers have service_role EXECUTE TRUE;
// anon and authenticated are FALSE. They must not be blindly restored in sandbox.
export const SIX_LEGACY_SERVICE_WRITERS = freeze([
 ['community_add_reaction','p_auth_subject uuid, p_target_entity_id uuid, p_reaction_kind text','07ba872ac8044778ee72182b61be4b8d'],
 ['community_save_entity','p_auth_subject uuid, p_target_entity_id uuid','c4f3cc65787359d46de831197ee2d84f'],
 ['community_unsave_entity','p_auth_subject uuid, p_target_entity_id uuid','cef50fa691ae060f2fde5146eec4a4df'],
 ['community_remove_reaction','p_auth_subject uuid, p_target_entity_id uuid, p_reaction_kind text','6a7133f195139108222f30ca902da34f'],
 ['community_unfollow_creator','p_auth_subject uuid, p_creator_profile_id uuid','d64e87dc5a2d50a66cad4d5865a714f7'],
 ['community_follow_creator','p_auth_subject uuid, p_creator_profile_id uuid','0e2433e8857b3a88be696befc0d9f3b5']
]);
export const TWO_TEST_FIXTURE_TABLE_SOURCES = freeze([
 ['private.community_operations_alerts','supabase/migrations/20260930081000_community_core_v0_operations_alerts.sql','1e2bd1955cc148a1e6e72b7cd7bd745356351aa6','HISTORIC_GIT_CANDIDATE_NOT_LEDGER_PROOF'],
 ['private.provider_identity_cleanup_jobs','PR442/supabase/migrations/20260930115500_provider_identity_cleanup_parent_bootstrap_v1.sql','81d253c81f6c956ce7ec8d99c0bdb16ecdba5471','UNMERGED_PROPOSED_MIGRATION_NOT_OLD82']
]);
const K = x => [x.schema,x.function,x.args].join(':');
const deny = (status, details={}) => Object.freeze({
  status, ...details,
  mayGenerateSql:false, mayApplyMigration:false, mayGrantExecute:false,
  mayRevokeExecute:false, mayDeploy:false, mayMerge:false,
  mayEnableWriter:false, mayEnableCommunityPublic:false,
  mayEnableProvider:false, mayEnableCloud:false, original82BootstrapPass:false,
  stageCloneEquivalent:false, signedGoTrueTwoPgPass:false, rollbackProven:false
});
const valid=x=> x && typeof x==='object' && !Array.isArray(x) &&
  ['schema','function','args','function_md5'].every(k=>typeof x[k]==='string') &&
  /^[a-f0-9]{32}$/.test(x.function_md5) &&
  ['security_definer','explicit_search_path','service_exec','anon_exec','authenticated_exec'].every(k=>typeof x[k]==='boolean');
const toMap = rows => {
  if(!Array.isArray(rows) || rows.length>350 || rows.some(x=>!valid(x))) return null;
  const out = new Map();
  for(const x of rows){ const k=K(x);if(out.has(k))return null;out.set(k,x); }
  return out;
};
// Pure offline comparison only. No approval path even when metadata matches.
// Live staging/sandbox evidence must come from independent read-only queries.
export function assessStage116PrivilegeLineage(input){
  const staging=toMap(input?.staging), sandbox=toMap(input?.sandbox);
  if(!staging||!sandbox) return deny('HOLD_INVALID_OR_DUPLICATE_CATALOG');
  const drift=[],missingSandbox=[];
  for(const [schema,name,args,md5] of NINE_SECURITY_DEFINERS){
    const k=[schema,name,args].join(':'),s=staging.get(k),c=sandbox.get(k);
    if(!s || s.function_md5!==md5 || !s.security_definer ||
      !s.explicit_search_path || s.anon_exec || s.authenticated_exec ||
      s.service_exec!==(schema==='public'))drift.push(k);
    if(!c)missingSandbox.push(k);
    else if(!c.security_definer || c.anon_exec || c.authenticated_exec)drift.push('SANDBOX_ROLE:'+k);
  }
  let sandboxLegacyExec=0;
  for(const [name,args,md5] of SIX_LEGACY_SERVICE_WRITERS){
    const k=['public',name,args].join(':'),s=staging.get(k),c=sandbox.get(k);
    if(!s || s.function_md5!==md5 || !s.security_definer ||
       s.anon_exec || s.authenticated_exec || !s.service_exec)drift.push(k);
    if(c?.service_exec)sandboxLegacyExec++;
  }
  if(drift.length)return deny('HOLD_STAGED_FUNCTION_OR_ROLE_DRIFT',{drift:Object.freeze(drift)});
  return deny('HOLD_MISSING_DEFINERS_AND_LEGACY_WRITERS',{
    recordedNineStagingDefiners:9,
    sourceCandidateGitBlobs:NINE_SECURITY_DEFINERS.filter(x=>x[4]).length,
    unknownFunctionBodySource:NINE_SECURITY_DEFINERS.filter(x=>!x[4]).length,
    missingSandboxDefiners:missingSandbox.length,
    stageLegacyServiceExecute:6,
    sandboxLegacyServiceExecute:sandboxLegacyExec,
    secretBearingSchedulerBlocked:true,
    catalogIsNotRuntimeAuthorization:true
  });
}
