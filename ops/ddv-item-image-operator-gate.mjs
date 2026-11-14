// 07 DBK / W-07DBK-ITEM-IMG-031 — pure SOURCE_ONLY release-operator preflight.
// This module never publishes assets, grants rights, invalidates a CDN or flips product flags.
// The Owner's 2026-11-05 game-image business decision is NOT a copyright licence.
export const OWNER_IMAGE_DECISION = "OWNER_GO_FOR_DDV_GAME_IMAGES_20261105";
export const IMAGE_NOTICE_LOCALES = Object.freeze(["en", "de", "es-ES", "fr", "it", "ja", "pt-BR", "zh-CN"]);
const SHA256 = /^[a-f0-9]{64}$/i;
const hasText = value => typeof value === "string" && value.trim().length > 0;
const sha = value => typeof value === "string" && SHA256.test(value);
const itemId = value => (Number.isSafeInteger(value) && value > 0) ||
  (typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value));
const normalizeId = value => String(value);
const evidence = value => hasText(value) && value !== "UNKNOWN" && value !== "NOT_RUN";
// Build identity is platform-specific. Steam FullVersion SHA is evidence from the
// installed original version file, not a hash guessed from a schema or version label.
// Never manufacture a Switch BID for Steam; preserve the legacy Switch BID contract.
// Steam evidence must be canonical, never silently normalized into a valid identity.
// Keep the historical Switch evidence contract unchanged.
const steamEvidence = value => evidence(value) && value === value.trim() &&
  !/^(?:UNKNOWN|NOT_RUN)$/i.test(value) && !/[\p{Cc}\p{Cf}]/u.test(value);
const steamBuildToken = value => steamEvidence(value) && /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value);
const steamFileSha = value => sha(value) && value.length === 64;
const identity = value => {
  if (!value || !evidence(value.fullVersion) || !Number.isSafeInteger(value.schema) || value.schema < 0)
    return false;
  if (value.platform === "Nintendo Switch") return evidence(value.bid);
  if (value.platform === "Steam Windows") {
    return (value.bid === null || value.bid === undefined) && steamBuildToken(value.fullVersion) && steamFileSha(value.fullVersionSha256);
  }
  return false;
};
const sameIdentity = (a, b) => identity(a) && identity(b) &&
  a.platform === b.platform && a.fullVersion === b.fullVersion && a.schema === b.schema &&
  (a.platform === "Nintendo Switch"
    ? a.bid === b.bid
    : a.fullVersionSha256.toLowerCase() === b.fullVersionSha256.toLowerCase());

// A suppression ledger is authoritative only if valid. Never treat corrupt/absent ledger as empty.
export function validateImageSuppressionLedger(ledger) {
  return Array.isArray(ledger) && ledger.every(entry =>
    entry && entry.state === "HIDDEN" && evidence(entry.incidentRef) &&
    ((entry.kind === "ITEM_ID" && itemId(entry.value)) ||
     (entry.kind === "SOURCE_SHA256" && sha(entry.value)) ||
     (entry.kind === "WEBP_SHA256" && sha(entry.value))));
}

