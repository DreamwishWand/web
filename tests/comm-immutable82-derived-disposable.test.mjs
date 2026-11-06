import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
 gitBlobSha, deriveExactHistoricalRpc, ensureDisposableEnvironment,
 CANONICAL_BLOB, DERIVED_BLOB, BARE_TERMINATOR_LINES, HISTORICAL_FILE
} from '../scripts/comm-immutable82-derived-disposable.mjs';

const origin = fileURLToPath(new URL('../',import.meta.url));
const source = join(origin,'supabase/migrations',HISTORICAL_FILE);
test('original 82 RPC exact blob is immutable while scratch derivation is known fixed SHA',()=>{
 const bytes=readFileSync(source);
 assert.equal(gitBlobSha(bytes),CANONICAL_BLOB);
 const output=deriveExactHistoricalRpc(bytes);
 assert.equal(gitBlobSha(output.bytes),DERIVED_BLOB);
 assert.equal(output.bytes.length,bytes.length+10);
 assert.deepEqual(BARE_TERMINATOR_LINES,[30,91,123,194,246,280,359,464,526,547]);
 assert.equal(gitBlobSha(readFileSync(source)),CANONICAL_BLOB);
});

test('tampering, missing SQL terminator, and already-corrected drift all fail closed',()=>{
 const original=readFileSync(source);
 const tampered=Buffer.from(original);tampered[0]^=1;
 assert.throws(()=>deriveExactHistoricalRpc(tampered),/SHA_MISMATCH/);
 const shortened=original.subarray(0,original.length-1);
 assert.throws(()=>deriveExactHistoricalRpc(shortened),/SHA_MISMATCH/);
 const corrected=deriveExactHistoricalRpc(original).bytes;
 assert.throws(()=>deriveExactHistoricalRpc(corrected),/SHA_MISMATCH/);
});

test('only explicit disposable local scope with zero remote configuration may create overlay',()=>{
 assert.throws(()=>ensureDisposableEnvironment({}),/LOCAL_DISPOSABLE_APPROVAL_REQUIRED/);
 for(const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID','DATABASE_URL','SUPABASE_DB_PASSWORD']){
   assert.throws(()=>ensureDisposableEnvironment({DDVRE_E2_LOCAL_DISPOSABLE:'APPROVED',[name]:'unsafe'}),/REMOTE_OR_DB_ENV_FORBIDDEN/);
 }
 assert.doesNotThrow(()=>ensureDisposableEnvironment({DDVRE_E2_LOCAL_DISPOSABLE:'APPROVED',SUPABASE_ACCESS_TOKEN:''}));
});
