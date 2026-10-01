# Community Core account recovery contract — staging runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status: **CONFIRMED PASS for Wand-side support-assisted identity rebind semantics**

## Scope

This contract deliberately separates two different concerns:

1. **Normal credential recovery** — password/email credential recovery belongs to the Auth provider and should preserve the same provider user/subject.
2. **Exceptional WandAccount recovery** — when support has independently verified that a user needs a new AuthIdentity (for example after a lost or compromised login), Wand may bind that new identity to the existing WandAccount.

The recovery contract must never create a replacement WandAccount, CreatorProfile or ownership graph.

## Data model

`auth_identities` now carries:

- `identity_state = active | retired`
- `retired_at`
- `replaced_by_auth_identity_id`

`account_recovery_cases` is a server-only support record with:

- target WandAccount
- requested provider + provider subject
- optional verification reference
- support reason
- opened/completed admin account
- state + timestamps

Only one OPEN recovery case may exist for a WandAccount at a time.

## Resolution rule

`private.resolve_active_account()` resolves only `identity_state='active'` mappings.

This means a retired provider subject is denied by Wand immediately even if the external Auth provider still has a not-yet-expired access token.

Provider-level refresh/session revocation remains an Auth-adapter/support responsibility; it is not used as the Wand ownership boundary.

## Staff-only commands

- `community_open_recovery_case`
- `community_complete_recovery`

Both are:

- SECURITY DEFINER server functions;
- executable by `service_role` only;
- not executable by `anon` or `authenticated`;
- protected again inside the function by a Wand `admin` role check.

`account_recovery_cases` has RLS enabled and no browser-facing policy/grant.

## Real staging runtime result

A transaction-scoped test created:

- a normal target WandAccount / CreatorProfile;
- an admin WandAccount;
- a target-owned Gallery draft.

The admin then opened and completed a recovery case from an old Supabase subject to a new Supabase subject.

All assertions passed:

- non-admin could not open a recovery case;
- new AuthIdentity resolved to the **same WandAccount**;
- exactly one prior active identity was retired;
- old identity received `retired_at` and `replaced_by_auth_identity_id`;
- old Supabase subject was immediately rejected by `resolve_active_account`;
- CreatorProfile ID and owner account remained unchanged;
- pre-existing Work ownership remained unchanged;
- case became `completed` with the completing admin recorded;
- `account.recovery_opened` and `account.recovery_completed` AuditEvents were created;
- a completed recovery case could not be replayed.

The test transaction was rolled back, leaving no test identity or ownership residue.

## ACL runtime result

Confirmed in real staging:

- anon open RPC EXECUTE: **false**
- authenticated open RPC EXECUTE: **false**
- service_role open RPC EXECUTE: **true**
- anon complete RPC EXECUTE: **false**
- authenticated complete RPC EXECUTE: **false**
- service_role complete RPC EXECUTE: **true**
- anon recovery-case SELECT: **false**
- authenticated recovery-case SELECT: **false**

## Advisor state

After adding FK covering indexes:

- Supabase Security Advisor: **WARN 0**
- unindexed-FK findings for recovery: **0**
- remaining performance findings are unused-index INFO on the low/no-traffic staging database.

## Remaining recovery work

This proves the Wand-side identity/ownership recovery primitive, not the complete end-user recovery experience.

Still required for launch:

- product/Auth-provider password recovery UX;
- recent-auth / step-up rules for self-service credential-sensitive actions;
- support verification policy and staff console;
- provider-level session/refresh-token revocation after exceptional rebind;
- account deletion retention/anonymization policy.

The provider-level revocation step is operational defense in depth; retired Wand AuthIdentity mappings already stop the old subject from performing Community operations immediately.
