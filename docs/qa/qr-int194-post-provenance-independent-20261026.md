# 04 QR — INT194 Post-Provenance-Fix Independent Acceptance (2026-10-26)

**DRAFT · DO_NOT_MERGE · DO_NOT_DEPLOY · SOURCE ONLY.**

Workstream: existing 04 QR. Owner: INT PR194 on repaired WEB PR192 `d509c3f5d9b80f97a0ffabc8888f50541b994549`. Target Nintendo Switch v1.25.0, BID `52BD625D9B4E0053` only. Switch v1.25.3/schema626 and Steam not adopted.

**Historical witness preserved unchanged:** QR PR196 HEAD `d644647b9b35765e19e91d2e11ee3c4562e5314b` includes exported helper adversarial link RED `QR_INT194_RED_DIRECT_UNVERIFIED_MANUAL_INDEX_RECORDS_LINKED` and fabricated relation/Guide registry RED. Its earlier 11 cases and QR193 RED remain independent historical data. Do not repurpose or replay those old tests.

This separate post-fix QA branch contains one new-focused six-case suite:
1. **Positive:** actual raw-hash-pinned Loader completes all 18 Shards/12,552 unique ItemIDs, issues an opaque capability, supports identical ItemID Collection→Explore, Explore→Collection, inbound.
2. **Negative:** raw direct helper with forged Index/Rows, copy/proxy capability, valid-looking BID or `verified` flags never mints a link.
3. **Negative/positive:** partial Rows, post-fetch mutations, duplicate/forged ItemID and manipulated Index do not mint authority; canonical verified snapshot remains usable, conflicting optional caller records denied.
4. **Negative:** foreign Build/Version/Identity Kind, absent ItemID, malformed/foreign Explore query denied.
5. **Negative:** even with genuine Collection capability, caller-supplied Tag/Set reviewed arrays and Guide approval pages cannot produce a positive link. The registries remain unissued/unpublished.
6. **Actual routes, static-only:** Collection and Explore both source capability from canonical Loader; Collection broken URL guards and retry generation preserved; no Related/Guide caller, no ownership/entitlement/image rights/native placement asserted.

Dedicated GitHub Actions workflow runs *only these six new checks*, Node22/checked-in static seed, no Chrome, no actor, no Supabase/Storage or Community writer operations. It does not repeat QR196 historical 11 cases, QR193, WEB Chrome10/10, INT Chrome7/7 or Source142 QA.

**Acceptance is conditional on exact latest Owner INT194 HEAD, dedicated CI SUCCESS, caller/provenance compatibility and ordinary CI.** Must record those after runs. Known nonacceptance: signed Provider/normal JWTs, personal Owned/Discovered, production Guide review/rights, Stage, World Native Placement, Operator Gates A/B/C, Community or full Product Tree. Release R17 remains PASS0/PARTIAL12/BLOCKED18. No formal R18/R19.
