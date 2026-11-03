import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {releaseEligible,publicSearchEntries,publicEmptyState,LAUNCH_LOCALES} from "../scripts/dbk-rc-seed-contract.mjs";
const meta=JSON.parse(readFileSync(new URL("../docs/knowledge/rc-job-content-delta-20261103.json",import.meta.url),"utf8"));
const ver=meta.sourceVersionBaseline;
const ctx={asOf:"2026-11-03T12:00:00Z",locale:"ja",sourceVersion:ver};
const signed={jobId:"GDE-SYS",contentKind:"CURATED_GUIDE_CONTENT",releaseEligible:true,
 publicIndexEligible:true,sourceIdentityVerified:true,visibility:"PUBLIC",
 rightsDecision:"APPROVED",moderationDecision:"CLEAR",correctionState:"CURRENT",
 independentQaAccepted:true,syntheticTestFixture:false,embargoed:false,
 updatedAtActual:"2026-11-03T09:00:00Z",localeReviewed:["ja"],
 sourceVersion:ver,freshnessClass:"VERSION_SCOPED"};
const denial=(r,c=ctx)=>assert.equal(releaseEligible(r,c),false,"Unverified metadata released "+JSON.stringify({freshnessClass:r.freshnessClass,version:r.sourceVersion}));
test("QR340 actual source inventory remains metadata-only and never public by default",()=>{
 assert.equal(meta.jobs.length,14);
 assert.equal(meta.seedGates.length,7);
 assert.equal(meta.humanGates.length,7);
 assert.equal(meta.articleEvidence.publicApproved,0);
 assert.equal(meta.articleEvidence.rightsSigned,0);
 for(const row of meta.jobs)assert.equal(releaseEligible(row,ctx),false);
 for(const locale of LAUNCH_LOCALES)assert.deepEqual(publicSearchEntries(meta.jobs,{...ctx,locale}),[]);
 assert.ok(meta.seedGates.every(g=>g.publicAcceptance==="BLOCKED"));
});
test("QR340 additional negative: unknown freshness enum must fail closed",()=>{
 assert.equal(releaseEligible(signed,ctx),true,"positive control fixture");
 denial({...signed,freshnessClass:"UNKNOWN_FUTURE_CLASS"});
 denial({...signed,freshnessClass:""});
 denial({...signed,freshnessClass:null});
});
test("QR340 additional negative: same BID/version but different schema is NOT the same source",()=>{
 assert.equal(releaseEligible(signed,ctx),true,"positive control fixture");
 denial({...signed,sourceVersion:{...ver,schema:626}});
 denial({...signed,sourceVersion:{...ver,schema:null}});
});
test("QR340 independent privacy and prior-condition denials",()=>{
 denial({...signed,localeReviewed:["en"]});
 denial({...signed,rightsDecision:null});
 denial({...signed,moderationDecision:"PENDING"});
 denial({...signed,independentQaAccepted:false});
 denial({...signed,visibility:"PRIVATE"});
 denial({...signed,embargoed:true});
 denial({...signed,syntheticTestFixture:true});
 denial({...signed,publicIndexEligible:false,releaseEligible:false});
 const privateRow={...signed,contentKind:"PRIVATE_ISSUE_REPORT",canonicalEntityId:"secret",privateBody:"no",reporterId:"private"};
 denial(privateRow);
 assert.deepEqual(publicSearchEntries([privateRow],ctx),[]);
 const out=publicSearchEntries([{...signed,canonicalEntityId:"visible",privateBody:"never",reporterId:"never",storageKey:"secret"}],ctx);
 assert.equal(out.length,1);
 for(const attr of ["privateBody","reporterId","storageKey"])assert.ok(!Object.hasOwn(out[0],attr));
 assert.equal(publicEmptyState(meta.jobs,ctx).personalEmptyAllowed,false);
});
