import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectSelection } from '../scripts/int-selection-preflight.mjs';

test('exact source selection must reject omitted gitlink despite diff.ignoreSubmodules=all', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wand-int-qa860-'));
  const git = (...args) => execFileSync('git', args, {
    cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  const commit = msg => { git('commit', '-m', msg); return git('rev-parse', 'HEAD'); };
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Synthetic QA');
    git('config', 'user.email', 'qa@example.invalid');
    writeFileSync(join(dir, 'a.txt'), 'old');
    git('add', 'a.txt');
    const root = commit('root');
    git('update-index', '--add', '--cacheinfo', '160000,' + root + ',hidden-submodule');
    const base = commit('base');
    writeFileSync(join(dir, 'a.txt'), 'new');
    git('add', 'a.txt');
    git('update-index', '--cacheinfo', '160000,' + base + ',hidden-submodule');
    const source = commit('source');
    const input = { base, source, main: base, paths: ['a.txt'] };
    assert.deepEqual(git('diff', '--name-only', '--ignore-submodules=none', base, source).split('\n'),
      ['a.txt', 'hidden-submodule']);
    assert.throws(() => inspectSelection(dir, input), /SOURCE_PATH_SET_MISMATCH/);
    git('config', 'diff.ignoreSubmodules', 'all');
    assert.equal(git('diff', '--name-only', base, source), 'a.txt');
    assert.throws(() => inspectSelection(dir, input), /SOURCE_PATH_SET_MISMATCH/,
      'must not accept a source with an omitted changed gitlink under ambient Git config');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
