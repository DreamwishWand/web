# Community Core moderation operations runtime — 2026-09-30

Status: **CONFIRMED STAGING BACKEND / BROWSER OPERATOR PENDING**

## Scope

This acceptance closes the backend/operator contract for manual moderation before selecting any
automated moderation provider.

Launch does not require an automated moderation vendor. It does require a usable moderator/admin
queue, reversible actions, audit history, search/discovery convergence, and correct report lifecycle.

## Production-shaped contract

Community Ops exposes:

- moderation-case listing for moderator/admin roles;
- case state filter: open / reviewing / resolved / closed;
- minimized report evidence: report ID, reason code, optional detail, status, timestamps;
- no reporter-account identity in the operator listing;
- current target work state/title when the target is a CommunityWork;
- prior moderation actions;
- restrict / remove / restore actions.

Moderation actions use the same session-bound recent-auth proof source as other high-risk operations:

- provider session source: `auth.sessions.created_at`;
- launch default: **900 seconds / 15 minutes**;
- permitted roles: moderator or admin;
- JWT refresh does not reset the recent-auth clock.

## Report convergence

A successful restrict/remove/restore operation resolves the ModerationCase through the canonical
moderation action path.

The v2 moderation wrapper also closes any linked reports still in `open` or `triaged` state.
This prevents a resolved moderation case from leaving an orphan open report that would incorrectly
hold account-retention work indefinitely.

Report evidence is not deleted during moderation resolution; retention policy controls later
operational-detail scrubbing.

## Staging rollback runtime acceptance

A disposable transaction created:

- one synthetic Supabase Auth user;
- one stale provider session (20 minutes);
- one fresh provider session;
- one moderator WandAccount/AuthIdentity;
- one disposable published PUBLIC Gallery work;
- one SearchDocument;
- one open Report + ModerationCase.

Observed:

- stale 20-minute session rejected by recent-auth: **PASS**;
- fresh session restrict action -> moderationState `restricted`: **PASS**;
- linked reports closed by restrict: **1**;
- report state after restrict: `closed`;
- case state after restrict: `resolved`;
- SearchDocument count after restrict: **0**;
- restore action -> moderationState `clear`: **PASS**;
- SearchDocument count after restore: **1**;
- moderation actions recorded: **2**;
- moderation audit actions recorded: **2**;
- moderation-case listing contains reporter-account identity: **false**.

The entire fixture transaction was rolled back. No synthetic Auth user/session/Community content was
retained.

## Edge / UI boundary

- `community-command` moderation now calls `community_moderate_work_v2` and requires JWT
  `session_id`.
- `community-admin` exposes `listModerationCases` and `moderateCase`.
- `/community-ops/` exposes the moderation review queue and action controls.
- both command/admin adapters return `RECENT_AUTH_REQUIRED` for expired step-up sessions.
- Edge functions are deployed with JWT verification enabled.

## Automated moderation boundary

Automated moderation/provider selection remains optional launch hardening.

Any future automated signal must create or enrich the canonical Report/ModerationCase substrate. It
must not become a parallel moderation state machine or directly override Community visibility without
an auditable canonical action.

## Remaining acceptance

Still pending:

1. real browser Moderator/Admin execution through `/community-ops/`;
2. product-specific report reason vocabularies;
3. final staffing/escalation runbook for public launch;
4. any automated moderation provider choice if later justified by observed volume/abuse.

Manual moderation backend viability is CONFIRMED.
