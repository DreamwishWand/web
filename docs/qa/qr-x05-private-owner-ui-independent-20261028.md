# 04 QR — X05 WEB private owner UI, independent new-only acceptance (2026-10-28)

**Verdict: INDEPENDENT_WEB_X05_PRIVATE_UI_SOURCE_LOCAL_CHROME_PASS.**
**DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Public Release NO-GO.**

## Frozen provenance

- New independent [Draft PR247](https://github.com/DreamwishWand/web/pull/247), actual tested QA HEAD `945133ec4f75359d6afd9f351db0f3b3609c0a02`; based **exactly** on 08 WEB Owner [PR245](https://github.com/DreamwishWand/web/pull/245) HEAD `50a8bd4812df2c9caff04d0a26b58d28042943ab`, whose 7-file changed set is relative to earlier integrated WEB PR234 HEAD `b907a86d67887bf841179f23824e5b26085520c3`.
- All Owner source/route, Supabase migrations, Edge, Signers, Storage/public APIs **unchanged** on QR branch. Independent QR files: `tests/qr-x05-owner-ui-independent.test.mjs`, `scripts/qr-x05-owner-ui-browser-independent.mjs`, `.github/workflows/qr-x05-private-owner-ui-independent.yml`. Preexisting QR226/236 accepted scope not re-run.
- Owner test/Chrome CI outcomes were **not** used as independent evidence. QA script has its own fixtures, assertions and all-external HTTP request observer, unlike Owner's synthetic-domain-specific interception.

## Executed and independently observed

- [Dedicated independent Source+actual Chrome PR CI40668624064](https://github.com/DreamwishWand/web/actions/runs/40668624064) **COMPLETED SUCCESS**: Node **7 PASS, 0 FAIL**; real installed headless Chrome five independent groups: anonymous sign-in denial and malformed/mixed/duplicate WorkID URLs; local typed PostEvent/Original concept preview and no owner write; WorkID backend-unavailable / SPA back-forward / stale preview reset; all eight locales at 320px width keyboard focus plus disabled button ARIA; **zero external HTTP requests**, no signers, backend, storage or CDN. Chrome pageErrors=[], consoleErrors=[].
- [Independent ordinary PR CI40668624127](https://github.com/DreamwishWand/web/actions/runs/40668624127) **COMPLETED SUCCESS**; independent push Source+Chrome CI40668573607 **COMPLETED SUCCESS**.
- Node independent decoder edge cases: unauthorized/wrong owner, retired identity, privacy/moderation denial, stale expected rowVersion/authorizationEpoch and generation, wrong Media/Challenge or cross-Work grant, forged hasCompetitionEntry/WAND rank, inconsistent purge completion, restricted grant status. Original requires real EntryID/frozen photo revision; PostEvent requires no EntryID. Only typed *local* draft returns preview-only, never a persisted Work/competition Entry.
- UI semantics P01 unofficial/non-affiliated, P02 copyright not transferred with limited revocable versioned display/hosting permission, P03 PUBLIC_DISABLED not equivalent to provider-verified MEDIA_PURGED; REQUESTED, QUEUED, PROCESSING and LEGAL_HOLD distinguish. All consent, Delete, Publish, Public Detail, Media and Owner backend capabilities remain false and buttons disabled.

## Limits/remaining

**NOT EXECUTED:** signed real owner/session actual Backend/Row CRUD; private Work reader, Server Issuer, original screenshot verification, image serving, Stage/Provider/Storage, media signer, old 300-second signed URLs/CDN invalidation, actual deletion or Provider irreversible purge, Public Work Detail/Publisher. No synthetic UI claim is a live authorization proof. Status limited to `INDEPENDENT_WEB_X05_PRIVATE_UI_SOURCE_LOCAL_CHROME_PASS`.

Unrelated accepted Source141–148, QR226, QR236, Source149 PR244 are unchanged/unreplayed. Operator Gate A0–A7 HUMAN NO-GO; Provider B HOLD/CAPABILITY_BLOCKED; physical cleanup C NOT_AUTHORIZED; R17 Product Tree PASS0/PARTIAL12/BLOCKED18 + 7 human blockers. `graphComplete=false`; public NO-GO.
