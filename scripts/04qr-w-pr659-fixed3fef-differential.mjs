// 04 QR-W independent SOURCE659 repaired-HEAD differential QA. Rights-clean synthetic cases only.
// Inherit old QA661 failures as historical evidence; never rerun old branch or claim actual host/media.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {
  planSoloOwnerEditorialReview,
  planSoloOwnerIssue,
  verifySoloOwnerCaseClosure
} from "../ops/dbk-solo-owner-postpublish.mjs";

const MAIN="c639edc59a93197b1cc11da0cf604a926b5d144d";
const OLD="a45d91c17cc67182709657deda31e387454d0388";
const FIXED="3fef0810aaf54759474afdb77982b165f3869b85";
const sourceFiles=new Map([
  ["docs/rights/dbk-solo-owner-public-correction-20261106.md","069cef7afef42a497c78e4a8c6bf8a61330b46b6"],
  ["ops/dbk-solo-owner-postpublish.mjs","20f6969b51deacb06d82de9fde4f6725b902e228"],
  ["tests/dbk-solo-owner-postpublish.test.mjs","2c89f6c7bed81741d71878a48d3bf17c2617bca7"]
]);
const qaFiles=[
  ".github/workflows/04qr-w-pr659-fixed3fef-differential.yml",
  "scripts/04qr-w-pr659-fixed3fef-differential.mjs"
];
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
const paths=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
const ident={platform:"Nintendo Switch",fullVersion:"1.25.3",bid:"9A239D3DB569756D",schema:626};
const owner={
  kind:"GUIDE_ARTICLE",entityRef:"SYNTHETIC-GUIDE-1",revisionRef:"REV-SYNTHETIC-1",
  ownerControlled:true,rightsBasis:"OWNER_AUTHORED_VERIFIED",
  technicalRightsVerified:true,visibility:"PUBLIC",privacyChecked:true,
  minorPrivate:false,dreamsnapsEmbargo:false,moderationState:"CLEAR",
  withdrawn:false,sourceVersionScoped:true,sourceIdentity:ident,targetIdentity:ident,
  publicHostGateVerified:true,publicAllowlistEvidence:true,
  thirdPartyCreatorMedia:false
};
const issue={issueRef:"CASE-SYNTHETIC-1",entityRef:owner.entityRef,
  observedRevision:owner.revisionRef,kind:"GUIDE_ARTICLE",type:"EDITORIAL_CORRECTION"};
