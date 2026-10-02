import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/wep-representative-save-browser-acceptance.mjs', import.meta.url), 'utf8');

test('representative-save QA harness uses an external private fixture contract', () => {
  assert.match(source, /WEP_REPRESENTATIVE_FIXTURE_PATH/);
  assert.match(source, /1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10/);
  assert.match(source, /12846979/);
  assert.doesNotMatch(source, /const\s+rawSwitchFixture\s*=/);
  assert.match(source, /persistentWriteAuthorized:\s*false/);
  assert.match(source, /WORLD_PERSISTENT_WRITE_V125:\s*false/);
});

test('representative-save QA harness does not execute persistent Apply or Commit', () => {
  assert.match(source, /persistentApplyExecuted:\s*false/);
  assert.match(source, /atomicCommitExecuted:\s*false/);
  assert.match(source, /name:\s*\/\^Apply\$\//);
  assert.match(source, /name:\s*\/\^Commit\$\//);
});
