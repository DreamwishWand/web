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

// A restored ledger with duplicate aliases is ambiguous even when every
// individual row is well-formed. ItemID numbers/strings, SHA letter case, and
// identical values within one kind must not bypass the accepted HIDDEN record.
// Different hash kinds remain independent typed keys (PNG versus WebP).
function duplicateImageSuppressionKey(ledger) {
  if (!Array.isArray(ledger)) return false;
  const seen = new Set();
  for (const entry of ledger) {
    if (!entry || !["ITEM_ID","SOURCE_SHA256","WEBP_SHA256"].includes(entry.kind) ||
        !(entry.kind === "ITEM_ID" ? itemId(entry.value) : sha(entry.value))) continue;
    const key = entry.kind + ":" + (entry.kind === "ITEM_ID"
      ? normalizeId(entry.value) : entry.value.toLowerCase());
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
// A suppression ledger is authoritative only if valid and unambiguous.
// Never treat corrupt/absent/duplicate ledger entries as empty.
export function validateImageSuppressionLedger(ledger) {
  return Array.isArray(ledger) && ledger.every(entry =>
    entry && entry.state === "HIDDEN" && evidence(entry.incidentRef) &&
    ((entry.kind === "ITEM_ID" && itemId(entry.value)) ||
     (entry.kind === "SOURCE_SHA256" && sha(entry.value)) ||
     (entry.kind === "WEBP_SHA256" && sha(entry.value)))) &&
    !duplicateImageSuppressionKey(ledger);
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

// Turn an already-resolved shared-derivative closure into a COMPLETE,
// deterministic, append-only HIDDEN ledger proposal. This is an inert packet,
// not a storage write, CDN purge, deployment receipt or publication decision.
// In particular, never hide only the initially selected ItemID while leaving
// aliases of a shared PNG/WebP exposed after an old backup is restored.
export function prepareGameImageTakedownSuppression(manifestRows, selector, existingLedger, incidentRef) {
  const failed = reason => ({ prepared: false, reasons: [reason] });
  if (!validateImageSuppressionLedger(existingLedger))
    return failed(duplicateImageSuppressionKey(existingLedger)
      ? "EXISTING_SUPPRESSION_LEDGER_DUPLICATE" : "EXISTING_SUPPRESSION_LEDGER_INVALID");
  if (!steamEvidence(incidentRef) || /^(?:NOT_VERIFIED|RESTORED)$/i.test(incidentRef))
    return failed("TAKEDOWN_INCIDENT_EVIDENCE_INVALID");
  const plan = planGameImageTakedown(manifestRows, selector);
  if (!plan.resolvable)
    return failed(plan.reasons[0] ?? "TAKEDOWN_PLAN_UNRESOLVABLE");
  const order = { ITEM_ID: 0, SOURCE_SHA256: 1, WEBP_SHA256: 2 };
  const normalized = (kind, value) => kind === "ITEM_ID" ? normalizeId(value) : value.toLowerCase();
  const key = (kind, value) => kind + ":" + normalized(kind, value);
  const seen = new Set(), prepared = new Map();
  for (const entry of existingLedger) {
    const k = key(entry.kind, entry.value);
    if (seen.has(k)) return failed("EXISTING_SUPPRESSION_LEDGER_DUPLICATE");
    seen.add(k);
    prepared.set(k, Object.freeze({ kind: entry.kind, value: normalized(entry.kind, entry.value),
      state: "HIDDEN", incidentRef: entry.incidentRef }));
  }
  const add = (kind, value) => {
    const k = key(kind, value);
    if (!prepared.has(k))
      prepared.set(k, Object.freeze({ kind, value: normalized(kind, value),
        state: "HIDDEN", incidentRef }));
  };
  const affected = new Set(plan.itemIds);
  for (const item of plan.itemIds) add("ITEM_ID", item);
  for (const row of manifestRows) {
    if (!row || !itemId(row.itemId) || !affected.has(normalizeId(row.itemId))) continue;
    // The resolver proved all reachable linked rows complete. Revalidate at
    // staging rather than silently invent a cross-kind or missing digest.
    if (!sha(row.sourcePngSha256) || !sha(row.webpSha256))
      return failed("LINKED_IMAGE_MAPPING_INCOMPLETE");
    add("SOURCE_SHA256", row.sourcePngSha256);
    add("WEBP_SHA256", row.webpSha256);
  }
  const entries = [...prepared.values()].sort((a, b) =>
    order[a.kind] - order[b.kind] || a.value.localeCompare(b.value));
  if (!validateImageSuppressionLedger(entries))
    return failed("PREPARED_SUPPRESSION_LEDGER_INVALID");
  return {
    prepared: true, reasons: [], itemIds: plan.itemIds, hashes: plan.hashes,
    suppressionLedger: Object.freeze(entries),
    additions: entries.length - existingLedger.length,
    actionsRequired: plan.actionsRequired
  };
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
  // A mailto link is one literal address, never a headers/query/fragment URI
  // (including bcc), a recipient list, or an encoded header separator.
  const validContact = contact && typeof contact.url === "string" &&
    (/^mailto:[A-Za-z0-9._+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$/.test(contact.url) ||
     /^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/i.test(contact.url));
  // This evidence refers to precisely one actually received/replied Owner inbox.
  // A valid-looking foreign contact must never reuse its verification receipt;
  // likewise the Owner address must not be presented with unrelated evidence.
  const ownerMail = "mailto:support@dreamwishwand.com";
  const ownerProof = "E-07DBK-20261117-ACT419-SUPPORT-LIVE-INBOUND-OUTBOUND-SCOPED-PASS";
  const ownerPairBound = (contact?.url === ownerMail) ===
    (contact?.verificationEvidenceRef === ownerProof);
  if (!validContact || !ownerPairBound ||
      !evidence(contact.verificationEvidenceRef) || contact.tested !== true)
    reasons.push("WORKING_RIGHTS_CONTACT_NOT_PROVED");
  // Latest Owner decision: DDV player-visible game images need all eight
  // actual attribution copies, but NOT eight human translation sign-offs.
  // Preserve honest optional review metadata: false/null is unreviewed, never
  // pretend that machine text checks are a human approval. Other per-image
  // rights, provenance, HIDDEN, contact and live delivery controls are unchanged.
  for (const locale of IMAGE_NOTICE_LOCALES) {
    const notice = receipt.locales?.[locale];
    const reviewMetadataValid = notice?.humanReviewed === false
      ? notice.reviewEvidenceRef == null
      : notice?.humanReviewed === true && evidence(notice.reviewEvidenceRef);
    if (!notice || !hasText(notice.text) || !notice.text.includes("Dreamwish Wand") ||
        !reviewMetadataValid)
      reasons.push("ATTRIBUTION_LOCALE_COPY_OR_RECEIPT_INVALID:" + locale);
  }
  for (const key of ["noticeIntake", "itemAndHashHide", "originRemoval", "cdnInvalidation",
    "oldUrlAndCacheDenial", "backupRestoreReconciliation", "rollbackRehearsal", "provenanceAudit"]) {
    const check = receipt.controls?.[key];
    if (!check || check.verified !== true || !evidence(check.evidenceRef))
      reasons.push("OPERATOR_CONTROL_NOT_PROVED:" + key);
  }
  // Do not treat a missing or stale restore of the HIDDEN ItemID/shared-hash
  // ledger as a verified empty ledger. Even all eight operator checkboxes
  // cannot replace the independently validated suppression source.
  const suppressionProvenance = receipt.suppressionLedgerProvenance;
  if (!validateImageSuppressionLedger(receipt.suppressionLedger) ||
      typeof suppressionProvenance !== "string" ||
      suppressionProvenance !== suppressionProvenance.trim() ||
      !evidence(suppressionProvenance) ||
      /^(?:UNKNOWN|NOT_RUN|NOT_VERIFIED)$/i.test(suppressionProvenance) ||
      /[\p{Cc}\p{Cf}]/u.test(suppressionProvenance))
    reasons.push("SUPPRESSION_LEDGER_OR_PROVENANCE_NOT_VERIFIED");
  if (!evidence(receipt.assetBundleSha256) || !sha(receipt.assetBundleSha256) ||
      !evidence(receipt.assetManifestEvidenceRef)) reasons.push("ASSET_RELEASE_BUNDLE_NOT_PINNED");
  if (!evidence(receipt.deploymentAuthorizationRef))
    reasons.push("EXPLICIT_OPERATOR_DEPLOYMENT_NOT_AUTHORIZED");
  return { readyForOperatorReview: reasons.length === 0, reasons };
}
