import {
  verifyCollectionDefinitionSourceV125,
  planCollectionDefinitionGroupV125
} from './category-definition-provenance-v125.js';
import { validateCollectionRuntimeIndex } from '../../../collection/runtime.js';

export const COLLECTION_SOURCE_BOUND_CATALOG_SCHEMA = 'ddv.collection.source-bound-catalog@1';
const BID = '52BD625D9B4E0053';
const LOCALES = Object.freeze(['en', 'fr', 'it', 'de', 'es-ES', 'ja', 'zh-CN', 'pt-BR']);
const REF_MANIFEST = 'COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2';
const REF_MEDIA_OFF = 'TEXT_PLUS_FAMILY_ICON_UNTIL_CURRENT_BYTES_AND_RIGHTS_APPROVED';
const SOURCE_MANIFEST_SHA = 'c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const ITEM_DB_SOURCE_SHA = 'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048';

const blocked = (code) => Object.freeze({
  schema: COLLECTION_SOURCE_BOUND_CATALOG_SCHEMA, status: 'BLOCKED', code,
  entryDenominator: null, uniqueDenominator: null,
  collected: null, owned: null, missing: null,
  media: null, personalMetricsAuthorized: false, publicMediaAuthorized: false,
  nativeWriterAuthorized: false
});

const targetMatches = (t) => t?.platform === 'switch' &&
  t?.gameVersion === '1.25.0' && t?.buildId === BID &&
  t?.profileSchema === 624;

/**
 * SHA-bound SOURCE CollectionDefinitions, not actual GetNewGroup output.
 *
 * A separate indexed/sharded reference catalogue has localized *item* labels;
 * it is not a verified join to Native Collection groups, nor their denominator.
 * The Definition names are internal source tokens, NOT localized game labels.
 * Original DDV media has no implicit public image license.
 */
