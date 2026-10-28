# 04 QR — post-Source148 X05 independent full148 private/STAGED source-local acceptance

**Verdict: INDEPENDENT_SOURCE148_PRIVATE_STAGED_SOURCE_LOCAL_PASS.** Independent actual all148 PostgreSQL / two live sessions, not Owner fixture or historical QR239 suite. This does not activate positive public Work Detail, Stage, signed media or Operator gates.

**Immutable Owner** 03 COMM [Draft PR238](https://github.com/DreamwishWand/web/pull/238) HEAD `8d678b53275204fa964cfdbe3de74a61fee8cad0`. Existing frozen WEB234 base `b907a86d67887bf841179f23824e5b26085520c3`. New only `supabase/migrations/20261028000010_x05_post_event_staged_liveness_immutable_guard.sql` Git Blob `f6438fe596ed2eaca88bdb034173431f6bd511aa`. Historical Source147 `20261028000000_x05_shared_dreamsnap_metadata_staged_v1.sql` Blob `5c2b1b85b07821d7e60a84de40d933d59c4cc19d` byte-stable. Contract `wand.dreamsnaps.public-work-detail-metadata@1`. Owner ordinary [CI40614026876](https://github.com/DreamwishWand/web/actions/runs/40614026876) SUCCESS, Owner full148 twoPG [CI40614021303](https://github.com/DreamwishWand/web/actions/runs/40614021303) SUCCESS, Owner clean bootstrap [CI40614026767](https://github.com/DreamwishWand/web/actions/runs/40614026767) SUCCESS. **None of these constitute independent QR.**

**Historical immutable QR239** [PR239](https://github.com/DreamwishWand/web/pull/239) final RED SHA `468e71419d14fb17ded3c9b1cd8481b95966d2a0`, 147 actual two PostgreSQL CI40611687991 FAILURE. 5 actual Source147 failures: stage INSERT under Restricted Account, Retired AuthIdentity, Privacy Suppression, Creator Entity Tombstone; same-Work eligible image+READY Media rebinding UPDATE succeeded despite immutable photograph.

**Independent Source148 design**: new test script `tests/qr-post-source148-x05-full148-independent.py` uses the minimum synthetic test object setup adapted to real all148 Schema, and **does not invoke QR239's old negative suite**. Starts completely clean local Supabase with 148 actual migrations, two distinct live PostgreSQL backends, actual Source144 r20 and Source145 reader without stubs. 4 old holder variants now must reject *both* fresh PostEvent STAGED INSERT and unchanged-image row_version UPDATE of an existing STAGED row. Valid same-Work alternate eligible PhotoRevision plus READY same-owner Media attempts image+media, image-only, media-only UPDATE: all must reject. Positive private STAGED insert two different WorkIDs for same Challenge/account, no EntryID; legitimate row_version UPDATE must succeed while Stage stays Private. Scoped moderation and Account deleted negative, true OriginalCompetition metadata reader remains functional, no new public Work Detail/Signer. Source141–147, Edge and frontend blobs unchanged; original photo/rights/Voting hard UNKNOWN and publication hard STAGED; public/anon/authenticated/service_role no new private grants.

| Source148 acceptance | Independent real full148 result |
| --- | --- |
| Exact fixed Owner/Source148+Source147 blobs, SQL141–147 and Edge byte-stable | PASS — source pin |
| Actual full148 empty local Supabase migrations and two PG connections | PASS — writer PID309; reader PID310 |
| Restricted Account STAGED INSERT and UPDATE | PASS — both rejected P0001 |
| Retired Supabase Identity STAGED INSERT and UPDATE | PASS — both rejected P0001 |
| Account Privacy Suppressed STAGED INSERT and UPDATE | PASS — both rejected P0001 |
| Creator Entity Tombstone STAGED INSERT and UPDATE | PASS — both rejected P0001 |
| Genuine alternate eligible same-Work PhotoRevision + READY Media rebind | PASS — together/photo-only/media-only P0001 |
| Active Account/Identity/live Creator/privacy clear private STAGED Work | PASS — 2 WorkIDs for same Challenge + owner, 0 Entry |
| Legal same-photo row_version update | PASS — no overdeny |
| Moderated Work, moderated Creator, deleted Account STAGED UPDATE | PASS — rejected P0001 |
| Real Source144/145 OriginalCompetition private metadata; Source147 Reader | PASS — real Reader, unchanged |
| anon/authenticated/service_role Function EXECUTE and table DML | PASS — no new grants |
| Publication hard STAGED; Official/Wand Voting and Rights hard UNKNOWN | PASS — invalid writes rejected |
| Actual JWT/Stage/signed media/CDN/Provider/Storage/Cloud and positive X05 | NEED_SOURCE / NEED_RUNTIME / NOT_AUTHORIZED |

**Evidence discipline:** do not interpret static fixtures/Owner success as QR accepted; report post-Owner `INDEPENDENT_SOURCE_LOCAL_PASS` only after new full148 SQL independently succeeds. A new RED must include full SQL repro and minimal 03 COMM change request. Preserve original QR239 RED as historical.

**Safety**: Operator Gate A0–A7 HUMAN NO-GO, Provider B D HOLD, Physical C NOT_AUTHORIZED; no live Stage, JWT, signer, old 300s CDN bearer, cloud, native DDV writer, cleanup or Main Merge. All Draft DO_NOT_MERGE DO_NOT_DEPLOY. R17 Product Tree 30 PASS0/PARTIAL12/BLOCKED18 plus 7 human blockers and `graphComplete=false`, public launch NO-GO.

## Independent actual full148 SQL evidence / bounded acceptance

First independent candidate SHA `8c2656de9396da9720d526888c5cf477f507a981`: [dedicated push #40615947415](https://github.com/DreamwishWand/web/actions/runs/40615947415) COMPLETED SUCCESS, [dedicated PR #40615983965](https://github.com/DreamwishWand/web/actions/runs/40615983965) COMPLETED SUCCESS, and [ordinary #40615983969](https://github.com/DreamwishWand/web/actions/runs/40615983969) COMPLETED SUCCESS. Final QA HEAD and corresponding CI must be read again after this report is committed.

Actual PostgreSQL log job `122578338244`: `QR148_REAL_FULL148_EMPTY_LOCAL_DB_BOOTSTRAP_PASS`; writer PID309 and reader PID310. No stub of Source144/145. `QR148_FOUR_OLD_QR239_INSERT_AND_UPDATE_REDS_CLOSED` proves four holders x two actions = eight actual SQLSTATE P0001 denials. Moderated Work/Creator and deleted Account updates also denied. `QR148_OLD_IMMUTABLE_PHOTO_MEDIA_RED_CLOSED` proves three alternate eligible same-Work photo/media mutation permutations fail with SQLSTATE P0001 and fixed reason `X05_POST_EVENT_IMMUTABLE_PHOTO_MEDIA_REBIND`. `QR148_LEGAL_PRIVATE_STAGED_NO_OVERDENY_FULL148_PASS` shows two genuinely independent Private STAGED WorkIDs for one Owner/Challenge, zero competition Entries, legal same-image row_version increment, unchanged metadata-only Reader and `UNKNOWN` Voting/Rights and `STAGED` publication hard limits. Catalog revoked grants confirmed under anon/authenticated/service_role, genuine Original public eligible Reader and private metadata behave correctly.

Old Source147 QR239 RED: four holder-invalid new Stage INSERTs had been accepted and eligible same-Work replacement Photo+Media was accepted; new Source148 refuses them with `X05_POST_EVENT_STAGING_PROVENANCE_UNVERIFIED` or `X05_POST_EVENT_IMMUTABLE_PHOTO_MEDIA_REBIND` respectively. The prior PR239 historical RED HEAD `468e71419d14fb17ded3c9b1cd8481b95966d2a0` and failed real full147 CI `40611687991` remain unchanged. Neither signed actors nor actual Stage/CDN/storage/provider tested; Source148 closure is PRIVATE/STAGED SOURCE/LOCAL only. Older already staged invalid rows have not been physically removed or certified repaired; no cleanup authorization.

Residual: positive public X05 metadata/Detail, PostEvent Publication/CAS writer/rights and official voting phase proof, X07 Saved/X08 Share and X10/X11 Signed Media/CDN remain pending. A0–A7 HUMAN NO-GO; B HOLD; C NOT_AUTHORIZED. R17 30 PASS0/PARTIAL12/BLOCKED18 and seven human gates, public launch NO-GO. All DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.
