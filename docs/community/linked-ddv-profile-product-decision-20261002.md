# DDV Profile Workspace Product Decision — 2026-10-02

Status: **PRODUCT APPROVED / PROFILE WORKSPACE MODEL CURRENT**

This document supersedes the earlier exclusive Linked DDV Profile model. Historical migration/evidence remains for audit, but the current Product contract is a Wand-owned Profile Workspace with an optional DDV Player ID association.

## Current Product behavior

- one Wand Account may retain at most **5 Profile Workspaces**;
- `active` and `archived` Workspaces both consume the same five-Workspace capacity;
- archiving does not free capacity; permanent Workspace deletion frees the slot;
- `self` and `parent_guardian_managed` Workspaces consume the same capacity;
- Wand Cloud does not increase the five-Workspace limit;
- a Workspace may exist and be used without a DDV Player ID / mdc value;
- with no custom private display name, the client presents a localized default such as Profile 1 or Profile 2 from the stable account-local slot;
- normal self-service Workspace deletion is allowed and requires explicit destructive confirmation.

## Optional DDV identity association

The current DDV identity source is `GameInfo.LastCustomIdOwner`, semantically the DDV Player ID / User ID.

The association is optional and is not Wand authentication, exclusive ownership proof, Community eligibility, entitlement proof, or a vote/final-entry multiplier.

The raw Player ID is not stored. Edge derives a domain-separated HMAC-SHA-256 digest and PostgreSQL stores only the digest in the private identity-association relation.

Within one Wand Account, the same digest may belong to at most one Workspace. The same DDV identity may be associated by different Wand Accounts. Those associations do not merge or expose private Workspace data.

Normal self-service identity unlink is allowed. Unlink removes only the optional identity association and **does not delete the Workspace**. There is no ordinary seven-day relink cooldown under the current non-exclusive association model.

## Workspace deletion boundary

Deleting a Workspace removes data whose ownership/scope is that Workspace, including profile-scoped private state such as Collection state, DreamSnaps/profile archive state, and future progression state if implemented.

Account/Creator-scoped Community data remains independent and must not cascade merely because it was created while a Workspace was selected. Examples include Gallery publications, Wand Presets, and Q&A Questions/Answers/Tips.

## Competition boundary

Profile Workspace count does not multiply Wand DreamSnaps voting rights, final-entry rights or Community permissions. Competition identity remains account-level.

## Approval boundary

Product is approved for this contract. Privacy and Legal remain **PENDING** for launch. The old max-three, exclusive-claim, no-self-service-unlink and seven-day claim-cooldown Product assumptions are superseded.
