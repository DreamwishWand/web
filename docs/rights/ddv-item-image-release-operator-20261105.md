# Dreamwish Wand — DDV item image release controls

Dreamwish Wand is an unofficial, independent project, not affiliated with or endorsed by Disney or Gameloft. The game artwork and associated intellectual property belong to their respective rights holders.

## Scope and authority

The project's [game-image decision](https://github.com/DreamwishWand/web/issues/604) permits eligible genuine, released player-visible DDV item images in public TEST and the eventual service, subject to scoped acceptance. It is an Owner product decision, **not a copyright licence**. Rights-holder licence status must remain UNKNOWN unless separately evidenced. Do not infer a licence, partnership, public-domain status or a broader publication grant.

This scope does not cover hidden or unreleased artwork, raw game archives, private Save or personal media, third-party wiki images, Creator/UGC content, DreamSnaps, Guide article bodies, or account and entitlement changes. Those have separate eligibility and privacy/consent requirements.

The primary canonical asset supply is the official installed Steam Windows game; verified Switch assets are supplemental or explicitly identified item-specific fallback. Preserve platform, exact supported game version, Build/BID and schema provenance; never infer equivalence between platforms or builds, or substitute an old image solely because an ID matches. The final product uses versioned static/CDN delivery and does not require user-supplied game archives.

## Required image release contract

| Control | Required evidence |
| --- | --- |
| Identity and visibility | Exact source/target build and per-image ItemID → IconGUID → Sprite/Texture → PNG/lossless WebP provenance, digest and pixel evidence; released player-visible scope only. Deny unknown/mismatched identity, hidden content or invalid bytes. |
| Policy and attribution | Applicable scope, accurate rights status, eight supported locale non-affiliation/attribution copy and accountable review; no invented rights-holder permission. |
| Rights contact | Real operator-controlled contact and successful receipt/reply evidence before claiming a working public contact. |
| Notice intake | Privacy-minimized affected item/revision/hash, verified contact and case handling. No claimant identity, private correspondence or sensitive proof in public artifacts. |
| Linked removal | Suppress the affected ItemID and all connected source-PNG/WebP digest aliases, public manifest entries, search and thumbnails. Invalid or incomplete linkage must fail closed rather than produce a partial-success receipt. |
| Origin, CDN and old URLs | Verify actual serving-layer removal and applicable invalidation, old and alternate URL/conditional/cache responses, including an already-open browser and previously loaded catalog. A new URL, manifest flag or HTTP noindex alone is not revocation. |
| Backup and rollback | Apply an authoritative suppression ledger outside restorable snapshots before restoring old manifests, assets or builds; test no resurrection of affected bytes. Preserve unaffected assets and service. |
| Delivery acceptance | Fixed eligible manifest and bytes, applicable independent QA, scoped release/rollback acceptance, protected cumulative build/deployment, actual HTTPS, MIME, SHA and visible rendering, with affected negative cases. |

These checks apply to the actual selected asset scope. Unverified images remain ineligible. A synthetic receipt or successful source-only test does not establish an actual contact, image publication, CDN purge, rollback or rights-holder licence. An accepted scope does not wait for unrelated functionality or a second Owner media-policy grant. No public flag changes are authorized by this document alone.

## Executable safety contract

- `ops/ddv-item-image-operator-gate.mjs` supplies `preflightGameItemImage`, `planGameImageTakedown` and `preflightGameImageOperatorReceipt`. The helpers validate candidate metadata and prepare a finite checklist; they do not operate a host, mail service, cache, or publication switch.
- `ops/ddv-item-image-operator-readiness-template.json` is a **draft, unverified** template, not an accepted operational receipt. Its non-affiliation translations require actual review; unset controls must not be represented as PASS.
- `tests/ddv-item-image-operator-gate.test.mjs` checks the source contract with synthetic data. Actual serving acceptance is separate.

For withdrawal, quarantine an uncertain scope, stop affected serving, reconcile exact aliases, record actual origin/cache and old-URL results, and verify a suppression-filtered restore. An unresolved affected cache or rollback condition remains a scoped hold; never claim deletion from a successful planner test or assume downloaded third-party copies can be recalled. Do not unpublish unrelated accepted functionality.
