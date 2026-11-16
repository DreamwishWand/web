# Dreamwish Wand — Public content corrections and rights notices

This document describes the product's safety contract. It is not a statement that a particular feature, item, contact route or deployment has been accepted.

## Public content and corrections

- Dreamwish Wand is an independent, unofficial project. Owner-controlled editorial and interface text may be corrected after publication **only within an already eligible public scope**. Editorial review timing is separate from actual publication eligibility.
- Public content must have applicable authorization, accurate source and locale, verified version and currentness where relevant, and the required privacy, consent, moderation and delivery checks. An unknown or failed requirement is not approval. A publicly reachable TEST page is public; a label or noindex directive does not make it private.
- Canonical Guide references, authored Guide articles, game-derived item images, Creator works, DreamSnaps and Community records have distinct eligibility boundaries. Approval in one category does not grant another category's rights. Owner editorial authority is not a third party's copyright or privacy consent.
- Corrections produce a new revision with the source provenance and expected previous revision retained; stale or mismatched revisions must not silently overwrite accepted content. An ineligible or withdrawn revision must not be exposed by direct URL, metadata or search.

## Notice and withdrawal

1. A public rights or support contact must be controlled by the operator and actually tested for receipt and reply. Do not represent an unverified address, form or synthetic receipt as a working contact.
2. Accept only the minimum information necessary to identify and evaluate the affected entity, revision, source and claim. Keep claimant identity, contact details, evidence, private work and operational records outside public content and logs. Apply the applicable retention, deletion and appeal policy; do not promise an unsupported universal retention period.
3. For a rights, privacy, moderation or withdrawal concern, stop public delivery of the affected entity through the actual serving layer. Unknown or invalid scope requires quarantine or denial, not partial approval. For game images, suppress linked ItemIDs and shared source and derivative hashes; see [DDV item image release controls](./ddv-item-image-release-operator-20261105.md).
4. Verify actual affected public URLs, search and thumbnail variants, origin and cache behavior. A planned hide, manifest flag, noindex or changed URL alone is not removal of previously served bytes. Do not expose a withdrawn entity by reverting a build.
5. Restore only after applying the independent suppression ledger and reconciling affected revisions. Keep unaffected accepted content available. A failure to verify removal or restoration safety retains the affected hold.

## Safety helpers

`ops/dbk-solo-owner-postpublish.mjs` provides `planSoloOwnerEditorialReview`, `planSoloOwnerIssue` and `verifySoloOwnerCaseClosure`. These pure helpers evaluate a candidate, minimize case metadata and check receipt shape. They do not publish, delete, contact a person, modify storage, establish legal authority or prove actual delivery; a successful synthetic check is not real-world acceptance. See `tests/dbk-solo-owner-postpublish.test.mjs` for the executable contract.

Actual serving changes require the applicable scoped acceptance, independent verification when risk requires it, and protected deployment. Public article rights, image rights, Creator consent, Account/Work privacy, moderation and managed services remain separate. Keep voting-period DreamSnaps submissions confidential; official Account-global results are private by default. Respect minor and guardian/consent boundaries. Public URL 200/301 eligibility requires the applicable host and route acceptance; unknown, private or unauthorized details must not be served as public HTML 200 merely because noindex is set. This contract does not grant permission to publish raw game archives, private Save data, private media or personal information.
