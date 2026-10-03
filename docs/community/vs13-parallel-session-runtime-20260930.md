# Community Core VS-13 parallel-session runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status: **CONFIRMED PASS**

This test used real concurrent PostgreSQL backend sessions against the isolated Supabase staging project. It was not a sequential retry simulation. Fixture identities and data were removed after the test.

## 1. Concurrent Save / Follow / Reaction

Two sessions started after the same one-second synchronization delay and used different PostgreSQL backend PIDs:

- session A PID: **29781**
- session B PID: **29782**

Both sessions concurrently executed, for the same User B and same target:

- `community_save_entity`
- `community_follow_creator`
- `community_add_reaction(..., 'like')`

Both sessions received successful logical responses.

Post-race database state:

- SavedItem rows for (B, target): **1**
- Follow rows for (B, Creator A): **1**
- Reaction rows for (B, target, like): **1**

Result: DB uniqueness + `ON CONFLICT DO NOTHING` preserves one logical interaction under concurrent duplicate requests.

## 2. Concurrent idempotent draft creation

Two different backend sessions concurrently called `community_create_gallery_draft` with the same:

- User B / Creator B
- request payload
- idempotency key: `vs13-concurrent-draft-20260930`

Backend PIDs:

- **29788**
- **29789**

Both calls returned the exact same result:

- workId: `0438267e-bd20-4948-904e-15602a41fa7a`
- rowVersion: `1`

Post-race database state:

- idempotency row: **1**
- response work row: **1**

Result: per-account+idempotency-key advisory locking and stored idempotency response prevent duplicate work creation under concurrent identical commands.

## 3. Concurrent DDV Profile cap race

User B began with exactly two Linked DDV Profiles.

Two different sessions concurrently attempted to link candidate profile #3 and candidate profile #4.

Backend PIDs:

- **29811** — success
- **29812** — rejected with `A Wand Account may link at most three DDV Profiles`

Final database state:

- Linked DDV Profiles: **3**

Result: the account-scoped transaction advisory lock in the DDV Profile cap trigger prevents a fourth link even under a race.

## 4. Concurrent optimistic-write conflict

The same published CommunityWork started at:

- rowVersion: **2**

Two different sessions concurrently called `community_change_work_visibility` using the same `expectedVersion=2`, but different target visibility values.

Backend PIDs:

- **29818** — success; visibility became `unlisted`, rowVersion became **3**
- **29820** — rejected with `Row version conflict`

Final state:

- rowVersion: **3**
- exactly one write won
- search projection count: **0**, consistent with UNLISTED

Result: row locking + optimistic version checking prevents lost updates under concurrent owner mutations.

## Cleanup

The test fixture generated:

- 2 temporary Community identities/accounts
- 2 CommunityWorks
- 1 published revision
- 1 Save / 1 Follow / 1 Reaction
- 3 idempotency records
- 3 Linked DDV Profiles at race completion
- 7 outbox events
- 2 notification events

Cleanup required temporary disabling of only the two revision-deletion immutability triggers because staging test fixture removal is intentionally outside normal product behavior:

- `gallery_work_revisions_immutable`
- `community_work_revisions_immutable`

They were disabled in committed DDL, fixture data was deleted, and both triggers were immediately re-enabled.

Post-cleanup verification:

- fixture AuthIdentity rows: **0**
- fixture CreatorProfile rows: **0**
- fixture WandAccount rows: **0**
- fixture DDVProfile rows: **0**
- `community_work_revisions_immutable`: enabled
- `gallery_work_revisions_immutable`: enabled

No product migration or runtime contract was changed by this test.

## Acceptance impact

VS-13 is now **CONFIRMED PASS** at the Community backend/concurrency boundary for:

- interaction uniqueness;
- concurrent idempotency;
- DDV Profile cap race safety;
- optimistic lost-update prevention.

This does not replace the product-shaped browser acceptance path for the rest of VS-01..VS-15.
