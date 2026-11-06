// 03 COMM W-COMM-006: isolate a DERIVED scratch SQL baseline, not source history.
// No managed DB, deployment, linked Supabase, migration repair, or Writer authorization.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const HISTORICAL_FILE = '20260930025132_community_core_v0_server_rpc.sql';
export const CANONICAL_BLOB = 'bbf9bc830440d964c5da8b3c3cac7e926d281881';
export const DERIVED_BLOB = 'd7991c2c20b7ace6613d6a9cd6493b8c3af0f6ba';
export const BARE_TERMINATOR_LINES = Object.freeze([30,91,123,194,246,280,359,464,526,547]);
export const BASELINE_SCOPE = 'DISPOSABLE_DERIVED_SQL_ONLY_NOT_82_OR_MANAGED_ACCEPTANCE';

export function gitBlobSha(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash('sha1').update(Buffer.from(`blob ${buf.length}\\0`)).update(buf).digest('hex');
}

export function deriveExactHistoricalRpc(bytes) {
  const canonical = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (canonical.length !== 23112 || gitBlobSha(canonical) !== CANONICAL_BLOB) {
    throw new Error('IMMUTABLE_ORIGINAL82_RPC_SHA_MISMATCH');
  }
  const lines = canonical.toString('utf8').split('\\n');
  if (lines.length !== 572) throw new Error('IMMUTABLE_ORIGINAL82_RPC_LINE_COUNT_MISMATCH');
  const observed = lines.flatMap((line,i) => line.trim()==='$function$' ? [i+1] : []);
  if (JSON.stringify(observed) !== JSON.stringify(BARE_TERMINATOR_LINES)) {
    throw new Error('IMMUTABLE_ORIGINAL82_RPC_TERMINATORS_MISMATCH');
  }
  const derived = Buffer.from(lines.map((line,i) =>
    BARE_TERMINATOR_LINES.includes(i+1) ? `${line};` : line).join('\\n'), 'utf8');
  if (derived.length !== canonical.length + BARE_TERMINATOR_LINES.length ||
      gitBlobSha(derived) !== DERIVED_BLOB) {
    throw new Error('IMMUTABLE_ORIGINAL82_DERIVED_BLOB_MISMATCH');
  }
  return { bytes: derived, originalGitBlob: CANONICAL_BLOB, derivedGitBlob: DERIVED_BLOB };
}

export function ensureDisposableEnvironment(env = process.env) {
  if (env.DDVRE_E2_LOCAL_DISPOSABLE !== 'APPROVED') {
    throw new Error('DERIVED_BASELINE_LOCAL_DISPOSABLE_APPROVAL_REQUIRED');
  }
  for (const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID','DATABASE_URL','SUPABASE_DB_PASSWORD']) {
    if (env[name]) throw new Error('DERIVED_BASELINE_REMOTE_OR_DB_ENV_FORBIDDEN_'+name);
  }
}

export function prepareDisposableOverlay({ repoRoot, env = process.env }) {
  ensureDisposableEnvironment(env);
  const root = resolve(repoRoot);
  const source = join(root,'supabase','migrations',HISTORICAL_FILE);
  const original = readFileSync(source);
  const result = deriveExactHistoricalRpc(original);
  const workdir = mkdtempSync(join(tmpdir(),'ddvre-immutable82-derived-local-'));
  cpSync(join(root,'supabase'),join(workdir,'supabase'),{recursive:true,force:false,errorOnExist:true});
  const destination = join(workdir,'supabase','migrations',HISTORICAL_FILE);
  if (!existsSync(destination)) throw new Error('DERIVED_BASELINE_SCRATCH_CLONE_MISSING');
  writeFileSync(destination,result.bytes,{flag:'w'});
  // Negative invariant: the checked-in original remains byte-identical.
  if (gitBlobSha(readFileSync(source)) !== CANONICAL_BLOB) {
    throw new Error('DERIVED_BASELINE_SOURCE_HISTORY_MODIFIED');
  }
  if (gitBlobSha(readFileSync(destination)) !== DERIVED_BLOB) {
    throw new Error('DERIVED_BASELINE_SCRATCH_BYTES_INVALID');
  }
  const manifest = {
    scope:BASELINE_SCOPE,
    rootVersion:'source163-after-82-immutable-history',
    canonicalVersion:'20260930025132',
    originalGitBlob:CANONICAL_BLOB,
    derivedScratchGitBlob:DERIVED_BLOB,
    exactInsertedTerminalSemicolonLines:[...BARE_TERMINATOR_LINES],
    originalMigrationBytesChanged:false,
    derivedDatabaseLedgerComparableToOriginal:false,
    staging116LedgerEquivalent:false,
    original82RawSqlBootstrapPass:false,
    signedRuntimeTwoPgPass:false,
    managedRuntimePass:false,
    mergeReady:false,
    deployReady:false,
    productWriterEnabled:false,
    source163MigrationCountExpected:163
  };
  writeFileSync(join(workdir,'derived-baseline-manifest.json'),JSON.stringify(manifest,null,2)+'\\n',{flag:'wx'});
  return { workdir, ...manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--prepare-disposable') {
    throw new Error('DERIVED_BASELINE_UNSUPPORTED_INVOCATION');
  }
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  process.stdout.write(JSON.stringify(prepareDisposableOverlay({repoRoot}))+'\\n');
}
