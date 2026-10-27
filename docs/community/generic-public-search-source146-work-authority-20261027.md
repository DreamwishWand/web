# 03 COMM Source146 / Issue #228 — Generic Public Search Work Authority

**DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.** This is a proposed Owner SQL repair, not an independent QA finding or live incident. No Staging, external Provider, Storage, signed media, Cloud, cleanup or Native DDV writer operation is authorized here.

## Trigger / independent RED

04 QR independent Draft PR [#229](https://github.com/DreamwishWand/web/pull/229), final exact QR HEAD `3ead27d49e6e498ef5db563eda19858da13a585b` based on existing 03 COMM Source145 Owner PR [#225](https://github.com/DreamwishWand/web/pull/225) exact HEAD `f9e9a4d3dc6f92a16c8ecbc6be4cb73faf808d75`. Clean full145 local PostgreSQL two distinct backends / actual SET LOCAL ROLE anon, Source44600 canonical Publisher-generated SearchDocument, Source145 legacy Search/Detail and Source144 r20 comparators. Verified X06 **CONFIRMED LOCAL RED** for Account RESTRICTED, final active Identity RETIRED, Creator entity TOMBSTONED. Existing Privacy suppression already correctly hidden by anon RLS (NOT_REPRODUCED exposure). Local synthetic evidence only, no actual deployed user leak claimed.

Original generic `public.community_search_public` is **SECURITY INVOKER**, direct anon SELECT on `public.search_documents`, with historical `search_documents_public_read` using only `private.is_discoverable_work(work_id)`. Dedicated Source145 Gallery Search and Detail cannot correct the generic RPC or direct Index SELECT; Source144 `private.dreamsnap_public_work_accessible_r20` already formalizes effective DreamSnaps Account/Identity/Creator/Work authorization.

## Smallest Owner correction

Single new forward-only **146th** SQL migration `20261027000030_generic_public_search_work_liveness_source146.sql`.

- **Replace** historical `search_documents_public_read` SELECT policy, never add a second permissive policy (PostgreSQL combines permissive policies with OR).
- New private, SECURITY DEFINER **boolean-only** `private.generic_public_search_work_accessible_r21(uuid)` derives canonical Work type from `public.community_works`, not stale SearchDocument metadata. For actual DreamSnaps use exact accepted Source144 r20; for every other Work type delegate unchanged `private.is_discoverable_work`. Missing Work returns NULL, RLS COALESCE false.
- Source144 r20 remains REVOKE EXECUTE from anon/authenticated/service_role. Grant only this dedicated boolean policy predicate to anon/authenticated, no direct raw Account/Auth/Creator table grants. No modification to public generic RPC parameters, payload, index producer, triggers, SearchDocuments schema, Source145 functions or existing Creator/Gallery/Q&A.
- **Do not** add Account-global Official DDV numeric result consent as Public Wand Work gate. OFF/default numeric disclosure remains separate.
- Previously issued signed media bearers/CDN cannot be retroactively revoked by the policy; signed-runtime Operator Gate A remains HUMAN NO-GO.

## Acceptance matrix

Owner synthetic tests: `tests/community-r21-generic-public-search-work-liveness.test.mjs`, `tests/comm-generic-public-search-source146-two-session.py` and 146-migration `comm-clean-bootstrap-acceptance.yml`.

- Full146 empty local Supabase/PostgreSQL bootstrap and reset, 146 unique migrations; Source original blobs Source141–145 **unchanged**, static ACL/grants and policy check.
- Two real PG backends: Writer A commits each valid mutation; Reader B uses actual `SET LOCAL ROLE anon` to SELECT SearchDocuments and call `community_search_public`, then separate Source145 service-role comparator.
- Valid Public DreamSnap with non-synthetic Results, eligible Entry, approved owned Media, native revision and SearchDocument created **only by existing Source44600 Gallery publisher** must return WorkID+title even with Account-global Official numeric consent OFF.
- After committed Account RESTRICTED, final Identity RETIRED, Creator TOMBSTONE and Privacy Suppression, Generic anon Search and direct SearchDocuments SELECT must both deny while canonical physical index still exists and Work remains Published/Public. Source145 Search/Detail and Source144 r20 deny. Restoring legitimate state must restore public visibility with no test-invented index insert.
- Non-DreamSnap Work uses original Work-level visibility semantics and is not inadvertently denied solely by DreamSnaps-specific r20. Original public Search RPC signature and `anon` EXECUTE remain unchanged.
- Post-Owner 04 QR independently re-executes at **exact new Owner HEAD** using disposable actual two-PG and role anon (do not present Owner self-test as independent QR acceptance).

## Scope and gates

No Source141/142 Media Incident or Provider attestation change; no Source143 Official DDV account-global consent change; no Source144 public Media/WAND Results change; no Source145 dedicated Gallery Reader change. No index rebuild or updates to unrelated work types. Stage116 21 Edge / 7 Cron are historical observations only. Operator A0–A7 HUMAN NO-GO, Provider B D HOLD CAPABILITY_BLOCKED, physical Gate C NOT_AUTHORIZED. `graphComplete=false`. R17 ProductTree 30 PASS0/PARTIAL12/BLOCKED18 plus 7 shared human blockers. Public release NO-GO.

Status after creation: **OWNER CANDIDATE**, pending exact-HEAD ordinary CI + isolated local Bootstrap + independent new 04 QR verification. Only record PASS after actual job conclusions.
