# Community Core action rate-limit runtime — 2026-09-30

Status: **CONFIRMED STAGING BACKEND + ACTIONABLE CLIENT 429 HANDLING / BROWSER RUNTIME PENDING**

## Purpose

Community action abuse limits are shared infrastructure rather than separate Product-specific
implementations.

Supabase Auth rate limits continue to protect authentication/recovery endpoints. This substrate
covers authenticated Wand Community actions after a WandAccount exists.

## Storage / privacy boundary

Private tables:

- `private.community_action_rate_policies`
- `private.community_action_rate_windows`

Counters are keyed by stable WandAccount ID + bucket + fixed window.

The limiter does not store:

- IP address;
- device fingerprint;
- email;
- provider subject;
- password/recovery data;
- raw request payload.

The private tables are not browser/Data API models and are not generated into public application
schema types.

## Enforcement

Service-only RPC:

`community_consume_action_rate_limit(authSubject, bucket)`

Behavior:

1. resolve the active WandAccount from the verified provider subject;
2. fail closed on an unknown bucket;
3. load the configuration-driven bucket policy;
4. serialize same-account/same-bucket consumption with a PostgreSQL advisory transaction lock;
5. use a deterministic fixed window;
6. increment the private counter only while below the limit;
7. return `allowed=false`, `retryAfterSeconds` and `resetAt` after exhaustion.

The limiter is database-backed, so separate Edge instances share the same state.

Browser-facing enforcement is wired into:

- CreatorProfile write;
- Gallery create/publish/visibility/unpublish/delete;
- Save/Unsave;
- Follow/Unfollow;
- Reaction add/remove;
- Comment/Reply;
- Report;
- moderator/admin work moderation;
- media signed-upload preparation.

First identity bootstrap is not counted because the WandAccount does not exist yet; Auth provider
signup protections remain authoritative there.

Public anonymous discovery/search is not keyed to WandAccount and is intentionally outside this
database account limiter. Its request-volume control belongs to the deployment/API/CDN boundary.
Search query length/result caps remain in the Community search contract.

## Current engineering defaults

All defaults use a 3600-second fixed window:

| Bucket | Max actions/hour |
| --- | ---: |
| profile_write | 20 |
| gallery_write | 60 |
| save | 240 |
| follow | 120 |
| reaction | 300 |
| comment | 90 |
| report | 12 |
| moderation_write | 120 |
| media_prepare | 30 |

These are **engineering launch defaults**, not immutable product semantics. They remain
configuration-driven and must be reviewed after closed-beta/load/abuse evidence.

Existing media byte-size protection remains separate: staging media upload validation rejects files
over 25 MiB before signed-upload preparation.

## Edge behavior

`community-command` and `community-media` return:

- HTTP 429;
- error = `RATE_LIMITED`;
- bucket;
- retryAfterSeconds;
- resetAt.

Unexpected limiter RPC failure returns `RATE_LIMIT_CHECK_FAILED` rather than silently bypassing
enforcement.

`community-admin` exposes read-only `listActionRatePolicies` for the hidden Community Ops
console. Private counters are not exposed.

## Rollback staging runtime acceptance

A disposable transaction created two active WandAccounts/AuthIdentity mappings and temporarily
changed only the transaction-local `report` policy to two actions/hour.

Observed:

- Account A first consume: allowed = true;
- Account A second consume: allowed = true;
- Account A third consume: allowed = false;
- rejected consume returned retryAfterSeconds > 0;
- Account B first consume in the same bucket/window: allowed = true;
- Account A stored count = 2;
- Account B stored count = 1;
- unknown bucket rejected fail-closed = true.

The transaction was rolled back. No fixture account/counter or temporary policy value remained.

## Browser 429 handling

The shared browser client now raises a typed `CommunityHttpError` and converts
`429 RATE_LIMITED` into an actionable message containing the affected action bucket plus approximate
retry seconds. The original retry/reset metadata remains available on the error object.

This is implemented and contract-tested; a real browser exhaustion probe is still required.

## Remaining acceptance

1. trigger a real browser/Edge 429 through the Community Lab and verify the implemented actionable UX;
2. review/tune engineering defaults using closed-beta/load/abuse evidence;
3. decide deployment-layer anonymous search throttling before broad public exposure;
4. preserve Supabase Auth endpoint/IP protections and transactional-email provider quotas separately.

The shared action-rate infrastructure is CONFIRMED at the staging backend boundary.
