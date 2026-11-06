import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planSoloOwnerEditorialReview,planSoloOwnerIssue,verifySoloOwnerCaseClosure,
  SOLO_OWNER_EDITORIAL_MODE} from "../ops/dbk-solo-owner-postpublish.mjs";

const ident={platform:"Nintendo Switch",fullVersion:"1.25.3",bid:"9A239D3DB569756D",schema:626};
const owner={
 kind:"GUIDE_ARTICLE",entityRef:"GUIDE-SYNTHETIC-01",revisionRef:"REV-SYNTHETIC-02",
 ownerControlled:true,rightsBasis:"OWNER_AUTHORED_VERIFIED",technicalRightsVerified:true,
 visibility:"PUBLIC",privacyChecked:true,minorPrivate:false,dreamsnapsEmbargo:false,
 moderationState:"CLEAR",withdrawn:false,sourceVersionScoped:true,
 sourceIdentity:ident,targetIdentity:ident,thirdPartyCreatorMedia:false,
 publicHostGateVerified:true,publicAllowlistEvidence:true
};
const issue={
 issueRef:"CASE-SYNTHETIC-11",entityRef:"GUIDE-SYNTHETIC-01",
 observedRevision:"REV-SYNTHETIC-02",kind:"GUIDE_ARTICLE",type:"EDITORIAL_CORRECTION"
};
const digest=c=>c.repeat(64);

test("eligible owner-authored content can use post-publication editorial queue, not auto-publication",()=>{
 const result=planSoloOwnerEditorialReview(owner);
 assert.equal(result.eligible,true);
 assert.equal(result.editorialMode,SOLO_OWNER_EDITORIAL_MODE);
 assert.equal(result.publicationAuthorization,"NOT_GRANTED");
 assert.equal(Object.keys(result).includes("publicEnabled"),false);
});

test("unknown Rights, native schema, unverified public allowlist and privacy independently fail closed",()=>{
 const cases=[
  [{...owner,technicalRightsVerified:false},"RIGHTS_TECHNICAL_NOT_VERIFIED"],
  [{...owner,rightsBasis:"UNKNOWN"},"NOT_VERIFIED_OWNER_AUTHORED_RIGHTS"],
  [{...owner,sourceIdentity:{...ident,schema:624}},"EXACT_PLATFORM_VERSION_BID_SCHEMA_UNVERIFIED"],
  [{...owner,targetIdentity:{...ident,bid:"WRONG"}},"EXACT_PLATFORM_VERSION_BID_SCHEMA_UNVERIFIED"],
  [{...owner,privacyChecked:false},"PRIVACY_OR_EMBARGO_NOT_CLEARED"],
  [{...owner,minorPrivate:true},"PRIVACY_OR_EMBARGO_NOT_CLEARED"],
  [{...owner,dreamsnapsEmbargo:true},"PRIVACY_OR_EMBARGO_NOT_CLEARED"],
  [{...owner,moderationState:"HOLD"},"MODERATION_OR_WITHDRAWAL_NOT_CLEARED"],
  [{...owner,publicAllowlistEvidence:false},"PUBLIC_HOST_OR_ALLOWLIST_NOT_ACCEPTED"],
  [{...owner,publicHostGateVerified:false},"PUBLIC_HOST_OR_ALLOWLIST_NOT_ACCEPTED"],
  [{...owner,kind:"CREATOR_WORK",thirdPartyCreatorMedia:true,creatorConsentVerified:false},
    "THIRD_PARTY_CREATOR_CONSENT_MISSING"]
 ];
 for(const [input,reason] of cases){
  const result=planSoloOwnerEditorialReview(input);
  assert.equal(result.eligible,false,reason);
  assert.ok(result.reasons.includes(reason),reason);
  assert.equal(result.publicationAuthorization,"NOT_GRANTED");
 }
});

