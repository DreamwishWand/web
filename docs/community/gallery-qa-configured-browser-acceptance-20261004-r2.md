# Configured Gallery / Q&A browser acceptance — 2026-10-04 R2

## Status

**CONFIGURATION_BLOCKED**

Acceptance target application source:

- current main: `5bb65e217c3e6e0c9c31239936725f90eba9a4cf`
- PR #79 merge commit
- acceptance branch: `integration/community-gallery-qa-browser-20261004`
- harness-only trigger commit: `9c3e2a96d030ebccfee81c8ea3e4117e5cb6a547`
- application/Community source is identical to current main; the only harness delta is one workflow comment recording the target SHA.

## PR #79 delta review

PR #79 changed exactly six files:

- `contracts/native-decoration-preset-restore-v125.contract.json`
- `scripts/product-primary-job-browser-acceptance.mjs`
- `src/lib/presets/native-preset-persistent-restore-v125.js`
- `src/lib/presets/native-preset-runtime.js`
- `tests/native-preset-persistent-restore-v125.test.mjs`
- `tests/native-preset-runtime.test.mjs`

The changes are confined to native DecorationPreset/Core Product handling. The browser script delta only corrects the native preset tombstone fixture to use `StateFlags=0x10`. No Community route, browser client, Edge Function, schema, Auth, RLS, visibility, ownership, moderation, Gallery or Q&A semantic code changed.

Therefore current main is a valid successor acceptance target for the previously engineering-closed Gallery/Q&A vertical.

## Authoritative staging target

- project ref: `ptpdoxhrqopvczpclcij`
- public URL: `https://ptpdoxhrqopvczpclcij.supabase.co`
- browser client key: active modern publishable key named `default`, key id `74a0e0fb-ca3b-4e1c-8d73-20a32462bdad`
- publishable key value is deliberately omitted from evidence
- service-role / secret key was not used in the browser

## Actual GitHub Actions browser run

Workflow: `.github/workflows/community-public-browser-acceptance.yml`

Run:

- id: `37171017769`
- run number: `3`
- job id: `111343812228`
- workflow conclusion: `SUCCESS`

This workflow-level SUCCESS is **not PASS**.

Observed steps:

- Detect public Community configuration: SUCCESS
- Record external-environment browser gate: SUCCESS
- Resolve system Chrome: SKIPPED
- Start local integrated Community UI: SKIPPED
- Run anonymous Gallery/Q&A browser acceptance: SKIPPED

The workflow log emitted:

`Anonymous Gallery/Q&A browser acceptance was not executed because DREAMWISH_SUPABASE_URL / DREAMWISH_SUPABASE_PUBLISHABLE_KEY repository variables are unavailable.`

Therefore the required real Chrome assertions did not execute.

Companion CI on the harness-only fixed head:

- run `37171017740`
- conclusion: SUCCESS

## Configuration blocker

Required GitHub Actions repository variables remain unavailable to the workflow:

- `DREAMWISH_SUPABASE_URL`
- `DREAMWISH_SUPABASE_PUBLISHABLE_KEY`

The current GitHub connector has no repository-variable mutation action. No Auth/RLS weakening, secret substitution, test backdoor or credential commit was performed.

## Signed Gallery / Q&A verticals

Not executed because the public Community browser configuration gate failed before Chrome startup.

The signed flows still require the existing legitimate staging-only A/B/Moderator actors through normal Auth. Actor passwords, JWTs and service-role credentials were not read, synthesized, reset, logged or stored in evidence.

Open browser flows remain:

- Gallery: publish -> discover -> Creator -> save -> reaction -> comment/reply -> report -> moderation -> post-state -> My Gallery
- Q&A: ask -> discover/search -> answer -> Tip -> My Activity -> interaction/currentness -> report -> moderation

## Classification

No Product defect is established.

The correct return is **CONFIGURATION_BLOCKED**.

A workflow-level SUCCESS with skipped Chrome assertions is explicitly non-acceptance.

## Minimal owner action

In `DreamwishWand/web`:

1. Open **Settings -> Secrets and variables -> Actions -> Variables**.
2. Set `DREAMWISH_SUPABASE_URL` to the authoritative staging public URL.
3. Set `DREAMWISH_SUPABASE_PUBLISHABLE_KEY` to the active modern staging publishable key named `default`.
4. Re-run the public-browser workflow against current main or a fixed head with identical application source.
5. Require the Chrome steps to execute, not skip.
6. Then execute the signed Gallery and Q&A Golden flows using the existing staging-only actors through normal Auth.

## Separate gates unchanged

- Profile Workspace HMAC E2E remains separately gated by `COMMUNITY_DDV_PROFILE_BINDING_KEY_V1`.
- DreamSnaps real-round acceptance remains separate.
- Production provisioning remains release-stage only.
- Privacy, Legal and seed/diversity gates remain separate.
