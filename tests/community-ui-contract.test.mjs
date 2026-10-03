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


test('anonymous Community reads stay behind the allowlisted public Edge boundary', async () => {
  const fs = await import('node:fs');
  const browser = fs.readFileSync(new URL('../src/lib/community/browser-client.ts', import.meta.url), 'utf8');
  const edge = fs.readFileSync(new URL('../supabase/functions/community-public-query/index.ts', import.meta.url), 'utf8');
  const migration = fs.readFileSync(new URL('../supabase/migrations/20261003044200_community_public_query_edge_boundary_v1.sql', import.meta.url), 'utf8');

  assert.match(browser, /functions\/v1\/community-public-query/);
  assert.doesNotMatch(browser, /rest\/v1\/rpc\/\$\{rpc\}/);

  for (const rpc of [
    'community_get_creator_public_v1',
    'community_get_gallery_public_v1',
    'community_get_question_public_v1',
    'community_get_question_redirect_public_v1',
    'community_get_tip_public_v1',
    'community_search_questions_v1'
  ]) {
    assert.ok(edge.includes(`'${rpc}'`), rpc);
    assert.ok(migration.includes(`public.${rpc}`), rpc);
  }

  assert.match(edge, /withSupabase\(\{ auth: 'none' \}/);
  assert.match(edge, /ctx\.supabaseAdmin\.rpc\(rpc, params\)/);
  assert.match(migration, /from public,anon,authenticated/);
  assert.match(migration, /to service_role/);
});
