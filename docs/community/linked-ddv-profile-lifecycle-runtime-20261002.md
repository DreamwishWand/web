# DDV Profile Workspace Lifecycle — Staging Runtime — 2026-10-02

Status: **PROFILE WORKSPACE DB LIFECYCLE STAGING PASS / COMMUNITY-COMMAND v20 + COMMUNITY-QUERY v10 DEPLOYED**

## Current staging model

- `20261001232814_community_ddv_profile_workspace_v1` — Workspace + optional private identity association;
- `20261001233225_community_ddv_profile_workspace_lifecycle_v2` — stable slots, private labels, active/archive lifecycle, self-service deletion and account-deletion cleanup;
- `20261001233707_community_ddv_profile_workspace_fk_index_v3` — composite identity-association FK coverage.

The earlier `20261001221620_community_linked_ddv_profile_lifecycle_v1` remains historical evidence only and is superseded as the user-facing Product model.

## Implemented contract

- maximum 5 retained Workspaces per Wand Account;
- active + archived both count toward the limit;
- stable account-local `slot_index` 1–5; lowest free slot is reused after permanent deletion;
- optional private `display_name`; null means localized Profile N from the slot;
- `self` and `parent_guardian_managed` use the same capacity;
- optional Player ID/mdc association; raw Player ID is not stored in PostgreSQL;
- same-account duplicate digest association is blocked; cross-account reuse of the same digest is allowed without sharing Workspace data;
- self-service unlink removes the identity association but preserves the Workspace;
- Workspace delete requires explicit `DELETE` confirmation, removes the optional association through cascade and frees the slot;
- account deletion removes that account's Workspaces and private identity associations;
- Workspace-scoped child data may cascade from the Workspace; Account/Creator-scoped Community works must remain independent.

## Runtime evidence

A rollback-only staging transaction verified: five retained Workspace cap; archive still consumes capacity; stable slots 1–5; custom label/archive update; same-account duplicate identity rejection; cross-account same identity association; unlink preserves Workspace; delete confirmation; delete cascade; slot reuse; and account-deletion cleanup.

After rollback: Workspace rows 0, identity-association rows 0, synthetic Wand Accounts 0.

## Edge/API

- `community-command` v22 — create/update/delete Workspace, associate/unlink DDV identity;
- `community-query` v10 — owner-safe Workspace query using `community_get_ddv_profile_workspaces_v1`; legacy `linkedDdvProfiles` routing is removed.

Identity association derives HMAC-SHA-256 using domain `dreamwishwand/ddv-player-id/v1\0` and forwards only the digest to PostgreSQL.

## Advisors

Security Advisor: no new blocking Workspace finding. Existing INFO findings are known server-only RLS-with-no-policy tables; Free-staging Leaked Password Protection WARN remains expected and production Supabase Pro must enable it.

Performance Advisor initially reported the composite identity-association FK without a covering index. Migration v3 added the index; recheck leaves only unused-index INFO findings.

## Remaining acceptance boundary

The DB lifecycle and deployed Edge source alignment are staging-runtime closed. A live raw Player ID -> Edge HMAC -> identity association E2E remains pending because the current tool path cannot verify/use the staging `COMMUNITY_DDV_PROFILE_BINDING_KEY_V1` secret through a real authenticated request. The digest-only database path is runtime-tested.

This is an engineering acceptance item, not a remaining Product owner decision. Privacy=PENDING. Legal=PENDING. No production resource was created.

## Staging migration-history note

During concurrent verification, lifecycle v2 and FK-index v3 were each recorded a second time in staging migration history (`20261001234029`, `20261001234035`) after the canonical repo versions (`20261001233225`, `20261001233707`) had already landed. The migrations are reapplication-safe and no duplicate schema objects or fixture rows remain. Production must replay only the canonical repo migration sequence; the duplicate staging history entries are not production source of truth.

## Legacy runtime decommission

- `20261001234524_community_ddv_profile_workspace_decommission_legacy_link_v4` revokes service-role EXECUTE from the superseded exclusive link, legacy linked-profile query, and legacy admin correction RPCs.
- Staging privilege readback confirms all three legacy RPCs are non-executable by `service_role`, while current Workspace create/update/delete/associate/unlink RPCs remain executable.
- `community-admin` v14 removes the legacy `correctDdvProfileLink` operation.

Two additional idempotent v2/v3 applications appeared in **staging migration history only** during concurrent work (`20261001234029` / `20261001234035`). They are not canonical repository migrations and are excluded from fresh production replay. The canonical repository sequence is `20261001232814 -> 20261001233225 -> 20261001233707 -> 20261001234524`.

## Edge correction and staging acceptance UI

A pre-activation static review found two escaping defects in the initial identity derivation source: the printable-ASCII regular expression and the intended NUL domain separator had been double escaped. Because the staging HMAC secret was not configured, live Player ID association was not enabled through this path.

The corrected source first entered the v21 deployment. Current staging `community-command` **v22** contains the same printable-ASCII `0x21..0x7E` validation and a real NUL between the `dreamwishwand/ddv-player-id/v1` domain and the Player ID. Regression coverage locks both source properties.

A staging-only `/community-lab/profiles/` acceptance surface is now source-implemented for five-slot Workspace creation, private labeling, Active/Archived state, optional Player ID association, unlink and confirmed deletion. It does not persist Player ID in browser storage and clears the input after an association attempt.

Browser/runtime acceptance for this page remains pending branch build plus an authenticated staging session. It is not yet classified as browser PASS. The source-level HMAC separator regression assertion was also corrected after the Edge escape fix.
