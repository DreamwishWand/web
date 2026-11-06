// 09P-SQL derived82, disposable bootstrap ONLY (not a release migration).
// Source historical 82 files are kept byte-for-byte immutable.
// The only change is in a new temporary copy, never in repository or managed DB.
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const originalPath = '20260930025132_community_core_v0_server_rpc.sql';
const expectedOriginal = 'bbf9bc830440d964c5da8b3c3cac7e926d281881';
const expectedDerived = 'd7991c2c20b7ace6613d6a9cd6493b8c3af0f6ba';
const expectedLines = [30, 91, 123, 194, 246, 280, 359, 464, 526, 547];
function blobSha(bytes) {
  return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
const cwd = resolve(process.cwd());
const inputDir = join(cwd, 'supabase');
const originalBytes = readFileSync(join(inputDir, 'migrations', originalPath));
const names = readdirSync(join(inputDir, 'migrations')).filter(n => n.endsWith('.sql'));
if (names.length !== 82) throw new Error(`DERIVED82_EXPECTED_EXACT_82_SOURCE_FILENAMES_ACTUAL_${names.length}`);
if (blobSha(originalBytes) !== expectedOriginal) throw new Error('DERIVED82_ORIGINAL_HISTORICAL_BLOB_DRIFT');
const lines = originalBytes.toString('utf8').split('\n');
const actualLines = lines.flatMap((line,i)=>line.trim()==='$function$'?[i+1]:[]);
if (JSON.stringify(actualLines)!==JSON.stringify(expectedLines)) throw new Error('DERIVED82_TERMINATOR_LINE_SET_DRIFT');
const corrected = lines.map((line,i)=>expectedLines.includes(i+1)?line+';':line).join('\n');
const correctedBytes = Buffer.from(corrected,'utf8');
if (blobSha(correctedBytes)!==expectedDerived) throw new Error('DERIVED82_ONLY_TEN_SEMICOLON_DIFF_SHA_DRIFT');
// Output must be a newly generated temporary scratch directory with no existing project.
const tempRoot = mkdtempSync(join(tmpdir(), 'wand-derived82-disposable-'));
const scratchSupabase = join(tempRoot, 'supabase');
cpSync(inputDir, scratchSupabase, {recursive:true});
const scratchHistorical = join(scratchSupabase,'migrations',originalPath);
writeFileSync(scratchHistorical,correctedBytes);
if (blobSha(readFileSync(scratchHistorical))!==expectedDerived) throw new Error('DERIVED82_TEMP_OVERLAY_MISMATCH');
if (blobSha(readFileSync(join(inputDir,'migrations',originalPath)))!==expectedOriginal) throw new Error('DERIVED82_SOURCE_CHANGED');
// No credential, user data, or environment-derived content in this manifest.
writeFileSync(join(tempRoot,'DERIVED82_TEST_ONLY_PROVENANCE.json'),
JSON.stringify({
  label:'DERIVED82_TEST_ONLY_NOT_RAW_IMMUTABLE_REPLAY',
  sourceMigrations:82,
  changedFile:'supabase/migrations/'+originalPath,
  rawOriginalGitBlob:expectedOriginal,
  derivedTemporaryGitBlob:expectedDerived,
  exactAddedSemicolonLines:expectedLines,
  originalFilesMutated:false,
  mergeReady:false,
  deployReady:false,
  publicOrWriterGate:false
},null,2)+'\n');
process.stdout.write(tempRoot+'\n');
