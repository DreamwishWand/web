# 04 QR — Source147 X05 new-only independent Source + full-schema actual PostgreSQL

**Status:** `PENDING_INDEPENDENT_FULL147_RUN`, no claim of PASS until dedicated real-SQL fixture completes. **Owner** 03 COMM [Draft PR238](https://github.com/DreamwishWand/web/pull/238), HEAD `23a12dac9cbe11898ecc167977f71e4f6a090636`, exact base [08 WEB PR234](https://github.com/DreamwishWand/web/pull/234) `b907a86d67887bf841179f23824e5b26085520c3`. **Source147** sole new migration `supabase/migrations/20261028000000_x05_shared_dreamsnap_metadata_staged_v1.sql`, Git Blob `5c2b1b85b07821d7e60a84de40d933d59c4cc19d`, contract `wand.dreamsnaps.public-work-detail-metadata@1`.

## Owner vs independent source evidence
- Owner synthetic PostgreSQL [CI40608205520](https://github.com/DreamwishWand/web/actions/runs/40608205520) SUCCESS with **Source144/145 stub functions**; not sufficient to accept actual private SQL Reader integration.
- Owner clean full147 migration [CI40608205497](https://github.com/DreamwishWand/web/actions/runs/40608205497) SUCCESS; verifies bootstrap, not X05 full-schema behavioral fixture.
- Owner ordinary [CI40608205585](https://github.com/DreamwishWand/web/actions/runs/40608205585) SUCCESS.
- This new distinct independent 04 QR branch runs a clean `supabase start` full147 PostgreSQL with no Source144/145 stub, then opens **two distinct actual pg_backend_pid writer and reader** connections; SQL via actual `private.dreamsnap_shared_public_work_metadata_v1`, real `public.community_get_gallery_dreamsnap_public_v1` Source145, real Source144 `private.dreamsnap_public_work_accessible_r20`, real stage trigger, catalog ACL.
- No full historical Source141–146 tests recreated. Legacy Blob/DB version/Edge/frontend provenance is verified without changing any Owner SQL/Edge/UI. No staged public Edge/routing, signer or newly allowed media capability.

## Independently scoped acceptance matrix (PENDING)
| New147 check | Expected | Result |
| --- | --- | --- |
| Exact Source147 SQL Blob/ledger/absence of new public calls | only one new forward-only SQL, private unrouted | PENDING |
| Actual full147 PostgreSQL clean start and two backends | no simplified historic reader stub | PENDING |
| Genuine original positive metadata | legacy Source145 and Source144 r20 positive, frozen Entry/Revision, no signer/social/official results | PENDING |
| Two different STAGED PostEvent WorkIDs for same Account+Challenge | no EntryID, hard unknown and staged | PENDING |
| Wrong Work/Creator/Challenge/Photo/Media/Concept, READY and minor validation | reject invalid inserts/updates | PENDING |
| embargo/private/revision/Account/Identity/Creator/Privacy incident | NULL or deny | PENDING |
| Publication/rank/vote/rights override | hard rejection | PENDING |
| anon/authenticated/service_role EXECUTE/DML | none | PENDING |
| concurrency/immutability/work deletion | stay bounded, report uncovered independently | PENDING/NEED_RUNTIME |
| Signed actor/Stage/Origin/CDN/Provider/official voting+rights | out of scope | NEED_RUNTIME / NEED_SOURCE |

**Fail-open detection** will emit exact SQLSTATE/failing case and classify `CONFIRMED LOCAL RED`. No speculative product Source changes in QR branch; minimal Owner fix request on issue121/PR238 if reproduced. Even a full SQL PASS cannot promote live JWT/rights/provenance or PostEvent positive publication.

**Safety**: no linked Supabase, no real Staging deploy, signed JWT, CDN/issued 300s media URL, remote Provider or Storage, Cloud, native Writer/Apply, real personal data, physical cleanup. Operator Gate A0–A7 HUMAN NO-GO, B D HOLD, C NOT_AUTHORIZED. Release R17 30 PASS0/PARTIAL12/BLOCKED18+seven human blockers and public launch NO-GO. **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**.