test("image asset and missing typed source cannot enter editorial-first public mode",()=>{
 assert.equal(planSoloOwnerEditorialReview({...owner,kind:"ITEM_IMAGE"}).eligible,false);
 assert.equal(planSoloOwnerEditorialReview({...owner,revisionRef:null}).eligible,false);
 assert.equal(planSoloOwnerEditorialReview(null).eligible,false);
});

test("editorial intake minimizes reporter text, does not publish or mutate a source",()=>{
 const result=planSoloOwnerIssue({...issue,reporterEmail:"sensitive@example.invalid",
   rawComplaint:"PRIVATE DETAILS MUST NOT APPEAR",fullSourceSave:"DO NOT LOG"});
 assert.equal(result.valid,true);
 assert.equal(result.decision,"OWNER_EDITORIAL_CORRECTION_QUEUE");
 assert.equal(result.automationPerformed,false);
 assert.equal(result.publicationAuthorization,"NOT_GRANTED");
 assert.ok(result.requires.includes("OBSERVED_REVISION_CAS_BEFORE_CHANGE"));
 assert.ok(!JSON.stringify(result).includes("sensitive@example.invalid"));
 assert.ok(!JSON.stringify(result).includes("PRIVATE DETAILS MUST NOT APPEAR"));
 assert.equal(result.retention,"APPLY_EXISTING_CATEGORY_POLICY_AND_HOLDS");
});

test("rights/privacy/moderation/withdrawal reports require quarantine first, no automatic action",()=>{
 for(const type of ["RIGHTS_NOTICE","PRIVACY_NOTICE","MODERATION_REPORT","WITHDRAWAL"]){
  const result=planSoloOwnerIssue({...issue,type});
  assert.equal(result.decision,"OWNER_QUARANTINE_FIRST");
  assert.ok(result.requires.includes("SUSPEND_PUBLIC_TARGET_PENDING_VERIFIED_OPERATOR_ACTION"));
  assert.equal(result.automationPerformed,false);
 }
 assert.equal(planSoloOwnerIssue({...issue,issueRef:"bad/unsafe"}).valid,false);
 assert.equal(planSoloOwnerIssue({...issue,type:"UNKNOWN"}).valid,false);
});

test("image rights notice reuses accepted connected-component plan and denies malformed aliases",()=>{
 const A={itemId:"40000041",sourcePngSha256:digest("a"),webpSha256:digest("b")};
 const B={itemId:"40000042",sourcePngSha256:digest("a"),webpSha256:digest("c")};
 const C={itemId:"40000043",sourcePngSha256:digest("d"),webpSha256:digest("c")};
 const D={itemId:"40000044",sourcePngSha256:digest("d"),webpSha256:digest("e")};
 const U={itemId:"40000045",sourcePngSha256:digest("f"),webpSha256:digest("1")};
 const itemCase={...issue,kind:"ITEM_IMAGE",type:"RIGHTS_NOTICE",entityRef:"ITEM-40000041",
   manifestRows:[A,B,C,D,U],imageSelector:{kind:"ITEM_ID",value:A.itemId}};
 const plan=planSoloOwnerIssue(itemCase);
 assert.deepEqual(plan.imageScope.itemIds,[A,B,C,D].map(x=>x.itemId));
 assert.deepEqual(plan.imageScope.hashes,["a","b","c","d","e"].map(digest));
 assert.ok(plan.requires.includes("ORIGIN_AND_CDN_OLD_URL_INVALIDATION"));
 assert.ok(!plan.imageScope.itemIds.includes(U.itemId));
 const bad=planSoloOwnerIssue({...itemCase,manifestRows:[A,{...B,webpSha256:"UNVERIFIED"},U]});
 assert.equal(bad.imageScope.resolvable,false);
 assert.ok(bad.reasons.includes("IMAGE_LINKAGE_NOT_VERIFIED"));
 assert.ok(bad.requires.includes("FAIL_CLOSED_UNKNOWN_IMAGE_ALIAS_SCOPE_MANUAL_QUARANTINE"));
 assert.equal(bad.publicationAuthorization,"NOT_GRANTED");
});

