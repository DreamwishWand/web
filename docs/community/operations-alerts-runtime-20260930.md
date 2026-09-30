# Community Core operations alerts runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — persistent alert detection/state machine at the real staging database boundary.
- **IMPLEMENTED / CI PASS** — JWT/admin Edge adapter and hidden Community Ops UI.
- **PENDING** — browser/operator execution with a real staging admin and any external escalation channel selected for production.

## Scope

Persistent operations alerts cover three release-critical conditions:

1. provider cleanup job reaches `dead_letter`;
2. Community outbox event reaches dead-letter state;
3. provider cleanup Cron/worker heartbeat is inactive or stale.

Migration:

`supabase/migrations/20260930081000_community_core_v0_operations_alerts.sql`

Cron:

`community-operations-alerts-every-minute`

## State model

Alerts are stored in the private schema and use:

`open -> acknowledged -> resolved`

Resolution is condition-driven rather than manually hiding an incident.

- if the underlying dead-letter condition clears, the alert resolves automatically;
- if a scheduler heartbeat recovers, the scheduler alert resolves automatically;
- if a previously resolved condition recurs, the same dedupe key reopens as a clean `open` alert;
- recurrence clears prior acknowledgment metadata so a new incident cannot remain silently acknowledged.

## Privacy boundary

Provider subjects and worker/Vault secrets are never copied into operations-alert rows or operator API responses.

Provider cleanup alert metadata contains only operational fields such as attempt count and dead-letter time.
Outbox alert metadata contains event/aggregate type, attempts and failure time.
Scheduler alert metadata contains only Cron active state and last verified worker time.

## Operator authorization

Read path:

`community_get_operations_alerts`

- requires an active WandAccount with admin role;
- returns operational alert metadata only.

Write path:

`community_admin_ack_operations_alert`

- requires admin role;
- requires session-bound recent authentication;
- stores operator note and acknowledgment account/time;
- writes `operations_alert.acknowledged` to AuditEvent.

The hidden `/community-ops/` route and JWT-required `community-admin` Edge adapter expose list/filter/acknowledge without exposing service credentials.

## Real staging runtime

A transaction-scoped staging test created synthetic provider-cleanup and outbox dead letters, exercised the alert state machine, and rolled the fixture back afterward.

Confirmed **7/7**:

1. provider cleanup and outbox dead letters opened persistent alerts;
2. admin alert listing did not expose the provider subject;
3. a fresh-session admin acknowledged the provider cleanup alert;
4. acknowledgment produced an AuditEvent;
5. a stale provider-cleanup worker heartbeat produced a critical scheduler alert;
6. clearing both dead-letter conditions and restoring worker heartbeat auto-resolved all three alerts;
7. reintroducing the provider cleanup failure reopened the resolved alert with prior acknowledgment fields cleared.

Post-test state:

- synthetic alert rows remaining: **0**;
- `community-provider-cleanup-every-minute`: active, every minute;
- `community-operations-alerts-every-minute`: active, every minute;
- provider-cleanup worker heartbeat continues to update.

## Current evidence boundary

Operations alerting is now **backend/runtime CONFIRMED** and operator UI is **implemented/CI-green**.

Still pending:

1. sign in to `/community-ops/` with a real staging admin;
2. observe a real/safely-induced alert through the browser route;
3. acknowledge it through the deployed `community-admin` Edge path;
4. choose and validate any launch-required external escalation channel (for example email/on-call) if Wand operations require alerts outside the internal console.

No password, JWT, provider subject, worker token, Vault secret or API secret is recorded here.
