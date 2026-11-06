// 03 COMM W-COMM-006 / R16-R17: read-only Stage116 evidence gate.
// This module NEVER produces executable SQL, accesses a database, or authorizes deployment.
// Recorded E669 is a bounded observation, not signed provenance or a clone.
export const SOURCE164_PREREQUISITE =
  'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)';
export const ORIGINAL82_RPC_GIT_SHA = 'bbf9bc830440d964c5da8b3c3cac7e926d281881';
export const DERIVED169_PR676_SOURCE_HEAD = 'afeaf2955eb5515624d9ab27b8743e59e5a0145c';
export const STAGE116_RECORDED = Object.freeze({
  evidenceId: 'E-09P-SQL-R17-STAGING116-LEDGER-SHA256-20261106',
  appliedCount: 116, distinctVersions: 116, distinctNames: 112,
  duplicateNameGroups: 4, populatedStatements: 116, rollbackStatements: 0,
  ledgerManifestSha256: '889bfd7dfa7e2ee9bba65a92f6f1f8675bf98ad165d870df1781b842f03c4861',
  functionCatalogueSha256: 'c3c1d224139a633a601f516d815e77a1567a60bd241a42ad3be630ffd01fa6ac',
  historicalRpcAppliedVersion: '20260930025609',
  canonicalRpcVersion: '20260930025132',
  fkHardeningApplied: true,
  prerequisiteParentMigrationApplied: false,
  prerequisiteParentTableExists: true,
  source164To169Applied: 0,
  signedR16GalleryRpcExists: false,
  workspaceSignedPrivilegesObserved: true,
  legacyServiceRoleExecutableCount: 6,
  legacyAnonExecutableCount: 0,
  legacyAuthenticatedExecutableCount: 0,
  original82RpcGitSha: ORIGINAL82_RPC_GIT_SHA
});

const IDENTITY_FIELDS = Object.freeze([
  'evidenceId', 'appliedCount', 'distinctVersions', 'distinctNames',
  'duplicateNameGroups', 'populatedStatements', 'rollbackStatements',
  'ledgerManifestSha256', 'functionCatalogueSha256',
  'historicalRpcAppliedVersion', 'canonicalRpcVersion',
  'fkHardeningApplied', 'prerequisiteParentMigrationApplied',
  'prerequisiteParentTableExists', 'source164To169Applied',
  'signedR16GalleryRpcExists', 'workspaceSignedPrivilegesObserved',
  'legacyServiceRoleExecutableCount', 'legacyAnonExecutableCount',
  'legacyAuthenticatedExecutableCount', 'original82RpcGitSha'
]);
export const LEGACY_SIX = Object.freeze([
  'public.community_add_reaction(uuid,uuid,text)',
  'public.community_save_entity(uuid,uuid)',
  'public.community_unsave_entity(uuid,uuid)',
  'public.community_remove_reaction(uuid,uuid,text)',
  'public.community_unfollow_creator(uuid,uuid)',
  'public.community_follow_creator(uuid,uuid)'
]);
export const SAFE_FORWARD_PHASES = Object.freeze([
  'A: 09P-SQL reconcile all applied116 exact version/name/stored-SQL SHA against canonical and deployed lineage; independently verify stage schema/ACL fingerprint; do not repair ledger',
  'B: on separately attested stage-equivalent disposable clone, construct and independently verify R16 signed prerequisites WITHOUT legacy grants, privilege escalation, or mutation of existing applied versions',
  'C: only after prerequisite provenance, prototype ordered six legacy EXECUTE revocations and independent full genuine GoTrue ES256 two-PG, indirect SECURITY DEFINER and replay/rollback negatives',
  'D: after distinct authorized operator snapshot/PITR rehearsal and 09 INT accepted-main cumulative CI, consider separately approved forward-only deploy; fail closed otherwise'
]);

