import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSourceBoundCollectionCatalogV125 } from '../src/lib/ddv/core/collection/source-bound-catalog-v125.js';

const source = readFileSync('static/ddv/core/collection/v1.25/collection-definition-source-compact-v125.json');
const index = JSON.parse(readFileSync('static/ddv/collection/v1.25/index.json', 'utf8'));
const identity = Object.freeze({
  platform: 'switch', gameVersion: '1.25.0',
  buildId: '52BD625D9B4E0053', profileSchema: 624
});
const load = (overrides = {}) => loadSourceBoundCollectionCatalogV125({
  rawSourceBytes: source, identity, locale: 'ja', referenceIndex: index, ...overrides
});

test('Category-first exactly matches 17 original source categories and 293 source Definitions without deriving any Native denominator', async () => {
  const v = await load();
  assert.equal(v.status, 'SOURCE_BOUND_STATIC_CATALOG_ONLY');
  assert.equal(v.categoryFirst, true);
  assert.equal(v.categories.length, 17);
  assert.equal(v.collectionSource.definitionCount, 293);
  assert.equal(v.collectionSource.typedSelectorOccurrences, 256);
  assert.equal(v.itemDatabaseSource.sourceRecordCount, 17413);
  assert.equal(v.referenceCatalog.declaredReferenceRowCount, 12552);
  assert.equal(v.referenceCatalog.shardBytesVerifiedHere, false);
  assert.equal(v.referenceCatalog.collectionDenominator, null);
  assert.equal(v.categories.reduce((n, c) => n + c.definitions.length, 0), 293);
  assert.deepEqual(v.categories.map(c => c.sourceDefinitionCount),
    JSON.parse(source).categoryCounts.map(row => row[2]));
  for (const c of v.categories) {
    assert.equal(c.nativeItemCount, null);
    assert.equal(c.entryDenominator, null);
    assert.equal(c.uniqueDenominator, null);
    assert.equal(c.localizedCategoryName, null);
    for (const d of c.definitions) {
      assert.match(d.definitionRawSha256, /^[0-9a-f]{64}$/);
      assert.equal(d.localizedDefinitionName, null);
      assert.equal(d.nativeMemberIds, null);
      assert.equal(d.nativeMemberCount, null);
      assert.equal(d.collected, null);
      assert.equal(d.owned, null);
      assert.equal(d.missing, null);
    }
  }
  assert.equal(v.entryDenominator, null);
  assert.equal(v.uniqueDenominator, null);
  assert.equal(v.collected, null);
  assert.equal(v.owned, null);
  assert.equal(v.missing, null);
  assert.equal(v.nativeCollectionMembershipVerified, false);
  assert.equal(v.personalMetricsAuthorized, false);
});

test('Priority Crafting and sentinel source properties are preserved without projecting Item membership', async () => {
  const v = await load();
  const all = v.categories.flatMap(c => c.definitions);
  const crafting = all.find(x => x.definitionId === 2120000121);
  const sentinel = all.find(x => x.definitionId === 2120000259);
  assert.ok(crafting);
  assert.equal(crafting.typedSelectorOccurrences, 2);
  assert.ok(sentinel);
  assert.equal(sentinel.hasUnresolvedZeroSentinel, true);
  assert.equal(sentinel.nativeMemberCount, null);
  assert.equal(v.media, null);
  assert.equal(v.mediaRights.publicDisplayLicensed, false);
});

test('All supported launch locales are explicit, and no unverified Definition locale silently falls back to translated text', async () => {
  for (const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']) {
    const v = await load({locale, referenceIndex:null});
    assert.equal(v.status, 'SOURCE_BOUND_STATIC_CATALOG_ONLY');
    assert.equal(v.localeRequested, locale);
    assert.equal(v.definitionLocaleVerified, false);
    assert.equal(v.referenceCatalog, null);
    assert.equal(v.categories[0].nameFallback, 'SOURCE_KEY_NOT_OFFICIAL_LOCALE');
    assert.equal(v.categories[0].definitions[0].nameFallback, 'SOURCE_TOKEN_NOT_OFFICIAL_LOCALE');
  }
  assert.equal((await load({locale:'es'})).code,'UNSUPPORTED_LOCALE_NO_IMPLICIT_FALLBACK');
  assert.equal((await load({locale:'xx'})).status,'BLOCKED');
});

test('Fail closed on Switch 1.25.3/schema626, Steam, unknown BID or unknown source bytes', async () => {
  const wrong = [
    { ...identity, gameVersion:'1.25.3', profileSchema:626, buildId:'9A239D3DB569756D' },
    { ...identity, platform:'steam' },
    { ...identity, profileSchema:626 },
    { ...identity, buildId:'D0E7F0B11DADACFF' }
  ];
  for (const target of wrong) {
    const v = await load({identity:target});
    assert.equal(v.status,'BLOCKED');
    assert.equal(v.code,'EXACT_SWITCH_1250_BUILD_REQUIRED');
    assert.equal(v.personalMetricsAuthorized,false);
    assert.equal(v.entryDenominator,null);
  }
  assert.equal((await load({rawSourceBytes:null})).code,'ORIGINAL_SOURCE_BYTES_REQUIRED');
  const corrupt = Uint8Array.from(source);
  corrupt[300] ^= 1;
  assert.equal((await load({rawSourceBytes:corrupt})).code,'ORIGINAL_SOURCE_SHA_OR_CONTRACT_UNVERIFIED');
});

test('Reference index remains independently versioned and cannot supply Collection native denominators', async () => {
  for (const altered of [
    {...index, t:{...index.t,gameVersion:'1.25.3'}},
    {...index, t:{...index.t,buildID:'9A239D3DB569756D'}},
    {...index, n: 12553},
    {...index, media:'IMAGES_ALLOWED'},
    {...index, a:'UNSIGNED_REFERENCE_CATALOG'},
    {...index, l:[...index.l.slice(0,7),'not_PT-BR']},
    {...index, shards:[...index.shards.slice(0,-1)]}
  ]) {
    const v = await load({referenceIndex:altered});
    assert.equal(v.status,'BLOCKED');
    assert.equal(v.entryDenominator,null);
    assert.equal(v.publicMediaAuthorized,false);
  }
});

test('Rights claims, synthetic progress and foreign asset metadata cannot promote source-only catalog', async () => {
  const v = await load({
    mediaRights:{publicDisplayLicensed:true},
    owned:500, collected:500, percentage:100,
    remoteAssets:[{url:'https://example.org/game-image.png',rights:'approved'}]
  });
  assert.equal(v.status,'SOURCE_BOUND_STATIC_CATALOG_ONLY');
  assert.equal(v.media,null);
  assert.equal(v.mediaRights.publicDisplayLicensed,false);
  assert.equal(v.publicMediaAuthorized,false);
  assert.equal(v.publicCatalogPublicationAuthorized,false);
  assert.equal(v.nativeWriterAuthorized,false);
  assert.equal(v.owned,null);
  assert.equal(v.collected,null);
  assert.equal(v.entryDenominator,null);
});
