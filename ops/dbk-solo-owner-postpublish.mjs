// 07 DBK / W-RIGHTS-015 — one-owner post-publication editorial and issue intake.
// PURE SOURCE-ONLY planning. Never performs publication, authorization, upload, hide or CDN calls.
// Owner 2026-11-06: editorial review may follow eligible publication. Technical Rights/Privacy gates do not.
import {planGameImageTakedown} from "./ddv-item-image-operator-gate.mjs";

export const SOLO_OWNER_EDITORIAL_MODE = "SOLO_OWNER_POST_PUBLISH_CORRECTION";
const KINDS = new Set(["GUIDE_ARTICLE", "HELP_ISSUE", "ITEM_IMAGE", "CREATOR_WORK"]);
const TYPES = new Set(["EDITORIAL_CORRECTION", "BROKEN_SOURCE", "RIGHTS_NOTICE",
  "PRIVACY_NOTICE", "MODERATION_REPORT", "WITHDRAWAL"]);
const REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ref = s => typeof s === "string" && REF.test(s);
const identity = s => s && typeof s.platform === "string" && s.platform.length > 0 &&
  typeof s.fullVersion === "string" && s.fullVersion.length > 0 &&
  typeof s.bid === "string" && s.bid.length > 0 &&
  Number.isSafeInteger(s.schema) && s.schema >= 0;
const sameIdentity = (a,b) => identity(a) && identity(b) && a.platform === b.platform &&
  a.fullVersion === b.fullVersion && a.bid === b.bid && a.schema === b.schema;
const failed = reason => ({eligible:false,editorialMode:"HOLD_TECHNICAL",reasons:[reason],
  publicationAuthorization:"NOT_GRANTED"});

// Owner's editorial review timing changes ONLY for content whose technical eligibility was
// established elsewhere. This is not a competing 08 WEB public allowlist.
export function planSoloOwnerEditorialReview(row) {
  if (!row || !KINDS.has(row.kind) || !ref(row.entityRef) || !ref(row.revisionRef))
    return failed("MISSING_TYPED_ENTITY_OR_REVISION");
  if (row.kind === "ITEM_IMAGE") return failed("IMAGE_ASSET_NEEDS_SEPARATE_OPERATOR_AND_SOURCE_GATES");
  const reasons = [];
  if (row.ownerControlled !== true || row.rightsBasis !== "OWNER_AUTHORED_VERIFIED")
    reasons.push("NOT_VERIFIED_OWNER_AUTHORED_RIGHTS");
  if (row.technicalRightsVerified !== true) reasons.push("RIGHTS_TECHNICAL_NOT_VERIFIED");
  if (row.visibility !== "PUBLIC" || row.privacyChecked !== true ||
      row.minorPrivate === true || row.dreamsnapsEmbargo === true)
    reasons.push("PRIVACY_OR_EMBARGO_NOT_CLEARED");
  if (row.moderationState !== "CLEAR" || row.withdrawn === true)
    reasons.push("MODERATION_OR_WITHDRAWAL_NOT_CLEARED");
  if (row.sourceVersionScoped === true && !sameIdentity(row.sourceIdentity,row.targetIdentity))
    reasons.push("EXACT_PLATFORM_VERSION_BID_SCHEMA_UNVERIFIED");
  if (row.thirdPartyCreatorMedia === true && row.creatorConsentVerified !== true)
    reasons.push("THIRD_PARTY_CREATOR_CONSENT_MISSING");
  if (row.publicHostGateVerified !== true || row.publicAllowlistEvidence !== true)
    reasons.push("PUBLIC_HOST_OR_ALLOWLIST_NOT_ACCEPTED");
  return {eligible:reasons.length===0,
    editorialMode:reasons.length===0 ? SOLO_OWNER_EDITORIAL_MODE : "HOLD_TECHNICAL",
    reasons, publicationAuthorization:"NOT_GRANTED"};
}

