// 03 COMM W-COMM-006: disposable Source169 cumulative SQL rehearsal only.
// Never overwrite historical82, attach a managed DB, or enable Community Writer.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  BASELINE_SCOPE, CANONICAL_BLOB, DERIVED_BLOB, HISTORICAL_FILE,
  ensureDisposableEnvironment, gitBlobSha
} from './comm-immutable82-derived-disposable.mjs';

export const PEER_HEAD = 'a76e1b9faf4e5eae4b5290fd339688226ee9feca';
export const CUMULATIVE_SCOPE = 'SOURCE169_DERIVED_SCRATCH_POSTGRES_ONLY_NO_SIGNED_OR_MANAGED_ACCEPTANCE';
export const PINNED_MIGRATIONS = Object.freeze([
  ['20261105010000_community_source164_reaction_add_service_execute_off.sql','8a272688b3f85e999e43cb772736dba6bc305606'],
  ['20261105020000_community_source165_save_entity_service_execute_off.sql','7412435be16b73e97da46a8c387a2a116b7f5a6c'],
  ['20261105030000_community_source166_unsave_entity_service_execute_off.sql','18a8a7b822840075bc7e9602ed2341ac9be325e0'],
  ['20261105040000_community_source167_remove_reaction_service_execute_off.sql','e14010ede368e0203faa7739acfe2837e2c025f8'],
  ['20261106010000_community_source168_unfollow_creator_service_execute_off.sql','76a9a11e29f27cb171628e2ebc830180a8af3cc6'],
  ['20261106020000_community_source169_follow_creator_service_execute_off.sql','49d22e0dd3e214b14c56c0c175e88f8e7718597e']
]);

export function requireExactPeerHead(head) {
  if (head !== PEER_HEAD) throw new Error('SOURCE169_PEER_HEAD_MISMATCH');
}

export function assertScratchRoot(path) {
  const full = realpathSync(resolve(path));
  const temp = realpathSync(tmpdir());
  if (!full.startsWith(temp + sep) || !basename(full).startsWith('ddvre-immutable82-derived-local-')) {
    throw new Error('DERIVED169_NOT_DISPOSABLE_SCRATCH');
  }
  return full;
}

export function attestPinnedPeerFiles(migrationDir) {
  const seen = new Set();
  const ready = [];
  for (const [file, sha] of PINNED_MIGRATIONS) {
    if (seen.has(file) || !/^[0-9]{14}_community_source16[4-9]_[a-z0-9_]+\.sql$/.test(file)) {
      throw new Error('DERIVED169_MIGRATION_NAME_INVALID');
    }
    seen.add(file);
    const bytes = readFileSync(join(migrationDir,file));
    if (gitBlobSha(bytes) !== sha) throw new Error('DERIVED169_PEER_MIGRATION_SHA_MISMATCH_'+file);
    ready.push({file,sha,bytes});
  }
  if (ready.length !== 6) throw new Error('DERIVED169_EXPECTED_SIX_MIGRATIONS');
  return ready;
}

export function prepareCumulative169({repoRoot, scratchRoot, peerRoot, env=process.env}) {
  ensureDisposableEnvironment(env);
  const repo = realpathSync(resolve(repoRoot));
  const scratch = assertScratchRoot(scratchRoot);
  const peer = realpathSync(resolve(peerRoot));
  const actualPeer = execFileSync('git',['-C',peer,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  requireExactPeerHead(actualPeer);
  const repoSql = join(repo,'supabase','migrations',HISTORICAL_FILE);
  const scratchSql = join(scratch,'supabase','migrations',HISTORICAL_FILE);
  if (gitBlobSha(readFileSync(repoSql)) !== CANONICAL_BLOB) throw new Error('DERIVED169_ORIGINAL82_CHANGED');
  if (gitBlobSha(readFileSync(scratchSql)) !== DERIVED_BLOB) throw new Error('DERIVED169_SCRATCH_NOT_DERIVED');
  const manifest = JSON.parse(readFileSync(join(scratch,'derived-baseline-manifest.json'),'utf8'));
  if (manifest.scope !== BASELINE_SCOPE || manifest.originalGitBlob !== CANONICAL_BLOB ||
      manifest.derivedScratchGitBlob !== DERIVED_BLOB || manifest.original82RawSqlBootstrapPass !== false ||
      manifest.staging116LedgerEquivalent !== false || manifest.mergeReady !== false ||
      manifest.deployReady !== false) throw new Error('DERIVED169_PARENT_MANIFEST_UNSAFE');
  const migrationDir = join(scratch,'supabase','migrations');
  const current = readdirSync(migrationDir).filter(f=>f.endsWith('.sql'));
  if (current.length !== 163) throw new Error('DERIVED169_PARENT_NOT_SOURCE163_'+current.length);
  const ready = attestPinnedPeerFiles(join(peer,'supabase','migrations'));
  for (const {file} of ready) if (existsSync(join(migrationDir,file))) {
    throw new Error('DERIVED169_MIGRATION_OVERWRITE_FORBIDDEN');
  }
  // Attest all six identities before writing to scratch.
  for (const {file,bytes} of ready) writeFileSync(join(migrationDir,file),bytes,{flag:'wx'});
  if (readdirSync(migrationDir).filter(f=>f.endsWith('.sql')).length !== 169) {
    throw new Error('DERIVED169_SCRATCH_COUNT_INCORRECT');
  }
  if (gitBlobSha(readFileSync(repoSql)) !== CANONICAL_BLOB ||
      gitBlobSha(readFileSync(scratchSql)) !== DERIVED_BLOB) {
    throw new Error('DERIVED169_ORIGINAL_OR_DERIVED_CHANGED');
  }
  const receipt = {
    scope:CUMULATIVE_SCOPE, source169PeerHead:PEER_HEAD,
    original82GitBlob:CANONICAL_BLOB, scratchDerived82GitBlob:DERIVED_BLOB,
    original82Unmodified:true, migrationsAdded:ready.map(({file,sha})=>({file,sha})),
    source169MigrationCountExpected:169, original82RawSqlBootstrapPass:false,
    source169SignedCumulativeTwoPgPass:false, managedLedgerCompatible:false,
    schemaAuthorityEquivalent:false, mergeReady:false, deployReady:false,
    productWriterEnabled:false, communityPublicEnabled:false
  };
  writeFileSync(join(scratch,'derived169-cumulative-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 5 || process.argv[2] !== '--prepare-cumulative') {
    throw new Error('DERIVED169_UNSUPPORTED_INVOCATION');
  }
  const repoRoot = fileURLToPath(new URL('../',import.meta.url));
  process.stdout.write(JSON.stringify(prepareCumulative169({
    repoRoot,scratchRoot:process.argv[3],peerRoot:process.argv[4]
  }))+'\n');
}
