// Read-only exact selection check. This is NOT a merge or acceptance gate.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const safePath = p => typeof p === 'string' && p.length <= 512 &&
  p.split('/').every(s => /^[A-Za-z0-9_.-]+$/.test(s) && s !== '.' && s !== '..' && s.toLowerCase() !== '.git');
const deny = msg => { throw new Error(msg); };
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' }, stdio: ['ignore', 'pipe', 'pipe']
});
function fixedCommit(cwd, sha) {
  if (typeof sha !== 'string' || !SHA.test(sha) || git(cwd, 'rev-parse', '--verify', sha + '^{commit}').trim() !== sha)
    deny('FIXED_COMMIT_REQUIRED');
  return sha;
}
function entry(cwd, sha, path) {
  const parts = path.split('/');
  for (let i=1; i<parts.length; i++) {
    const parent = parts.slice(0,i).join('/');
    const rawParent = git(cwd, 'ls-tree', '-z', sha, '--', parent);
    if (!rawParent) break;
    const m = /^040000 tree [0-9a-f]{40}\t([^\0]+)\0$/.exec(rawParent);
    if (!m || m[1] !== parent) deny('PATH_NAMESPACE_CONFLICT:' + parent);
  }
  const raw = git(cwd, 'ls-tree', '-z', sha, '--', path);
  if (raw === '') return null;
  const match = /^(100644|100755) blob ([0-9a-f]{40})\t([^\0]+)\0$/.exec(raw);
  if (!match || match[3] !== path) deny('NON_REGULAR_OR_AMBIGUOUS_PATH');
  return { mode: match[1], blob: match[2] };
}
const equal = (a,b) => a === null || b === null ? a === b : a.mode === b.mode && a.blob === b.blob;

export function inspectSelection(cwd, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'base,main,paths,source' ||
      !Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > 256 ||
      !input.paths.every(safePath) || new Set(input.paths).size !== input.paths.length)
    deny('INVALID_SELECTION_INPUT');
  const base = fixedCommit(cwd, input.base), source = fixedCommit(cwd, input.source),
    main = fixedCommit(cwd, input.main);
  if (base === source) deny('EMPTY_SOURCE');
  git(cwd, 'merge-base', '--is-ancestor', base, source);
  const changed = git(cwd, 'diff', '--name-only', '-z', '--no-renames', '--no-ext-diff',
    '--no-textconv', '--ignore-submodules=none', base, source, '--').split('\0').filter(Boolean).sort();
  const paths = [...input.paths].sort();
  if (changed.length !== paths.length || changed.some((p,i) => p !== paths[i]))
    deny('SOURCE_PATH_SET_MISMATCH');
  const entries = paths.map(path => {
    const before = entry(cwd, base, path), after = entry(cwd, source, path),
      current = entry(cwd, main, path);
    if (equal(before, after)) deny('UNCHANGED_PATH');
    if (!equal(before, current)) deny('MAIN_PREIMAGE_MISMATCH:' + path);
    return { path, before, after, change: !before ? 'ADD' : !after ? 'DELETE' : 'MOD' };
  });
  return { version: 1, status: 'EXACT_SELECTION_PREFLIGHT_ONLY', base, source, main, entries,
    mergeAuthorized: false, acceptanceVerified: false, remoteFreshnessVerified: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) deny('USAGE: node scripts/int-selection-preflight.mjs manifest.json');
    const raw = readFileSync(process.argv[2]);
    if (raw.length > 256 * 1024) deny('INPUT_TOO_LARGE');
    console.log(JSON.stringify(inspectSelection(process.cwd(), JSON.parse(raw.toString('utf8')))));
  } catch (error) {
    console.error('INT_SELECTION_DENIED:', error.message);
    process.exitCode = 1;
  }
}
