# Q&A Resolution / Freshness Product Decision — 2026-10-02

Status: **PRODUCT APPROVED**

## Product principle

Wand prioritizes **current usefulness over historical completeness**.

Normal Q&A and Tips surfaces are for information believed useful on the current supported DDV version/platform. Wand is not a historical knowledge archive.

## Question resolution

Questions are primarily:

- `UNRESOLVED`
- `SOLVED`

A question may be marked `SOLVED` only when reusable resolution information exists.

A solved question may use either:

- one optional **Accepted Answer** selected by the question author; or
- a **Solution Note** written by the author.

If there is no Accepted Answer, a Solution Note is required. This covers self-resolution and cases where several answers need to be synthesized.

A mistaken question, something that was not actually a problem, an invalid premise, or a duplicate with no unique value should not be marked Solved merely to close it. It should be removed/withdrawn from normal user-facing knowledge.

## Freshness

User-facing freshness has only:

- `CURRENT`
- `NEEDS_RECHECK`

There is **no HISTORICAL state**.

`NEEDS_RECHECK` is temporary uncertainty after a relevant game update, affected-system change, or conflicting evidence. It is excluded from normal current/recommended surfaces until revalidated.

Confirmed `OUTDATED` is not a retained user-facing state. It is a **terminal deletion decision**.

- outdated Tip -> delete it from current knowledge;
- outdated Answer -> delete that Answer; if the Question itself is still current and no current solution remains, return it to Unresolved;
- obsolete Question/problem -> delete the Question/thread from ordinary knowledge.

Only minimal structural/audit/moderation records may survive where required by security, moderation, legal hold, or deletion-ledger contracts. Obsolete knowledge payload is not retained merely for historical browsing.

## Revalidation

Revalidation may use current-version/platform author verification, credible Worked / Does Not Work feedback, moderator or Database/Knowledge review, and update-diff evidence tied to affected systems/entities.

Raw popularity/likes are not sufficient evidence of current applicability.
