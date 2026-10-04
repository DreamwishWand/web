# Community Core moderation operations launch policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT / BROWSER RUNTIME PENDING**

## Launch moderation model

Dreamwish Wand launch uses the shared Community moderation substrate:

- Report;
- ModerationCase;
- ModerationAction;
- AuditEvent;
- CommunityWork moderation state;
- search/discovery convergence.

The production-shaped staff surface is the hidden `/community-ops/` moderation queue.

## Staff authorization

Moderation review is available only to Wand Accounts with `moderator` or `admin` role.

Moderation writes are high-risk staff actions and require a session created within:

- **900 seconds / 15 minutes**

The proof is session-bound to `auth.sessions.created_at`. Refreshing a JWT does not refresh this
window.

Read-only queue review remains role-gated but does not require recent-auth.

## Queue privacy

The moderation queue may show staff the information required to decide a case:

- case ID and target;
- target Community type;
- current work lifecycle/visibility/moderation state;
- current Gallery title when available;
- report ID;
- report reason code;
- report free-text detail;
- report state/timestamps;
- prior moderation actions.

The queue deliberately omits the reporter WandAccount identity. Reporter identity remains canonical
for abuse/security handling where required but is not needed for routine moderation review.

Provider subject, email, password/token, private DDV profile data and signed media URLs are not
moderation-queue fields.

## Actions

Current CommunityWork actions:

- `restrict`;
- `remove`;
- `restore`.

Actions remain reversible where the underlying content still exists. Each action persists a
ModerationAction and AuditEvent and updates search/discovery consistently through the existing
moderation transaction.

When an Ops moderation action resolves a case, linked `open` / `triaged` reports are closed in
the same staff operation. This prevents a resolved case from leaving stale open reports that
indefinitely block account retention.

## Automated moderation provider

A third-party automated moderation provider is **not a first-launch dependency**.

First-launch acceptance instead requires:

- report creation from the product surface;
- staff queue visibility;
- moderator/admin authorization;
- restrict/remove/restore;
- audit history;
- discovery convergence;
- actionable response procedures.

Automated text/image moderation may be added later if public scale, abuse volume or response-time
requirements justify it. Any future provider must be an advisory/signal source feeding the canonical
ModerationCase model; it must not become the source of truth or bypass Wand visibility/ownership
rules.

This provider-free baseline reduces private-content sharing with third parties and avoids making
Community availability depend on an external moderation API.

## Staging backend runtime evidence

A rollback-scoped staging fixture used a synthetic moderator identity/session, CommunityWork,
Report and ModerationCase.

Observed:

- moderation queue result count = 1;
- reporter identity exposed by queue = false;
- `restrict` changed work moderation state to `restricted`;
- case state became `resolved`;
- attached report state became `closed`;
- one ModerationAction was written;
- changing the synthetic session age to 16 minutes caused the next moderation write to fail with
  `Recent authentication required`.

The transaction was rolled back and left no fixture state.

## Launch acceptance

Before public launch:

1. execute report creation in the real browser product path;
2. sign in to Community Ops with a real staging moderator/admin;
3. verify the case appears without reporter identity;
4. apply restrict with a fresh <=15-minute staff session;
5. confirm target discovery/access convergence and linked report closure;
6. restore where appropriate and confirm reversibility;
7. repeat with a >15-minute staff session and require `RECENT_AUTH_REQUIRED`;
8. confirm AuditEvent / ModerationAction history;
9. document the operator response procedure and expected review cadence.

No automated moderation-provider account or secret is required for first launch.