test("case closure needs owner receipts, real host/cache, rollback and quarantine before record review",()=>{
 const plan=planSoloOwnerIssue({...issue,type:"PRIVACY_NOTICE"});
 const missing=verifySoloOwnerCaseClosure(plan,{issueRef:plan.issueRef,entityRef:plan.entityRef,
  observedRevision:plan.observedRevision});
 assert.equal(missing.readyForHumanRecordReview,false);
 assert.ok(missing.reasons.includes("REAL_HOST_AND_OLD_CACHE_PROOF_MISSING"));
 assert.ok(missing.reasons.includes("QUARANTINE_NOT_VERIFIED"));
 const fake={issueRef:plan.issueRef,entityRef:plan.entityRef,observedRevision:plan.observedRevision,
  ownerDispositionVerified:true,privateEvidenceRef:"SYNTHETIC-OWNER-REF",
  publicGetAndCacheChecked:true,hostEvidenceRef:"SYNTHETIC-HOST-REF",
  rollbackReconciled:true,rollbackEvidenceRef:"SYNTHETIC-ROLLBACK-REF",
  quarantineVerified:true,quarantineEvidenceRef:"SYNTHETIC-QUARANTINE-REF",
  sourceRevisionAfter:"REV-SYNTHETIC-03"};
 const yes=verifySoloOwnerCaseClosure(plan,fake);
 assert.equal(yes.readyForHumanRecordReview,true);
 assert.equal(yes.publicReleaseAuthorized,false);
 assert.equal(yes.operatorActionPerformed,false);
 assert.equal(verifySoloOwnerCaseClosure(plan,{...fake,observedRevision:"OLD"}).readyForHumanRecordReview,false);
 assert.equal(verifySoloOwnerCaseClosure(plan,{...fake,sourceRevisionAfter:fake.observedRevision}).readyForHumanRecordReview,false);
});

test("image takedown closure cannot be claimed without linked image + actual CDN receipt",()=>{
 const row={itemId:"40000041",sourcePngSha256:digest("a"),webpSha256:digest("b")};
 const plan=planSoloOwnerIssue({...issue,kind:"ITEM_IMAGE",type:"RIGHTS_NOTICE",
   manifestRows:[row],imageSelector:{kind:"ITEM_ID",value:row.itemId}});
 const fake={issueRef:plan.issueRef,entityRef:plan.entityRef,observedRevision:plan.observedRevision,
  ownerDispositionVerified:true,privateEvidenceRef:"SYNTHETIC-REF",
  publicGetAndCacheChecked:true,hostEvidenceRef:"SYNTHETIC-REF",
  rollbackReconciled:true,rollbackEvidenceRef:"SYNTHETIC-REF",
  quarantineVerified:true,quarantineEvidenceRef:"SYNTHETIC-REF"};
 assert.equal(verifySoloOwnerCaseClosure(plan,fake).readyForHumanRecordReview,false);
 assert.ok(verifySoloOwnerCaseClosure(plan,fake).reasons.includes("IMAGE_CDN_AND_LINKED_SCOPE_NOT_VERIFIED"));
 assert.equal(verifySoloOwnerCaseClosure(plan,{...fake,cdnInvalidationVerified:true,cdnEvidenceRef:"SYNTHETIC-CDN-REF"}).readyForHumanRecordReview,true);
});

test("existing 8-language game-art packet stays OFF, unreviewed and without invented contact",()=>{
 const existing=JSON.parse(readFileSync(new URL("../ops/ddv-item-image-operator-readiness-template.json",import.meta.url),"utf8"));
 assert.equal(existing.publicationState,"OFF");
 assert.equal(existing.rightsContact,null);
 assert.equal(existing.copyrightLicenceStatus,"UNKNOWN");
 assert.equal(Object.keys(existing.locales).length,8);
 assert.ok(Object.values(existing.locales).every(x=>x.humanReviewed===false));
});
