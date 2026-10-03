import test from 'node:test';
import assert from 'node:assert/strict';

import { communityCatalogs } from '../src/lib/i18n/messages/community/index.js';

const launchLocales = ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];

test('Community Gallery/Q&A catalogs cover all launch locales with identical keys', () => {
  assert.deepEqual(Object.keys(communityCatalogs), launchLocales);

  const fallbackKeys = Object.keys(communityCatalogs.en).sort();
  assert.ok(fallbackKeys.length > 0);

  for (const locale of launchLocales) {
    const catalog = communityCatalogs[locale];
    assert.deepEqual(
      Object.keys(catalog).sort(),
      fallbackKeys,
      `${locale} Community key set diverges from EN`
    );
    for (const key of fallbackKeys) {
      assert.equal(typeof catalog[key], 'string', `${locale}:${key} must be a string`);
      assert.ok(catalog[key].trim().length > 0, `${locale}:${key} must not be empty`);
    }
  }
});

test('Community catalog contains launch-critical Gallery and Q&A surface keys', () => {
  for (const key of [
    'gallery.title',
    'gallery.publish.heading',
    'gallery.my.title',
    'qa.title',
    'qa.ask.tags',
    'qa.sameHere',
    'qa.utility.worked',
    'qa.tip.create',
    'qa.activity.title',
    'community.action.report'
  ]) {
    assert.ok(key in communityCatalogs.en, key);
  }
});
