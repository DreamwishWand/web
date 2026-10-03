# Community Core staging runtime gate v0

This runbook starts only after an isolated staging backend exists. It must not reuse production credentials or touch the public GitHub Pages deployment.

## Required staging resources

- Supabase project dedicated to Dreamwish Wand staging.
- PostgreSQL/Auth enabled.
- Three test identities: User A, User B, Moderator.
- Server-only service-role credential stored only in the staging runtime secret store.
- Public anon URL/key may be exposed only to code paths intended for public/read access.
- A staging media adapter/object store. Production direction is Cloudflare R2; do not make Supabase Storage a hidden production dependency merely because the database is Supabase.

Never commit service-role keys, access tokens, test passwords, DDV saves, receipts, Moonstones/entitlement data, or raw account identifiers.

## Database bootstrap

1. Start from an empty isolated staging database.
2. Apply migrations in repository order.
3. Verify all expected tables, enums, functions, triggers, indexes and RLS enablement.
4. Verify ordinary authenticated roles have no direct INSERT/UPDATE/DELETE policy on canonical community state.
5. Verify server command execution can atomically commit canonical state plus outbox event.
6. Verify migration rollback/rebuild procedure before persistent staging data matters.

Current first migration:

- `supabase/migrations/202609300001_community_core_v0.sql`

## Auth mapping gate

For each staging Auth user:

1. Resolve the Supabase Auth subject.
2. Create/reuse exactly one WandAccount.
3. Create exactly one `auth_identities(provider='supabase', provider_subject=<auth subject>)` mapping.
4. Confirm sign-out/session revocation does not change WandAccount, CreatorProfile or ownership IDs.
5. Assign Moderator through server-only `account_roles`; never accept a browser-supplied moderator flag.

Recovery-provider UX remains out of scope for this staging gate, but identity replacement is forbidden.

## Server command boundary

Implement `CommunityCommandBus` server-side. Each mutating request must:

1. authenticate the external identity;
2. resolve WandAccount;
3. check account status;
4. validate command payload and subtype adapter;
5. enforce owner/staff authorization;
6. honor idempotency key;
7. check expected rowVersion when applicable;
8. execute canonical state mutation and OutboxEvent in one DB transaction;
9. return only stable IDs/state required by the caller;
10. emit security/audit metadata without copying auth secrets.

Do not run a sequence of independent REST writes that can publish content without its outbox event.

## Media gate

Before `PublishWork` succeeds:

- every referenced MediaAsset is owned/controlled by the work owner;
- upload/processing state is READY;
- moderation state permits use;
- MIME/type/dimensions/size are validated;
- public delivery is derived from published-accessible content, not from possession of a storage key;
- changing work privacy/moderation removes public delivery authorization.

Original user uploads remain private by default.

## VS-01 through VS-15 runtime execution

Use two non-privileged accounts A/B and one moderator.

Record for every case:

- command/request correlation ID;
- stable entity/work/revision IDs;
- HTTP/result status;
- database state relevant to the assertion;
- outbox/notification/search state;
- PASS/FAIL and failure reason.

Required groups:

- VS-01 identity / Creator stability.
- VS-02 Gallery draft -> validated media -> immutable publish revision.
- VS-03 public discovery/search identity consistency.
- VS-04 saves/follows/reactions/comments/replies + retry idempotency.
- VS-05 linked Preset save into B Library without ownership transfer.
- VS-06 notification delivery and self/save suppression.
- VS-07 reporting.
- VS-08 reversible moderation + search/media convergence.
- VS-09 negative authorization.
- VS-10 PRIVATE/UNLISTED/PUBLIC behavior.
- VS-11 stale SavedItem does not grant access.
- VS-12 media publish/delivery guards.
- VS-13 concurrent uniqueness.
- VS-14 transaction/outbox failure atomicity.
- VS-15 tombstone/history preservation.

## Exit condition

Community Phase 2 runtime is not PASS until all VS-01..VS-15 pass against real staging PostgreSQL/Auth and the selected media/runtime adapters without direct database repair between test steps.

The draft PR remains unmerged while this gate is pending. Product workstreams may consume the logical contract, but must not introduce competing persistent identity/interaction models.
