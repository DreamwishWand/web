# Guide > Systems: publication-boundary contract (08 WEB, 2026-10-24)

Status: **IMPLEMENTED, DENY-BY-DEFAULT; PUBLIC CONTENT ZERO**. Product Owner's Guide Systems taxonomy is CLOSED. This document is an implementation/runbook handoff, not publication or release approval.

## Canonical references
- Owner-approved 7-category / 21-subgroup taxonomy: Drive `1YqXCAAg2jBINSy8TkEM9ZuNSs9Vd54hkMbmu5XlCp7c`
- Reviewed EN article-to-category crosswalk: Drive `1LBzUVcwlRV9ViaYIcMjqaqV_2CtShehK`
- 106 mechanics inventory: Drive `1PUNoQs_LFCTpBrCBTC7jqg3UmcVwsPwk`
- 07 DBK seed gaps: Drive `1aoEBYoKLKOfuBsNkud30H3B_8LECvGdF`
- Target verified only: Nintendo Switch DDV 1.25.0, BID `52BD625D9B4E0053`, save schema 624.
- 45 verified non-placeholder English P0/P1 pages are *not* 45 public pages. 106 mechanics are *not* 106 articles. Approved public articles = 0; manual non-English reviews = 315 outstanding; all-eight-reviewed public pages = 0.

## How the public site stays closed
1. `src/lib/guide/systems-catalog.js` contains only seven approved category/group labels and an intentionally empty **compiled** `APPROVED_SYSTEM_PAGES` allowlist. Do not import the 45-page English editorial inventory into any Svelte route / browser runtime. The full crosswalk lives solely in Drive and test fixtures.
2. `static/ddv/guide/v1.25/systems-public.json` is an empty public manifest. Do not add article bodies until approved *prior to emitting the static asset*. Client-side filtering does not prevent a raw JSON download after deployment.
3. `src/lib/guide/systems-public.js` accepts an article only if it matches the compiled allowlist, exact original approved source hash, approved category and group, Switch version, and every required publication/rights/current-version/all-eight-reviewed flag and eight valid locale bodies. Unapproved data fails closed. Do not use flags generated from the same untrusted source as a substitute for independent signoff.
4. No public static Guide `runtime.json` entries for the 45 unapproved Systems articles or 193 unapproved CHC issue candidates; Quest/Star Path/Event families remain separate and preserve their existing verification boundary.
5. Unknown IDs, legacy versions (including Switch 1.25.3), unverified DLC coverage and cross-product entity links never turn into public pages just because a title, URL, or content record exists.

## Promotion checklist per page (07 DBK + Product + QA, not automated approval)
- Resolve exact reviewed English `articleId`, `sourceEnglishGuidanceSha256`, primary mechanic, owner category/group, substantive instruction provenance, game version and DLC.
- Record **manual review** of all eight localized bodies and the seven non-English translations, 1.25.0 evidence provenance, and current target release/version applicability; review v1.25.3 independently. Fallback UI copy must not be interpreted as article translation approval.
- Confirm explicit article-level rights/source license attribution (absence of rights signoff in source is not proof of copyright violation); recheck dynamic availability, limited-time/live values, events and entitlements from authoritative source.
- Obtain explicit editorial/publication approval **before** adding the approved source record and finished localized body to build assets; keep allowlist and manifest synchronized as one reviewed change.
- Run full CI static build and browser tests **on the exact same new HEAD**; additionally inspect built immutable JS/JSON for unpublished article titles/hashes and direct raw manifest HTTP exposure. Signed/public staging tests belong to 04 QR.
- Verify stable deep links and verified shared Item/Quest/Event/Collection identity only when 09 INT supplies an authorized shared URL; never construct unverified links from display labels.
- Have a rollback path to withdraw a defective public article; understand previously cached static assets and CDN copies cannot be assumed instantly revocable.

## Test evidence and interpretation
- Unit tests keep the **test-only** English mapping in `tests/fixtures/guide-systems-reviewed-en.js`, verify seven-category distribution, source matching, strict allowlisting and negative cases.
- Browser first runs against untouched **zero-entry production allowlist**. It then tries a forged manifest with all approval flags true and must reject it. Only in an **ephemeral CI checkout** does the test replace the allowlist with two synthetic approved records, verify Browse/Search/Detail/related link, and restore the original source in `finally`. Neither synthetic approval nor fixture text is shipped to the public site.
- Success in a local / synthetic Chrome job proves application behavior, **not** rights, real reviewed 8-locale texts, current live facts or public launch acceptance.

## Ownership and unchanged product boundary
07 DBK handles the 315 reviews and reviewed seed/rights/freshness/provenance; 09 INT owns shared canonical entity links; 04 QR owns live staging/public browser, accessibility and release acceptance. 08 WEB owns the UI consumer and safety tests. Gallery PR #105, Community and Native DDV writers/Product Apply remain untouched and disabled. PR #133 must remain **DRAFT / DO_NOT_MERGE** until end-to-end acceptance; R17 GDE-SYS remains BLOCKED.