// The result is a technical asset-manifest candidate only, never an IP licence or publishing approval.
export function preflightGameItemImage(row, context, suppressionLedger) {
  const reasons = [];
  if (!row || typeof row !== "object") return { candidate: false, reasons: ["IMAGE_ROW_MISSING"] };
  if (!itemId(row.itemId) || !hasText(row.sourceGuid)) reasons.push("CANONICAL_ITEM_GUID_MISSING");
  if (!sha(row.sourcePngSha256) || !sha(row.webpSha256)) reasons.push("IMAGE_DIGEST_INVALID");
  if (!identity(row.sourceIdentity) || !evidence(row.sourceEvidenceRef) ||
      (row.sourceIdentity?.platform === "Steam Windows" && !steamEvidence(row.sourceEvidenceRef)))
    reasons.push("SOURCE_IDENTITY_UNVERIFIED");
  if (!sameIdentity(row.targetIdentity, context?.targetIdentity) ||
      row.targetMappingVerified !== true || !evidence(row.targetEvidenceRef) ||
      (row.targetIdentity?.platform === "Steam Windows" && !steamEvidence(row.targetEvidenceRef)))
    reasons.push("TARGET_VERSION_BID_SCHEMA_UNVERIFIED");
  if (row.visibilityClass !== "PLAYER_VISIBLE_VERIFIED" || row.nativePlayerVisibleVerified !== true ||
      !evidence(row.visibilityEvidenceRef) || row.unreleased !== false)
    reasons.push("UNRELEASED_OR_VISIBILITY_UNKNOWN");
  if (row.isPrivateSaveMedia === true || row.isUserCreatedMedia === true)
    reasons.push("PRIVATE_OR_USER_MEDIA_EXCLUDED");
  if (!validateImageSuppressionLedger(suppressionLedger)) {
    reasons.push("SUPPRESSION_LEDGER_MISSING_OR_INVALID");
  } else if (suppressionLedger.some(entry =>
    (entry.kind === "ITEM_ID" && itemId(row.itemId) && normalizeId(entry.value) === normalizeId(row.itemId)) ||
    (entry.kind === "SOURCE_SHA256" && sha(row.sourcePngSha256) &&
      entry.value.toLowerCase() === row.sourcePngSha256.toLowerCase()) ||
    (entry.kind === "WEBP_SHA256" && sha(row.webpSha256) &&
      entry.value.toLowerCase() === row.webpSha256.toLowerCase()))) {
    reasons.push("ITEM_OR_SHARED_HASH_HIDDEN");
  }
  return { candidate: reasons.length === 0, reasons };
}

// A complaint on one ItemID also identifies other Items referencing the same image bytes.
// This returns a PLAN, not a deletion/invalidation receipt. Unknown targets must not be guessed.
export function planGameImageTakedown(manifestRows, selector) {
  const failed = reason => ({ resolvable: false, reasons: [reason], itemIds: [], hashes: [] });
  if (!Array.isArray(manifestRows) || !selector || !["ITEM_ID", "SOURCE_SHA256", "WEBP_SHA256"].includes(selector.kind))
    return failed("INVALID_MANIFEST_OR_SELECTOR");
  if ((selector.kind === "ITEM_ID" && !itemId(selector.value)) ||
      (selector.kind !== "ITEM_ID" && !sha(selector.value)))
    return failed("INVALID_SELECTOR_VALUE");

  // Index only verifiable join keys. A partially damaged linked row MUST remain
  // discoverable by its intact ItemID or SHA and make the whole plan fail closed.
  const byId = new Map(), byPng = new Map(), byWebp = new Map(), byAnySha = new Map();
  const link = (index, key, rowIndex) => {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(rowIndex);
  };
  for (let i = 0; i < manifestRows.length; i++) {
    const row = manifestRows[i];
    if (!row || typeof row !== "object") continue;
    if (itemId(row.itemId)) link(byId, normalizeId(row.itemId), i);
    if (sha(row.sourcePngSha256)) {
      const hash = row.sourcePngSha256.toLowerCase();
      link(byPng, hash, i);
      link(byAnySha, hash, i);
    }
    if (sha(row.webpSha256)) {
      const hash = row.webpSha256.toLowerCase();
      link(byWebp, hash, i);
      link(byAnySha, hash, i);
    }
  }
  const seed = selector.kind === "ITEM_ID"
    ? byId.get(normalizeId(selector.value))
    : (selector.kind === "SOURCE_SHA256" ? byPng : byWebp).get(selector.value.toLowerCase());
  if (!seed?.length) return failed("MAPPING_MISSING_OR_UNVERIFIED");

  // Traverse the connected component of both image hashes AND ItemID aliases.
  // One pass would miss A(PNG a) -> B(WebP c) -> C(PNG d) -> D.
  const queue = [...seed], queued = new Set(queue), itemIds = new Set(), hashes = new Set();
  const enqueue = values => {
    for (const i of values ?? []) if (!queued.has(i)) {
      queued.add(i);
      queue.push(i);
    }
  };
  for (let pos = 0; pos < queue.length; pos++) {
    const row = manifestRows[queue[pos]];
    if (!row || !itemId(row.itemId) || !sha(row.sourcePngSha256) || !sha(row.webpSha256))
      return failed("LINKED_IMAGE_MAPPING_INCOMPLETE");
    const id = normalizeId(row.itemId);
    const png = row.sourcePngSha256.toLowerCase(), webp = row.webpSha256.toLowerCase();
    itemIds.add(id);
    hashes.add(png);
    hashes.add(webp);
    enqueue(byId.get(id));
    enqueue(byAnySha.get(png));
    enqueue(byAnySha.get(webp));
  }
  return { resolvable: true, reasons: [],
    itemIds: [...itemIds].sort(),
    hashes: [...hashes].sort(),
    actionsRequired: ["HIDE_ITEM_AND_SHARED_HASH", "REMOVE_ORIGIN_DELIVERY", "INVALIDATE_CDN_AND_OLD_URLS",
      "VERIFY_PUBLIC_GET_AND_CACHE_DENIAL", "CHECK_RESTORE_BACKUPS_AND_ROLLBACK"] };
}

