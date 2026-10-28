# 04 QR — post-Source148 X05 independent full148 private/STAGED source-local acceptance

**Verdict:** PENDING dedicated independent full148 two-real-backend fixture. This is NOT the Owner's dedicated full148 fixture, nor historical QR239/QR231/QR236 re-run.

**Immutable Owner** 03 COMM [Draft PR238](https://github.com/DreamwishWand/web/pull/238) HEAD `8d678b53275204fa964cfdbe3de74a61fee8cad0`. Existing frozen WEB234 base `b907a86d67887bf841179f23824e5b26085520c3`. New only `supabase/migrations/20261028000010_x05_post_event_staged_liveness_immutable_guard.sql` Git Blob `f6438fe596ed2eaca88bdb034173431f6bd511aa`. Historical Source147 `20261028000000_x05_shared_dreamsnap_metadata_staged_v1.sql` Blob `5c2b1b85b07821d7e60a84de40d933d59c4cc19d` byte-stable. Contract `wand.dreamsnaps.public-work-detail-metadata@1`. Owner ordinary [CI40614026876](https://github.com/DreamwishWand/web/actions/runs/40614026876) SUCCESS, Owner full148 twoPG [CI40614021303](https://github.com/DreamwishWand/web/actions/runs/40614021303) SUCCESS, Owner clean bootstrap [CI40614026767](https://github.com/DreamwishWand/web/actions/runs/40614026767) SUCCESS. **None of these constitute independent QR.**

**Historical immutable QR239** [PR239](https://github.com/DreamwishWand/web/pull/239) final RED SHA `468e71419d14fb17ded3c9b1cd8481b95966d2a0`, 147 actual two PostgreSQL CI40611687991 FAILURE. 5 actual Source147 failures: stage INSERT under Restricted Account, Retired AuthIdentity, Privacy Suppression, Creator Entity Tombstone; same-Work eligible image+READY Media rebinding UPDATE succeeded despite immutable photograph.

**Independent Source148 design**: new test script `tests/qr-post-source148-x05-full148-independent.py` uses the minimum synthetic test object setup adapted to real all148 Schema, and **does not invoke QR239's old negative suite**. Starts completely clean local Supabase with 148 actual migrations, two distinct live PostgreSQL backends, actual Source144 r20 and Source145 reader without stubs. 4 old holder variants now must reject *both* fresh PostEvent STAGED INSERT and unchanged-image row_version UPDATE of an existing STAGED row. Valid same-Work alternate eligible PhotoRevision plus READY same-owner Media attempts image+media, image-only, media-only UPDATE: all must reject. Positive private STAGED insert two different WorkIDs for same Challenge/account, no EntryID; legitimate row_version UPDATE must succeed while Stage stays Private. Scoped moderation and Account deleted negative, true OriginalCompetition metadata reader remains functional, no new public Work Detail/Signer. Source141–147, Edge and frontend blobs unchanged; original photo/rights/Voting hard UNKNOWN and publication hard STAGED; public/anon/authenticated/service_role no new private grants.

| Source148 acceptance | Status pending independent runtime |
| --- | --- |
| Exact Owner HEAD, Source148+Source147 blobs and migration ancestry | PENDING |
| Full148 real PostgreSQL clean migration and two live PG backends | PENDING |
| Old QR239 four holder INSERT fail-closed | PENDING |
| Four corresponding STAGED UPDATE fail-closed | PENDING |
| Immutable genuine same-Work photo+media alternative UPDATE reject | PENDING |
| Legitimate private Stage / two no-Entry WorkIDs / row_version update | PENDING |
| Source144/145 OriginalCompetition metadata and private ACL | PENDING |
| Rights/Voting UNKNOWN and Stage hard STAGED | PENDING |
| Signed JWT/Stage/Media/CDN/Provider/Storage/Cloud/operator | NEED_RUNTIME / NOT_AUTHORIZED |

**Evidence discipline:** do not interpret static fixtures/Owner success as QR accepted; report post-Owner `INDEPENDENT_SOURCE_LOCAL_PASS` only after new full148 SQL independently succeeds. A new RED must include full SQL repro and minimal 03 COMM change request. Preserve original QR239 RED as historical.

**Safety**: Operator Gate A0–A7 HUMAN NO-GO, Provider B D HOLD, Physical C NOT_AUTHORIZED; no live Stage, JWT, signer, old 300s CDN bearer, cloud, native DDV writer, cleanup or Main Merge. All Draft DO_NOT_MERGE DO_NOT_DEPLOY. R17 Product Tree 30 PASS0/PARTIAL12/BLOCKED18 plus 7 human blockers and `graphComplete=false`, public launch NO-GO.
