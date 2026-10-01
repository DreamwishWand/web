import test from 'node:test';
import assert from 'node:assert/strict';

import {
  explainFirstWepBlocker,
  explainWepBlocker
} from '../src/lib/wep/blocker-messages.ts';

test('shared blocker registry explains launch-critical WEP boundaries without changing codes', () => {
  for (const code of [
    'NATIVE_EXACT_BUILD_UNVERIFIED',
    'NATIVE_PLACEMENT_INVALID',
    'NATIVE_PLACEMENT_UNVERIFIED',
    'NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED',
    'BUILDING_DESTINATION_SEMANTICS_UNRESOLVED',
    'TOPOLOGY_CLIPPED_UNSUPPORTED',
    'WEP_ROADFENCE_DRAFT_LATTICE_UNRESOLVED',
    'NO_PERSISTENT_WRITER_BOUND',
    'CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED'
  ]) {
    const result = explainWepBlocker(code);
    assert.equal(result.code, code);
    assert.ok(result.title.length > 0);
    assert.ok(result.message.length > 20);
    assert.equal(result.message.includes(code), false);
  }
});

test('unknown blocker stays fail-closed with a readable fallback', () => {
  const result = explainWepBlocker('SOME_FUTURE_CORE_BLOCKER');
  assert.equal(result.code, 'SOME_FUTURE_CORE_BLOCKER');
  assert.equal(result.title, 'Operation blocked');
  assert.match(result.message, /unresolved contract condition/i);
  assert.ok(result.action);
});

test('first blocker explanation preserves source issue code', () => {
  const result = explainFirstWepBlocker([
    { severity: 'WARNING', code: 'IGNORED_WARNING' },
    {
      severity: 'BLOCK',
      code: 'NATIVE_PLACEMENT_UNVERIFIED'
    }
  ]);
  assert.equal(result.code, 'NATIVE_PLACEMENT_UNVERIFIED');
});
