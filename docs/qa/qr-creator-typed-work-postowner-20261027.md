# 04 QR — Creator Typed Work Route post-Owner-fix independent acceptance (2026-10-27)

Status: **SOURCE RED / ACTUAL CHROME RED**, bounded to new Owner #222 code. **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**. Owner implementation unchanged by this PR. No R17 promotion.

## Provenance

- Owner: 08 WEB Draft PR #222; pinned HEAD `d54b982a28046c441c7f2030c90f2a387c77f82b`; parent accepted 08 WEB PR #215 `ca46279f5da996f335ab011b627a4f5b5ba99235`; 04 QR accepted PR #218 `91cb6954153aecdf11fa44cdbbf1708d8501ad5b` immutable.
- Owner CI #40492453417 SUCCESS; Owner Chrome #40492446715 SUCCESS 7/7, synthetic provider only. Independent QR branch `qr/creator-typed-work-independent-20261027`, PR #223.
- Source144 Public Work SQL local two-PostgreSQL acceptance PR #221 remains separate; no signed Actor/CDN/Storage acceptance implied.
- Independent first actual synthetic Chrome proof #40495049661, job 122158275897: navigation RED with `pageErrors=[]`, `consoleErrors=[]`; source harness at that run had shallow checkout ancestry failure, corrected subsequently by `fetch-depth:0`.
- Independent following run #40495222714: ancestry checked PASS, independent Source 3 PASS / 1 FAIL, actual Chrome reproduced both same-page navigation defects, with 8-locale suffix at that run incomplete due QA hydration wait in harness (harness updated later; do not claim 8-locale completion from this run).

## Confirmed bounded findings

1. **Positive preserved (independent source and actual Chrome)**: Creator DreamSnap public search candidate does not expose raw DreamSnaps title/text, uses an inert no-ID `/dreamsnaps/` root instead of `/qa/?tip=<WorkID>`. Gallery/Question/Tip Work type maps to existing typed Detail parameters. Question and Tip published RPCs key on `community_works.work_id` in the declared SQL, so using WorkID is correct, not an EntryID/MediaID.
2. **Source RED**: `src/routes/qa/+page.svelte` (changed in Owner #222) parses query only inside Svelte `onMount`. It has no same-component `afterNavigate` reparse, no request-generation fence and no invalid-ID reset for a later `goto`/intercepted link on that same component.
3. **Actual Chrome RED (new only)**: direct `/qa/?tip=33333333-3333-4333-8333-333333333333` renders synthetic `QR TIP ONE`; SvelteKit SPA link to `/qa/?question=44444444-4444-4444-8444-444444444444` changes URL but initiates **ZERO** new `community_get_question_public_v1` requests, leaving old Tip title visible. Next SPA link `/qa/?tip=invalid` still fails to clear the prior Detail or show invalid-link notice. With cold direct load, strict query parser remains guarded. This is navigation/UX liveness, **NOT evidence of a private data exposure**, Provider bypass or Staging incident.
4. New-only QA tests intentionally assert the missing behavior and fail Owner untouched. The project-wide CI red on the QA branch includes these intentional failing tests, not proof that the owner baseline CI changed.

## Expected minimal Owner fix

- In 08 WEB Owner **new child commit** of PR #222, replace the one-time `onMount` deep-link parse for `/qa/` with a route-aware, reentrant `afterNavigate` or equivalent current-URL state subscription.
- Reparse **every** URL transition. On an invalid, mixed, unknown or duplicate query, clear prior selection/rows and surface neutral invalid-url notice **without a new public RPC**. On a different valid `question`/`tip` WorkID, reset selected/selectedKind, make the matching existing read call, fence stale in-flight detail/search results by generation.
- Preserve existing `?type=questions|tips` browse contract, prior valid routes and creator/saved IDs. Never create a positive Community DreamSnaps Detail, media signer, or phase/official-results consumer as part of this patch.
- Ask 04 QR to rerun only this RED test and independent 8-locale/320px/keyboard negatives pinned to fresh Owner HEAD. Do not retrofit accepted PR #218/#221 test suites.

## Holds

Real Signed Actor A/B/M and authorization readback; Staging 116 vs Source144 migration; old CDN Bearer t0/t60/t300/post-expiry; Storage sign/upload/cache; Provider authority; DreamSnaps competition phase and minor/rights; Human 8-locale review, content/privacy/legal/Ops; physical cleanup and native DDV Writer all **NOT EXECUTED/BLOCKED**.

Historical R17 30 rows **PASS 0 / PARTIAL 12 / BLOCKED 18** unchanged. All branches/PRs **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY**. No Stage deploy.
