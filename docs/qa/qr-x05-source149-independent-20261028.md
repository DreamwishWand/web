# 04 QR — X05 Source149 nonpublic controls, independent FULL149 two-backend acceptance (2026-10-28)

**Disposition: INDEPENDENT_SOURCE149_NONPUBLIC_SOURCE_LOCAL_PASS**, not public activation or a runtime provider acceptance. **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. PUBLIC RELEASE NO-GO.**

## Fixed owner/provenance

- Owner [03 COMM PR244](https://github.com/DreamwishWand/web/pull/244) frozen HEAD `2abbb2b14dfe0f876cef92e8c3b9e18d8d9e50cd`, direct Source148 PR238 HEAD `8d678b53275204fa964cfdbe3de74a61fee8cad0`. One new Source149 SQL migration SHA Git Blob `0d0c4e85a1fc1d0e2e3ba06aade8d55f305e1fd0`.
- Owner changed only 6 paths: Source149 SQL, its source Node and real 2PG fixture, standalone workflow, documentation and historic migration-count ledger bump 148→149. Independent QR examines new contract; never re-executes accepted QR240 as its own original proof.
- New independent [Draft PR246](https://github.com/DreamwishWand/web/pull/246) based exactly on Owner SHA, no changes to `src/`, `supabase/`, Edge, Signer or Source141–148. New QR-only files: `tests/qr-x05-source149-independent.test.mjs`, `tests/qr-x05-source149-two-pg-independent.py`, `.github/workflows/qr-x05-source149-independent.yml`, this QA report.

## Actual independent evidence

- Independent test workflow on corrected actual QA source SHA `a4f04ed8e5faafe33ed8394646f054c9f7cb453b`: [source FULL149 push CI40668709304](https://github.com/DreamwishWand/web/actions/runs/40668709304) **SUCCESS**. 6/6 new-only source test PASS; clean full149 isolated disposable Supabase DB migrated and different real backend PIDs **302 / 303** executed source149 state transitions. Static tests bind Git blob and total149 source, not a derived `148` old count. [ordinary PR CI40668718636](https://github.com/DreamwishWand/web/actions/runs/40668718636) **SUCCESS** on same tested QA SHA. Dedicated PR CI40668718795 pending when this report was prepared; final CI status must be read back before concluding final report-head acceptance.
- Independent actual SQL markers from same dedicated push:
  `QR149_REAL_PRIVATE_ACL_NO_EXTERNAL_CALLER_PASS`;
  `QR149_INDEPENDENT_WEDNESDAY_UTC_168_336_PUBLIC_FALSE_PASS`;
  `QR149_ORIGINAL_FROZEN_POSTEVENT_ENTRY_FREE_OWNER_MEDIA_CONSENT_PASS`;
  `QR149_TWO_REAL_BACKENDS_WITHDRAW_VERSUS_GRANT_CAS_SERIALIZABLE_PASS` (withdraw won, conflicting grant rejected);
  `QR149_WITHDRAW_VISIBILITY_ORIGINAL_LEGACY_METADATA_GATE_PASS`;
  `QR149_ATOMIC_DELETE_OUTBOX_NO_PHYSICAL_PURGE_CLAIM_PASS`;
  terminal `QR149_INDEPENDENT_FULL149_SOURCE_LOCAL_DONE`.
- ACL: all 3 private tables (SELECT/INSERT/UPDATE/DELETE), all 5 private function EXECUTE entries deny `anon`, `authenticated`, `service_role`; no public X05 RPC. Work reference: OriginalCompetition real Entry tied frozen EntryRevision/Media; PostEventCreation has no Entry, must match inherited staged private no-public work; mismatch self-capture, Owner/Media/Photo/rowVersion rejects.
- Schedule: Wednesday 13:00 UTC exact six edge points across +168h and +336h, invalid anchor; all return positivePublicAllowed=false / officialServerPhaseVerified=false. Real Official Challenge per-ID phase source still UNKNOWN.
- CAS: independent two Pg backend writers race one rowVersion with Grant versus Withdraw; one wins, loser rejected, authorizationEpoch/rowVersion advance once, no successful stale grant. Negative unknown transition rolls back with no outbox or version change. Existing original public Work & Gallery reader were positive before Withdraw and suppressed after Work.visibility private, legacy publication unpublished; private original Metadata returned NULL, duplicate and regrant fail.
- Delete: actual private control `delete_requested`, historical Outbox event precisely once, tracking `requested`, `verified_at` and `provider_receipt_digest` remain NULL; no owner function marks verified/physical purge. No signed actor, real provider, remote media or client online test.

## Historical test harness incident — NOT Owner RED

Prior independent run [#40668435160](https://github.com/DreamwishWand/web/actions/runs/40668435160) failed before testing SQL beyond ACL because **QR-only** Python literal SQL `LIKE 'dreamsnap_x05_%'` was parsed by psycopg as a placeholder. Corrected **only** independent test `% -> %%` with QA SHA `a4f04ed8e5faafe33ed8394646f054c9f7cb453b`. Owner Source149 SQL untouched. Old Source148 total148 workflows on Source149 branch are unrelated hardcoded historic harness total; not labelled Source149 implementation RED or new Source148 QA.

## Unproven / prohibited positives

- X07 Saved rehydrate = UNKNOWN / NEED_RUNTIME.
- X08 Share/open links = UNKNOWN / NEED_RUNTIME.
- Comments/replies and notification fanout = UNKNOWN / NEED_RUNTIME.
- Media Signer/legacy Gallery signer = UNKNOWN / NEED_RUNTIME.
- Previously issued 300s Storage signed URLs = UNKNOWN / NEED_RUNTIME; CDN cache/private copies = UNKNOWN / NEED_RUNTIME.
- Signed real actor, checked issuer, exact official Challenge phase, Stage, Provider immutable copies, verified physical erasure and deletion completion = NEED_RUNTIME / NOT_AUTHORIZED.
- Source149 is **NONPUBLIC**, its Work visibility suppression is not proof of every indexed/cached/externally held downstream path. No positive Public Work Detail, Publisher, actual Owner CRUD, Cloud, Native Writer or Apply. No current production Stage deployment.

**Owner action:** 03 COMM retains frozen Source149 SQL (no reproduced source contract RED); 09 INT needs independent X05/X07/X08 caller graph and issuer/reader inventory before cross-product consumption. 08 WEB UI separate QR lane is not automatically source-to-consumer integration. Gate A0–A7 HUMAN NO-GO; Provider B HOLD; C NOT_AUTHORIZED; Product Tree 30 PASS0/PARTIAL12/BLOCKED18 + 7 human blockers. `graphComplete=false`; DRAFT, DO_NOT_MERGE, DO_NOT_DEPLOY, public NO-GO.
