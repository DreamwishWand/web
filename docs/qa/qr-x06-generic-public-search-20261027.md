# 04 QR Issue #228 / 09 INT X06 — Generic Public Search Account-Liveness

**INDEPENDENT BOUNDED QA; status PENDING actual disposable PostgreSQL workflow.** This file is an evidence index, not an Operator authorization, Source fix, or Stage disclosure claim.

## Frozen source contract
- Owner PR #225 pinned `f9e9a4d3dc6f92a16c8ecbc6be4cb73faf808d75` exactly, and **145** complete SQL files.
- Generic `public.community_search_public`: `20260930114310_community_core_v0_public_search.sql`, Git blob `70ab98552244ddad7501237a83b836a8308514a1`, **SECURITY INVOKER**, `anon` granted EXECUTE.
- `search_documents_public_read` / `private.is_discoverable_work`: `202609300001_community_core_v0.sql`, Git blob `4be2e65544110035f1846d91ecd8fa3c1c5f5fc7`. Actual effective RLS required.
- **Accepted legitimate SearchDocument producer**: `public.community_dreamsnap_publish_gallery_v1` final `20261003044600_community_dreamsnaps_native_revision_fix_v1.sql`, Git blob `e9489cfad4d85d4ef654ac6010c5a2dc955c34fb`, upserts SearchDocument. Test does not manually INSERT or alter policy/trigger to produce the index.
- Source145 dedicated legacy Gallery Search/Detail: `20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql`, Git blob `b1fc4990a057f810aeb4b1a12a602a68c9b0330f`. Original 04 QR PR #227 remains immutable accepted; it is only the comparator, not rerun.

## Reproducer / outcome contract
Workflow `.github/workflows/qr-x06-generic-public-search-independent.yml`: complete 145-migration disposable `supabase start` on GitHub runner; no linked stage/project/token; `psycopg` TWO actual independent PG backend PIDs, `SET LOCAL ROLE anon` for invoker query on B. A constructs valid local Work/Creator/eligible non-synthetic Results Entry/Media and current published Revision via original constraints, then invokes **canonical Source44600 Gallery publishing RPC** to produce SearchDocument. B obtains actual anonymous `community_search_public` positive baseline and direct RLS SELECT proof; B separately switches to service_role only for comparator Source145 definer Search/Detail. Commit independently permissible changes in A then query B: Account RESTRICTED, AuthIdentity RETIRED, Creator entity tombstone, Account Privacy suppression; restore each via supported reverse transition; only call original Publisher to repair Index if genuinely purged by lifecycle, no manual index insert. Check Work stays PUBLISHED/PUBLIC, effective Source144 `private.dreamsnap_public_work_accessible_r20` and Source145 dedicated Reader denial.

- **CONFIRMED LOCAL RED** only for valid canonically produced indexed Work returning identifying title/WorkId to actual anonymous generic Search while dedicated Source145/r20 deny, post-commit from other backend. Name exact states and observed provenance before requesting scoped Owner fix.
- **NOT_REPRODUCED** if valid baseline SearchDocument exists and anonymous generic Search denies every held state; record whether index lifecycle deletion or RLS prevented output.
- **NEED_SOURCE** if genuine canonical Publisher cannot build index or supported transition cannot be constructed. Do NOT artificially insert document or suppress violation.
- **PARTIAL** if positive baseline works but at least one state remains untested.

## Security and release
No Stage, remote Storage/Auth, JWT, Supabase signed URL, CDN, Provider, service-role impersonated browser, real account, physical cleanup, or Source migration changes. No positive public Publisher/Cloud/Native Writer/Apply enabled remotely. A0–A7 HUMAN NO-GO, Provider B D HOLD/CAPABILITY_BLOCKED, Gate C NOT_AUTHORIZED. All PRs DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. R17 30 PASS0/PARTIAL12/BLOCKED18.
