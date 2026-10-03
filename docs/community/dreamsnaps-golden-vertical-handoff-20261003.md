# DreamSnaps Golden Vertical — 00 CTRL Handoff — 2026-10-03

## Scope

Workstream: Community / DreamSnaps Golden Vertical.

Working branch only:
`dev/community-dreamsnaps-vertical-20261003`

Frozen base:
`775c5d50d80ad68c4c2c5f37f94bb09835222f12`

No merge or promotion was performed. No production resources were created or modified.

Canonical product placement remains:

- DreamSnaps: Submit / Judge / Results / My DreamSnaps
- Gallery > DreamSnaps: post-Results public browsing
- Gallery remains noncompetitive.

## Engineering status

**CONFIRMED — GOLDEN VERTICAL ENGINEERING ACCEPTANCE PASS on staging.**

The implemented lifecycle is:

1. Register a private DreamSnaps Work and validated screenshot revision.
2. Join a challenge explicitly; registration does not consume the competition right.
3. Freeze a specific Entry revision. Editing the Work creates a new revision without silently changing the Entry.
4. Enforce one Entry right per Wand Account per challenge.
5. Run blind formal judging with configurable per-round allowance.
6. After the formal allowance is exhausted, optionally allow browse reactions and a separately configured Special Pick allowance.
7. Close judging and finalize Wand Results.
8. Keep In-Game Results separate and private by default.
9. Ingest In-Game Results only from trusted `save` / `official_evidence` provenance through a service-role RPC.
10. Allow owners, after Results, to opt in selected In-Game Result fields for public projection.
11. Allow post-Results publication of the frozen competition revision to Gallery > DreamSnaps.
12. Reuse shared Community save/reaction/comment/report/moderation infrastructure without exposing active competition identity/social/result signals.

## Database migrations

Applied successfully to staging project `ptpdoxhrqopvczpclcij`:

- `20261003044300_community_dreamsnaps_schema_v1.sql`
- `20261003044400_community_dreamsnaps_commands_v1.sql`
- `20261003044500_community_dreamsnaps_projection_v1.sql`
- `20261003044600_community_dreamsnaps_native_revision_fix_v1.sql`
- `20261003044700_community_dreamsnaps_integrity_pool_v1.sql`
- `20261003044800_community_dreamsnaps_ingame_result_provenance_v1.sql`

Important invariant correction found by acceptance testing:

DreamSnaps does **not** masquerade as `GalleryWork`. Existing Gallery invariants were preserved. DreamSnaps uses `CommunityWork(work_type=dreamsnap)` plus dedicated DreamSnaps revision/competition tables, and projects to Gallery only after Results.

## Competition / integrity contracts

**CONFIRMED**

- One screenshot per competition revision.
- Round image dimensions/aspect are policy data, not hard-coded product constants.
- Invalid aspect/dimension validation fails closed.
- Screenshot and no-external-edit attestations are required.
- Integrity state: `eligible | under_review | rejected`.
- Suspicion flags/reason are first-class assessment data.
- `under_review` / `rejected` blocks or removes competition eligibility.
- One active competitive image link per DreamSnaps revision.
- Active Judge pool excludes moderation-blocked and integrity-blocked entries.
- Real-pool gate requires both:
  - minimum eligible real-user Entry count, and
  - minimum distinct Creator count.
- Fixture/synthetic/staff-origin content cannot satisfy a real-user launch floor.
- Account—not DDV Profile Workspace—is the competition right boundary.
- Parent/guardian-managed Workspace can provide child DDV context, but does not multiply rights.
- Managed-under-13 Gallery publication forces comments off.

## Blind Judge / result privacy

**CONFIRMED**

Active Judge projection exposes only competition-safe identifiers/media:
- Entry ID
- frozen Entry revision ID
- media ID

It does not expose Creator/Profile/owner identity, follows, saves, reactions, comments, current rank, vote count, Wand score, or In-Game Result fields.

Formal votes, post-formal browse reactions, and Special Picks are stored and authorized separately.

Wand Results and In-Game Results are separate data domains.

In-Game Results:
- are private by default;
- cannot be entered through the authenticated browser command API;
- require service-role ingest with `save` or `official_evidence` provenance, source reference, and observation time;
- become public only by explicit field-level owner opt-in after Results.

## UI / localization

Implemented first-party routes:

- `/dreamsnaps/`
- `/dreamsnaps/submit/`
- `/dreamsnaps/judge/`
- `/dreamsnaps/results/`
- `/dreamsnaps/my/`
- `/gallery/dreamsnaps/`

DreamSnaps catalogs cover all launch locales with identical key sets:

- EN
- FR
- IT
- DE
- ES-ES
- JA
- ZH-CN
- PT-BR

The shared Web accessibility/localization CI gate passes.

## Staging runtime acceptance

Saved reproducible rollback acceptance:

`supabase/staging/acceptance/dreamsnaps-golden-vertical-20261003.sql`

**PASS** on staging after all migrations through `20261003044800`.

The rollback acceptance covers:

- invalid/ineligible screenshot rejection;
- suspicious `under_review` rejection and later clearance;
- entry-count + distinct-creator real-pool floor;
- one Wand Account / one Entry right;
- registration vs Join separation;
- Work revision update without Entry revision mutation;
- explicit Entry revision replacement and post-freeze rejection;
- pre-Results Gallery publication rejection;
- blind Judge response;
- self-vote rejection;
- formal vote allowance and ceiling;
- post-formal browse gating;
- Special Pick allowance and ceiling;
- Wand Results finalization;
- trusted In-Game Result ingestion;
- private-default In-Game Result projection;
- field-level public opt-in;
- post-Results Gallery publication;
- managed-under-13 comments forced off;
- save / reaction / comment;
- report -> ModerationCase;
- moderation restrict/restore projection into DreamSnaps eligibility/public visibility.

Rollback cleanup verified after execution:

- acceptance challenge rows = 0
- acceptance media rows = 0
- DreamSnaps Work rows = 0
- DreamSnaps Entry rows = 0

## Edge runtime

Staging deployments used by the accepted vertical:

- `community-command` v28 ACTIVE
- `community-query` v13 ACTIVE
- `community-media` v8 ACTIVE
- `community-admin` v16 ACTIVE
- `community-public-query` v2 ACTIVE
- `community-public-media` v2 ACTIVE

Public query allowlist does not expose Judge.

## CI evidence

Accepted code HEAD before this handoff-only commit:

`d4c45812f38f319c1a3452830a026182830d8b9a`

GitHub Actions CI run:

`37107581846` — **SUCCESS**

Successful steps include:

- Edge Function type checks
- Type and component checks
- shared accessibility/localization gate
- canonical baseline integrity
- Community operations contract
- integrated production tree preflight
- contract tests
- static build

## Launch blocker

**SEED-DREAMSNAPS remains BLOCKED.**

Do not count staging fixtures or rollback test content.

Release acceptance still requires one real-user round meeting the canonical floor:

- **24 eligible real entries**
- **12 distinct real creators**

The schema supports these values as per-round policy; acceptance fixtures deliberately use smaller rollback-only thresholds and do not alter launch acceptance.

## 00 CTRL next action

1. Review/integrate `dev/community-dreamsnaps-vertical-20261003` when authorized.
2. Keep `SEED-DREAMSNAPS` blocked until real-user evidence reaches 24 eligible Entries / 12 Creators.
3. Run the saved rollback acceptance after any material DreamSnaps domain/Community integration change.
4. Do not reopen closed Product semantics unless a concrete contradiction is found.

No further DreamSnaps implementation work is identified on this branch before Control integration and real-user seed/round evidence.
