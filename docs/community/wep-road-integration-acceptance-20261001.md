# COMM ↔ WEP Road-inclusive Scene integration-sensitive acceptance — 2026-10-01

Status: **CONFIRMED / APPLY BLOCKED BY DESIGN**

Machine-readable evidence:
`ops/community-wep-road-integration-acceptance-20261001.json`.

## Why this acceptance was run

The previously confirmed Scene Preset Community vertical was not rerun wholesale.

WEP changed the Scene artifact shape by binding the merged current-v1.25 native Road/Fence reader
and adding Road topology to portable Scene capture. That is an integration-sensitive change, so
COMM-5 required one targeted regression at the changed boundary:

`publication -> discovery -> Library -> signed read -> WEP preflight -> Apply boundary`.

The existing Community retention plumbing was not changed or re-exercised as a retention test.

## WEP side — CONFIRMED STATIC CI

WEP checkpoint:

- branch: `dev/wep-v125`;
- HEAD: `4af63c9fc9a6a2a6954e0a5bdd6d4df54a678c28`;
- GitHub Actions: `36796732109` SUCCESS;
- 365 tests / 353 PASS / 0 FAIL / 12 fixture-dependent SKIP;
- Edge type checks PASS;
- Svelte/TypeScript PASS;
- static production build PASS.

The WEP regression uses the real publish-envelope validator and Scene preflight hooks for a
Road-inclusive Scene artifact. It proves:

- logical Road network `r0` survives the WEP Community bridge round-trip;
- downloaded artifact revalidation succeeds;
- destination preflight remains fail-closed;
- issue `ROAD_TOPOLOGY_APPLY_UNAVAILABLE` is present;
- `writeReady=false`.

This is the required current writer boundary. No persistent Road or save mutation was promoted.

## Live staging delta — CONFIRMED

A single temporary internal staging harness was used for the Road artifact delta only.

It created two disposable, email-confirmed Supabase Auth users using the Admin API without sending
confirmation mail, signed them in normally, and exercised only the existing production-shaped
Community/WEP endpoints.

The live path successfully completed:

1. WandAccount/Creator bootstrap;
2. WEP signed Preset upload preparation;
3. real private Storage upload;
4. server-side Scene/Road artifact validation;
5. PUBLIC Preset publication;
6. public SearchDocument discovery;
7. second-user work -> Preset resolution;
8. second-user Library Save;
9. Preset detail read;
10. signed private ArtifactBlob read;
11. exact SHA-256 verification;
12. exact byte-size verification;
13. JSON Road envelope round-trip;
14. verification that Road network ID is `r0`;
15. verification that `persistentWriteAuthorized=false`.

The Edge request completed with HTTP 200 after 14.286 seconds. The temporary harness returns HTTP
500 on any assertion/runtime failure, so the 200 response is the acceptance PASS boundary.

The caller used pg_net only as a one-time internal transport to invoke the temporary function.
pg_net's client timeout was five seconds, so it did not retain the response body even though the
Edge execution completed successfully. Function-edge logs independently record the HTTP 200 result.

## Cleanup — CONFIRMED

Immediately after the run:

- disposable provider users remaining: 0;
- disposable creator handles remaining: 0;
- matching public Search results remaining: 0;
- new WEP Preset Storage objects remaining: 0;
- matching provider-cleanup jobs remaining: 0.

The normal account-deletion contract intentionally leaves:

- 2 AccountDeletionEvent records;
- 4 future retention jobs (content + operational for each account).

These are normal retention/audit state, not failed test residue. They were not bypassed or deleted
with direct SQL.

The temporary `wep-preset-flow-e2e` function was immediately restored to:

- version 6;
- `verify_jwt=true`;
- HTTP 410 `STAGING_E2E_DISABLED`;
- SHA-256 `6f5b62c8b151a162e4a9deabde66b069e94fa6cf472ec8f3d51a633f96737342`.

No acceptance harness remains executable.

## Classification

**CONFIRMED RUNTIME**

- Community/WEP server publication boundary accepts the new Road-inclusive Scene envelope;
- PUBLIC discovery;
- second-user Library Save;
- signed ArtifactBlob read;
- checksum/size integrity;
- exact Road envelope survival;
- cleanup and harness disable.

**CONFIRMED STATIC CI**

- WEP artifact revalidation;
- Road-aware destination preflight;
- `ROAD_TOPOLOGY_APPLY_UNAVAILABLE`;
- `writeReady=false`.

**CONFIRMED COMPOSED INTEGRATION-SENSITIVE ACCEPTANCE**

The new Road artifact delta composes with the already runtime-proven Community Scene path without a
Community transport/retention change. The prior full primary/closure browser suites therefore remain
valid and were not repeated.

## Boundaries still open

- Persistent Apply remains BLOCKED by Core/WEP writer authorization.
- `WORLD_PERSISTENT_WRITE_V125=false`.
- `persistentWriteAuthorized=false`.
- WEP still hardcodes `wand-preset-artifacts-staging` in the Preset artifact/retention Edge
  functions. Production bucket externalization remains a separate 02 WEP deployment blocker.
- Comprehensive current-v1.25 GridData dimensions remain Core-owned and open for full-design
  placement/apply readiness.