export async function loadSourceBoundCollectionCatalogV125({
  rawSourceBytes, identity, locale = 'en', referenceIndex = null
} = {}) {
  if (!targetMatches(identity)) return blocked('EXACT_SWITCH_1250_BUILD_REQUIRED');
  if (!LOCALES.includes(locale)) return blocked('UNSUPPORTED_LOCALE_NO_IMPLICIT_FALLBACK');
  if (!(rawSourceBytes instanceof Uint8Array) && typeof rawSourceBytes !== 'string')
    return blocked('ORIGINAL_SOURCE_BYTES_REQUIRED');

  // Clone before the asynchronous hash check so neither the source verifier
  // nor subsequent parsing can consume different mutable caller bytes.
  const bytes = typeof rawSourceBytes === 'string'
    ? new TextEncoder().encode(rawSourceBytes)
    : Uint8Array.from(rawSourceBytes);
  const verifiedSource = await verifyCollectionDefinitionSourceV125(bytes);
  if (verifiedSource.status !== 'SOURCE_VERIFIED_STATIC_ONLY')
    return blocked('ORIGINAL_SOURCE_SHA_OR_CONTRACT_UNVERIFIED');

  let pack;
  try { pack = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return blocked('ORIGINAL_SOURCE_PARSE_FAILED'); }

  let reference = null;
  if (referenceIndex !== null) {
    try { validateCollectionRuntimeIndex(referenceIndex); }
    catch { return blocked('REFERENCE_INDEX_STRUCTURE_UNVERIFIED'); }
    if (referenceIndex.a !== REF_MANIFEST || referenceIndex.n !== 12552 ||
        referenceIndex.media !== REF_MEDIA_OFF ||
        JSON.stringify(referenceIndex.l) !== JSON.stringify(['EN','FR','IT','DE','ES-ES','JA','ZH-CN','PT-BR']))
      return blocked('REFERENCE_INDEX_SOURCE_IDENTITY_OR_MEDIA_MISMATCH');
    reference = Object.freeze({
      sourceManifest: REF_MANIFEST, declaredReferenceRowCount: 12552,
      evidence: 'REFERENCE_INDEX_DECLARATION_ONLY',
      shardBytesVerifiedHere: false, liveItemDatabaseVerified: false,
      nativeCollectionMembershipVerified: false, collectionDenominator: null
    });
  }

  const categoryMap = new Map(pack.categoryCounts.map(([categoryCode, categoryKey, count]) => [
    categoryKey, { categoryCode, categoryKey, expectedDefinitions: count, definitions: [] }
  ]));
  for (const row of pack.records) {
    const plan = planCollectionDefinitionGroupV125({
      verifiedSource, identity, collectionDefinitionId: row[0]
    });
    if (plan.status !== 'SOURCE_GROUP_OPERAND_PLAN_ONLY' ||
        !categoryMap.has(plan.categoryId) || plan.definitionRawSha256 !== row[2])
      return blocked('SOURCE_DEFINITION_BINDING_INCOMPLETE');

    categoryMap.get(plan.categoryId).definitions.push(Object.freeze({
      definitionId: plan.collectionDefinitionId,
      definitionNameSourceToken: plan.definitionName,
      definitionRawSha256: plan.definitionRawSha256,
      typedSelectorOccurrences: plan.typedSelectors.length,
      explicitFilterOccurrences: plan.explicitItemFilters.length,
      hasUnresolvedZeroSentinel: plan.hasUnresolvedZeroSentinel,
      localizedDefinitionName: null,
      nameFallback: 'SOURCE_TOKEN_NOT_OFFICIAL_LOCALE',
      nativeMemberIds: null, nativeMemberCount: null,
      collected: null, owned: null, missing: null
    }));
  }

  const categories = [...categoryMap.values()].map(c => {
    if (c.definitions.length !== c.expectedDefinitions)
      return null;
    return Object.freeze({
      categoryCode: c.categoryCode,
      categoryKey: c.categoryKey,
      sourceDefinitionCount: c.definitions.length,
      localizedCategoryName: null,
      nameFallback: 'SOURCE_KEY_NOT_OFFICIAL_LOCALE',
      definitions: Object.freeze(c.definitions),
      nativeItemCount: null, entryDenominator: null, uniqueDenominator: null
    });
  });
  if (categories.some(c => c === null) || categories.length !== 17)
    return blocked('SOURCE_CATEGORY_COVERAGE_INCOMPLETE');

  return Object.freeze({
    schema: COLLECTION_SOURCE_BOUND_CATALOG_SCHEMA,
    status: 'SOURCE_BOUND_STATIC_CATALOG_ONLY',
    platform: 'switch', gameVersion: '1.25.0', buildId: BID, profileSchema: 624,
    localeRequested: locale, definitionLocaleVerified: false,
    categoryFirst: true,
    collectionSource: Object.freeze({
      sourceManifestSha256: SOURCE_MANIFEST_SHA,
      definitionCount: 293, categoryCount: 17, typedSelectorOccurrences: 256,
      originalDefinitionEvidence: 'SOURCE_SHA_PINNED_NOT_RUNTIME'
    }),
    itemDatabaseSource: Object.freeze({
      sourceSha256: ITEM_DB_SOURCE_SHA, sourceRecordCount: 17413,
      liveRuntimeVerified: false, itemIdsResolvedToCollection: false
    }),
    referenceCatalog: reference,
    categories: Object.freeze(categories),
    media: null,
    mediaRights: Object.freeze({
      assetSourceVersionVerified: false, publicDisplayLicensed: false,
      officialGameImagePublication: 'OFF_UNREVIEWED_RIGHTS'
    }),
    nativeCollectionMembershipVerified: false,
    entryDenominator: null, uniqueDenominator: null,
    collected: null, owned: null, missing: null,
    personalMetricsAuthorized: false, publicMediaAuthorized: false,
    publicCatalogPublicationAuthorized: false, nativeWriterAuthorized: false
  });
}