function isPlainRecord(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x) &&
    (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
}
export function assessRecordedStage116(observation, options = {}) {
  if (!isPlainRecord(observation) || !isPlainRecord(options)) {
    return Object.freeze({ status:'HOLD_INVALID_INPUT', mismatchedFields:['observation'],
      mayGenerateSql:false, mayDeploy:false, mayMerge:false, writerEnabled:false });
  }
  const mismatchedFields = IDENTITY_FIELDS.filter(key =>
    !Object.hasOwn(observation,key) || observation[key] !== STAGE116_RECORDED[key]);
  // Explicit anti-promotion. A stale E669 manifest can only establish the previous
  // observed blocker. User-asserted future stage changes require a new independent audit.
  const unexpectedFields = Object.keys(observation).filter(k=>!IDENTITY_FIELDS.includes(k));
  const blockerCodes = mismatchedFields.length || unexpectedFields.length
    ? ['STAGE116_OBSERVATION_CHANGED_REATTEST_REQUIRED']
    : [
      'SOURCE164_SIGNED_R16_PREREQUISITE_ABSENT',
      'LEGACY_SIX_SERVICE_ROLE_EXECUTE_STILL_TRUE',
      'HISTORICAL_VERSION_AND_APPLIED_LEDGER_DIVERGENCE',
      'MANAGED_ROLLBACK_AND_CLONE_ATTESTATION_NOT_RUN',
      'RAW_ORIGINAL82_SQLSTATE42601_TRUE_RED'
    ];
  // Never allow caller-provided positive flags to turn a historical observation into
  // operational authorization. Even an exact recorded match stays on HOLD.
  if (Object.keys(options).length) blockerCodes.push('CALLER_APPROVAL_FLAGS_NOT_EVIDENCE');
  const status = mismatchedFields.length || unexpectedFields.length
    ? 'HOLD_REATTEST_STAGE116'
    : 'HOLD_R16_SIGNED_PREREQUISITE';
  return Object.freeze({
    status,
    operation:'STAGE116_EXISTING_APPLIED_LEGACY_WRITER_CONTAINMENT',
    evidenceLevel:'MANAGED_READ_ONLY_METADATA_REUSE_E669_NOT_CLONE_OR_SIGNED',
    sourceHead:DERIVED169_PR676_SOURCE_HEAD,
    evidenceId:STAGE116_RECORDED.evidenceId,
    mismatchedFields:Object.freeze([...mismatchedFields,...unexpectedFields.map(s=>'unexpected:'+s)]),
    blockers:Object.freeze(blockerCodes),
    historicalAppliedVersion:STAGE116_RECORDED.historicalRpcAppliedVersion,
    canonicalOriginalVersion:STAGE116_RECORDED.canonicalRpcVersion,
    signedR16RequiredSignature:SOURCE164_PREREQUISITE,
    unsafeOldRpcSignatures:LEGACY_SIX,
    phases:SAFE_FORWARD_PHASES,
    original82RawBootstrapPass:false,
    stageEquivalentClonePass:false,
    fullSignedGoTrueTwoPgPass:false,
    rollbackProven:false,
    mayGenerateSql:false,
    mayApplyMigration:false,
    mayDeploy:false,
    mayMerge:false,
    writerEnabled:false,
    communityPublicEnabled:false,
    providerEnabled:false
  });
}

export function forbidRemoteDbInCli(env = process.env) {
  const banned = ['DATABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD',
    'SUPABASE_PROJECT_ID','PGHOST','PGSERVICE','PGPASSWORD'];
  for (const name of banned) if (env[name]) {
    throw new Error('STAGE116_GATE_CLI_REMOTE_OR_SECRET_ENV_FORBIDDEN_'+name);
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--inspect-recorded-e669') {
    throw new Error('STAGE116_GATE_NO_EXECUTABLE_OR_REMOTE_ACTIONS');
  }
  forbidRemoteDbInCli();
  process.stdout.write(JSON.stringify(assessRecordedStage116(STAGE116_RECORDED))+'\n');
}
