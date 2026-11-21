// 09P-SQL / immutable original82 migration guard.
// This is SOURCE_ONLY evidence. It cannot prove PostgreSQL clean Bootstrap,
// effective permissions, signed two-PG semantics, managed DB migration equivalence,
// or authorize Writer/Community Public/Stage116/Provider deployment.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const historical = new URL(
  '../supabase/migrations/20260930025132_community_core_v0_server_rpc.sql',
  import.meta.url
);
const canonicalSha = 'bbf9bc830440d964c5da8b3c3cac7e926d281881';
const historicalCorrectedExampleSha = 'd7991c2c20b7ace6613d6a9cd6493b8c3af0f6ba';
const exactlyBareTerminatorLines = [30, 91, 123, 194, 246, 280, 359, 464, 526, 547];

function gitBlobSha(buffer) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.length}\0`, 'utf8'))
    .update(buffer)
    .digest('hex');
}

test('historical original82 RPC migration preserves exact Git blob SHA', () => {
  const bytes = readFileSync(historical);
  assert.equal(bytes.length, 23112);
  assert.equal(gitBlobSha(bytes), canonicalSha);
  assert.equal(bytes.toString('utf8').split('\n').length, 572);
});

test('recorded source-branch drift is exactly ten terminator semicolons, not an approved history rewrite', () => {
  const canonicalBytes = readFileSync(historical);
  assert.equal(gitBlobSha(canonicalBytes), canonicalSha);
  const lines = canonicalBytes.toString('utf8').split('\n');
  const actualBareLines = lines.flatMap((line, index) =>
    line.trim() === '$function$' ? [index + 1] : []
  );
  assert.deepEqual(actualBareLines, exactlyBareTerminatorLines);

  // Preview in memory only. Never write a new/altered SQL migration file.
  const preview = lines.map((line, index) =>
    exactlyBareTerminatorLines.includes(index + 1) ? `${line};` : line
  ).join('\n');
  const previewBytes = Buffer.from(preview, 'utf8');
  assert.equal(previewBytes.length, canonicalBytes.length + 10);
  assert.equal(gitBlobSha(previewBytes), historicalCorrectedExampleSha);
  // A read-back proves that testing the derived preview did not replace the original.
  assert.equal(gitBlobSha(readFileSync(historical)), canonicalSha);
});

test('byte changes are detectable; an alternate source cannot be accepted as the immutable historical migration', () => {
  const original = readFileSync(historical);
  const tampered = Buffer.from(original);
  tampered[0] ^= 1;
  assert.notEqual(gitBlobSha(tampered), canonicalSha);
  assert.notEqual(historicalCorrectedExampleSha, canonicalSha);
});
