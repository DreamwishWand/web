// SOURCE_ONLY metadata adapter. Does not grant publication or mutate product flags.
export const LAUNCH_LOCALES = Object.freeze(["en","de","es-ES","fr","it","ja","pt-BR","zh-CN"]);
export const HELP_CHILDREN = Object.freeze(["Questions","Tips","Issues","My Activity"]);
const goodTime = s => typeof s === "string" && Number.isFinite(Date.parse(s));
export function releaseEligible(row, ctx = {}) {
  if (!row || row.releaseEligible !== true || row.rightsDecision !== "APPROVED" ||
      row.moderationDecision !== "CLEAR" || row.correctionState !== "CURRENT" ||
      row.independentQaAccepted !== true || row.sourceIdentityVerified !== true ||
      row.visibility !== "PUBLIC" || row.syntheticTestFixture === true || row.embargoed === true ||
      row.contentKind === "PRIVATE_ISSUE_REPORT") return false;
  if (!LAUNCH_LOCALES.includes(ctx.locale) || !Array.isArray(row.localeReviewed) ||
      !row.localeReviewed.includes(ctx.locale)) return false;
  if (row.dlcRequired && row.dlcVerified !== true) return false;
  if (row.usesMedia && row.mediaRightsVerified !== true) return false;
  if (["VERSION_SCOPED","LIVE_24H"].includes(row.freshnessClass)) {
    if (!row.sourceVersion || !ctx.sourceVersion ||
        row.sourceVersion.platform !== ctx.sourceVersion.platform ||
        row.sourceVersion.fullVersion !== ctx.sourceVersion.fullVersion ||
        row.sourceVersion.bid !== ctx.sourceVersion.bid) return false;
  }
  if (row.freshnessClass === "LIVE_24H") {
    if (!goodTime(row.verifiedAt) || !goodTime(row.expiresAt) || !goodTime(ctx.asOf)) return false;
    const now = Date.parse(ctx.asOf), verified = Date.parse(row.verifiedAt), expiry = Date.parse(row.expiresAt);
    if (verified > now || now - verified > 86_400_000 || expiry <= now) return false;
  }
  if (row.freshnessClass === "ROUND_PHASE" && row.signedRoundPhaseAccepted !== true) return false;
  if (row.freshnessClass === "UGC_SIGNED" && row.signedPublicationAccepted !== true) return false;
  return true;
}
export function publicSearchEntries(rows, context) {
  return rows.filter(row => releaseEligible(row, context)).map(row => ({
    jobId: row.jobId, contentKind: row.contentKind,
    canonicalEntityId: row.canonicalEntityId ?? null,
    sourceVersion: row.sourceVersion ?? null
  })); // Never forward raw body, private evidence URLs, media keys, reporter identity.
}
export function publicEmptyState(rows, context) {
  const visible = publicSearchEntries(rows, context);
  return { visible, empty: visible.length === 0, statusKey: visible.length ? "verified_results" : "no_verified_results",
    personalEmptyAllowed: false };
}