// This can demonstrate missing operator evidence; a synthetic positive is NOT real operational QA.
// It returns readyForOperatorReview, NEVER PRODUCT_OPERATION_ENABLED or legal approval.
export function preflightGameImageOperatorReceipt(receipt) {
  const reasons = [];
  if (!receipt || typeof receipt !== "object")
    return { readyForOperatorReview: false, reasons: ["OPERATOR_RECEIPT_MISSING"] };
  if (receipt.ownerDecision !== OWNER_IMAGE_DECISION) reasons.push("OWNER_SCOPE_DECISION_MISSING");
  if (receipt.copyrightLicenceStatus !== "UNKNOWN" && receipt.copyrightLicenceStatus !== "DOCUMENTED")
    reasons.push("COPYRIGHT_LICENCE_STATUS_NOT_DISCLOSED");
  if (receipt.copyrightLicenceStatus === "DOCUMENTED" && !evidence(receipt.copyrightLicenceEvidenceRef))
    reasons.push("CLAIMED_LICENCE_HAS_NO_EVIDENCE");
  const contact = receipt.rightsContact;
  const validContact = contact && typeof contact.url === "string" &&
    (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(contact.url) ||
     /^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/i.test(contact.url));
  if (!validContact || !evidence(contact.verificationEvidenceRef) || contact.tested !== true)
    reasons.push("WORKING_RIGHTS_CONTACT_NOT_PROVED");
  for (const locale of IMAGE_NOTICE_LOCALES) {
    const notice = receipt.locales?.[locale];
    if (!notice || !hasText(notice.text) || notice.humanReviewed !== true ||
        !evidence(notice.reviewEvidenceRef) || !notice.text.includes("Dreamwish Wand"))
      reasons.push("ATTRIBUTION_LOCALE_NOT_REVIEWED:" + locale);
  }
  for (const key of ["noticeIntake", "itemAndHashHide", "originRemoval", "cdnInvalidation",
    "oldUrlAndCacheDenial", "backupRestoreReconciliation", "rollbackRehearsal", "provenanceAudit"]) {
    const check = receipt.controls?.[key];
    if (!check || check.verified !== true || !evidence(check.evidenceRef))
      reasons.push("OPERATOR_CONTROL_NOT_PROVED:" + key);
  }
  if (!evidence(receipt.assetBundleSha256) || !sha(receipt.assetBundleSha256) ||
      !evidence(receipt.assetManifestEvidenceRef)) reasons.push("ASSET_RELEASE_BUNDLE_NOT_PINNED");
  if (!evidence(receipt.deploymentAuthorizationRef))
    reasons.push("EXPLICIT_OPERATOR_DEPLOYMENT_NOT_AUTHORIZED");
  return { readyForOperatorReview: reasons.length === 0, reasons };
}