const receipt={
  issueRef:issue.issueRef,entityRef:issue.entityRef,observedRevision:issue.observedRevision,
  ownerDispositionVerified:true,privateEvidenceRef:"SYNTHETIC-DISPOSITION",
  publicGetAndCacheChecked:true,hostEvidenceRef:"SYNTHETIC-HOST",
  rollbackReconciled:true,rollbackEvidenceRef:"SYNTHETIC-ROLLBACK"
};
let fails=0;
function check(mark,run) {
  try{run();console.log("QR659_FIXED3FEF_PASS_"+mark)}
  catch(e){fails++;console.error("QR659_FIXED3FEF_RED_"+mark+": "+e.stack)}
}
check("SOURCE3_PINS_OLD2_DELTA_QA2_ONLY",()=>{
  assert.equal(git("rev-parse",FIXED),FIXED);
  assert.deepEqual(paths(MAIN,FIXED),[...sourceFiles.keys()].sort());
  assert.deepEqual(paths(OLD,FIXED),[
    "ops/dbk-solo-owner-postpublish.mjs",
    "tests/dbk-solo-owner-postpublish.test.mjs"
  ]);
  for(const [path,sha] of sourceFiles)
    assert.equal(git("hash-object",path),sha,path);
  assert.deepEqual(paths(FIXED,"HEAD"),qaFiles);
});
const plan=planSoloOwnerIssue(issue);
check("OLD_RED_MISSING_NEW_REVISION_REJECTED",()=>{
  const z=verifySoloOwnerCaseClosure(plan,receipt);
  assert.equal(z.readyForHumanRecordReview,false);
  assert.ok(z.reasons.includes("CORRECTION_REVISION_INVALID_OR_MISSING"));
  assert.equal(z.publicReleaseAuthorized,false);
  assert.equal(z.operatorActionPerformed,false);
});
check("OLD_RED_MALFORMED_NEW_REVISION_REJECTED",()=>{
  for(const after of [null,"",{},[],42,"bad/unsafe","../traverse",plan.observedRevision]){
    const r=verifySoloOwnerCaseClosure(plan,{...receipt,sourceRevisionAfter:after});
    assert.equal(r.readyForHumanRecordReview,false,JSON.stringify(after));
    const reason=after===plan.observedRevision
      ? "CORRECTION_REVISION_NOT_ADVANCED"
      : "CORRECTION_REVISION_INVALID_OR_MISSING";
    assert.ok(r.reasons.includes(reason),JSON.stringify(after));
    assert.equal(r.publicReleaseAuthorized,false);
  }
});
check("VALID_ADVANCED_CAS_EDITORIAL_RECORD_ONLY",()=>{
  const yes=verifySoloOwnerCaseClosure(plan,{...receipt,sourceRevisionAfter:"REV-SYNTHETIC-2"});
  assert.equal(yes.readyForHumanRecordReview,true);
  assert.equal(yes.publicReleaseAuthorized,false);
  assert.equal(yes.operatorActionPerformed,false);
  assert.equal(verifySoloOwnerCaseClosure(plan,{
    ...receipt,observedRevision:"REV-STALE",sourceRevisionAfter:"REV-SYNTHETIC-2"
  }).readyForHumanRecordReview,false);
});
check("OLD_RED_CREATOR_UNKNOWN_MEDIA_DENIED",()=>{
  for(const unknown of [undefined,null,"",0,1,"false",{},[]]){
    const row={...owner,kind:"CREATOR_WORK"};
    if(unknown!==undefined) row.thirdPartyCreatorMedia=unknown;
    else delete row.thirdPartyCreatorMedia;
    const r=planSoloOwnerEditorialReview(row);
    assert.equal(r.eligible,false,JSON.stringify(unknown));
    assert.ok(r.reasons.includes("CREATOR_MEDIA_PROVENANCE_UNCLASSIFIED"));
    assert.equal(r.publicationAuthorization,"NOT_GRANTED");
  }
});
check("EXPLICIT_CREATOR_PROVENANCE_CONSENT_SEPARATE_GATE",()=>{
  const c={...owner,kind:"CREATOR_WORK",thirdPartyCreatorMedia:false};
  assert.equal(planSoloOwnerEditorialReview(c).eligible,true);
  assert.equal(planSoloOwnerEditorialReview({...c,thirdPartyCreatorMedia:true,creatorConsentVerified:false}).eligible,false);
  const yes=planSoloOwnerEditorialReview({...c,thirdPartyCreatorMedia:true,creatorConsentVerified:true});
  assert.equal(yes.eligible,true);
  assert.equal(yes.publicationAuthorization,"NOT_GRANTED");
});
check("SENSITIVE_QUARANTINE_NO_REVISION_NOT_FALSE_RED",()=>{
  const q=planSoloOwnerIssue({...issue,type:"RIGHTS_NOTICE"});
  const result=verifySoloOwnerCaseClosure(q,{
    ...receipt,quarantineVerified:true,quarantineEvidenceRef:"SYNTHETIC-QUARANTINE"
  });
  assert.equal(result.readyForHumanRecordReview,true);
  assert.equal(result.publicReleaseAuthorized,false);
  assert.equal(result.operatorActionPerformed,false);
  assert.equal(planSoloOwnerIssue({...issue,reporterEmail:"do-not-log@example.invalid"}).publicationAuthorization,"NOT_GRANTED");
});
console.log("QR659_FIXED3FEF_SUMMARY",JSON.stringify({fails,source:FIXED,sourceFiles:3,qaFiles:2,realHost:"NOT_RUN",realMedia:"NOT_RUN"}));
if(fails)process.exitCode=1;