// A complaint's free-text, reporter identity and contact NEVER appear in this return value.
// Owner-only operations are expressed as plans; other stream's privileged runtime owns execution.
export function planSoloOwnerIssue(input) {
  const fail = reason => ({valid:false,decision:"MANUAL_REVIEW_NO_AUTOMATION",
    reasons:[reason],requires:[],publicationAuthorization:"NOT_GRANTED"});
  if (!input || !ref(input.issueRef) || !ref(input.entityRef) ||
      !ref(input.observedRevision) || !KINDS.has(input.kind) || !TYPES.has(input.type))
    return fail("INVALID_OR_MISSING_CASE_IDENTITY");
  const sensitive = ["RIGHTS_NOTICE","PRIVACY_NOTICE","MODERATION_REPORT","WITHDRAWAL"].includes(input.type);
  const requires = ["OWNER_LOCAL_CASE_LEDGER", "NO_REPORTER_PII_IN_PUBLIC_LOGS",
    "OBSERVED_REVISION_CAS_BEFORE_CHANGE", "RECORDED_OWNER_DISPOSITION",
    "VERIFY_PUBLIC_URL_AND_OLD_CACHES", "RECONCILE_ROLLBACK_RESTORE"];
  if (sensitive) requires.push("SUSPEND_PUBLIC_TARGET_PENDING_VERIFIED_OPERATOR_ACTION");
  else requires.push("DRAFT_SCOPED_REVISION_AND_RECHECK_RIGHTS_PRIVACY_SOURCE");
  let imageScope = null;
  if (input.kind === "ITEM_IMAGE" && sensitive) {
    imageScope = planGameImageTakedown(input.manifestRows,input.imageSelector);
    if (!imageScope.resolvable)
      requires.push("FAIL_CLOSED_UNKNOWN_IMAGE_ALIAS_SCOPE_MANUAL_QUARANTINE");
    else requires.push("HIDE_ALL_LINKED_ITEM_IDS_AND_SHA", "ORIGIN_AND_CDN_OLD_URL_INVALIDATION",
      "RECHECK_ALL_LINKED_PUBLIC_ENDPOINTS");
  }
  const reason = imageScope?.resolvable === false ? ["IMAGE_LINKAGE_NOT_VERIFIED"] : [];
  return {valid:true,issueRef:input.issueRef,entityRef:input.entityRef,
    observedRevision:input.observedRevision,kind:input.kind,type:input.type,
    decision:sensitive ? "OWNER_QUARANTINE_FIRST" : "OWNER_EDITORIAL_CORRECTION_QUEUE",
    requires, imageScope,
    reasons:reason, retention:"APPLY_EXISTING_CATEGORY_POLICY_AND_HOLDS",
    publicationAuthorization:"NOT_GRANTED", automationPerformed:false};
}

export function verifySoloOwnerCaseClosure(plan,receipt) {
  const reasons=[];
  if (!plan?.valid || !receipt || receipt.issueRef !== plan.issueRef ||
      receipt.entityRef !== plan.entityRef ||
      receipt.observedRevision !== plan.observedRevision)
    reasons.push("CASE_OR_CAS_MISMATCH");
  if (receipt?.ownerDispositionVerified !== true || !ref(receipt?.privateEvidenceRef))
    reasons.push("OWNER_DISPOSITION_EVIDENCE_MISSING");
  if (receipt?.publicGetAndCacheChecked !== true || !ref(receipt?.hostEvidenceRef))
    reasons.push("REAL_HOST_AND_OLD_CACHE_PROOF_MISSING");
  if (receipt?.rollbackReconciled !== true || !ref(receipt?.rollbackEvidenceRef))
    reasons.push("RESTORE_RECONCILIATION_MISSING");
  if (plan?.decision === "OWNER_QUARANTINE_FIRST" &&
      (receipt?.quarantineVerified !== true || !ref(receipt?.quarantineEvidenceRef)))
    reasons.push("QUARANTINE_NOT_VERIFIED");
  if (plan?.kind === "ITEM_IMAGE" && plan?.decision === "OWNER_QUARANTINE_FIRST" &&
      (!plan?.imageScope?.resolvable || receipt?.cdnInvalidationVerified !== true ||
        !ref(receipt?.cdnEvidenceRef)))
    reasons.push("IMAGE_CDN_AND_LINKED_SCOPE_NOT_VERIFIED");
  if (receipt?.sourceRevisionAfter && receipt.sourceRevisionAfter === receipt.observedRevision)
    reasons.push("CORRECTION_REVISION_NOT_ADVANCED");
  return {readyForHumanRecordReview:reasons.length===0,reasons,
    publicReleaseAuthorized:false,operatorActionPerformed:false};
}
