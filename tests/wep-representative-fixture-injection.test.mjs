import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../scripts/wep-representative-save-browser-acceptance.mjs', import.meta.url),
  'utf8'
);

test('representative-save QR harness keeps the private fixture external and exact', () => {
  assert.match(source, /WEP_REPRESENTATIVE_FIXTURE_PATH/);
  assert.match(
    source,
    /1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10/
  );
  assert.match(source, /12846979/);
  assert.match(source, /1540000147/);
  assert.match(source, /EXPECTED_OBJECTS = 4230/);
  assert.doesNotMatch(source, /const\s+rawSwitchFixture\s*=/);
});

test('representative-save R9 B\/H harness preserves writer and source-replacement boundaries', () => {
  assert.match(source, /persistentWriteAuthorized:\s*false/);
  assert.match(source, /WORLD_PERSISTENT_WRITE_V125:\s*false/);
  assert.match(source, /PERSISTENT_WRITE:\s*false/);
  assert.match(source, /productApplyAuthorized:\s*false/);
  assert.match(source, /directSourceReplacementAuthorized:\s*false/);
  assert.match(source, /sourceOverwriteExecuted:\s*false/);
  assert.match(source, /overwrite source\|replace source save\|write to source save/i);
});

test('representative-save R9 B\/H harness requires real browser inspection evidence', () => {
  assert.match(source, /Open in Canvas/);
  assert.match(source, /g\[data-editor-object\]/);
  assert.match(source, /tabindex="0"/);
  assert.match(source, /wep-reason-move/);
  assert.match(source, /object-inspector/);
  assert.match(source, /consoleErrors/);
  assert.match(source, /pageErrors/);
  assert.match(source, /WE-INSPECT/);
  assert.match(source, /WE-FIXTURE-COVERAGE/);
});
