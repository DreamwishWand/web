# Gallery/Q&A configured browser acceptance — 2026-10-04

## Result

**CONFIGURATION_BLOCKED**

Target source/build:

- repository: `DreamwishWand/web`
- main: `d38bb0e188e79ce28dd974860cbc3173bf190d56`
- Pages workflow run: `37166343197` — SUCCESS
- Pages artifact: `11289094503`
- artifact digest: `sha256:c4447a2c68b2402e1688528352615e77f4a8931c5a09c7f6ac1d248e1d964def`

No Community semantics, Gallery/Q&A domain model, Auth/RLS boundary, retention policy, DreamSnaps gate, Profile Workspace HMAC boundary or production resources were changed.

## Authoritative staging public configuration

Existing staging Supabase project only:

- project ref: `ptpdoxhrqopvczpclcij`
- public URL: `https://ptpdoxhrqopvczpclcij.supabase.co`
- active publishable key: Supabase key name `default`, type `publishable`, key id `74a0e0fb-ca3b-4e1c-8d73-20a32462bdad`
- legacy anon key also exists and is enabled, but the modern publishable key is the intended browser value.

The publishable key value is deliberately not recorded in source-controlled evidence.

## Configuration blocker

Current main reads browser configuration only from build-time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The current Pages artifact was built with both values absent. The compiled Community config chunk contains empty strings and the product correctly fails closed with the config-unavailable state.

The GitHub connector available to this workstream has no repository-variable read/write mutation action and its generic GitHub fetch surface is GET-only for the relevant repository resources. Therefore this session cannot safely set GitHub Actions repository variables.

### Minimal owner action

In the `DreamwishWand/web` repository:

1. Open **Settings -> Secrets and variables -> Actions -> Variables**.
2. Set `DREAMWISH_SUPABASE_URL` to `https://ptpdoxhrqopvczpclcij.supabase.co`.
3. Set `DREAMWISH_SUPABASE_PUBLISHABLE_KEY` to the active staging Supabase publishable key named `default` (key id above).
4. Re-run/build the fixed current-main Community browser surface. Do not use a service-role/secret key.

For the signed Gallery/Q&A vertical, use the existing staging-only A/B/Moderator actors through a normal password browser session in a network-enabled Chrome. Actor passwords/JWTs must not be committed, copied into evidence, or recreated through SQL/admin backdoors.

## Browser execution limitation in this session

A real Chromium 144 binary is present, but the execution sandbox blocks browser navigation to localhost/container addresses and external network targets. This is an execution-environment restriction, not a Wand defect.

Because the Pages build-time config is absent and the local Chromium network is blocked, the required configured real-network Chrome assertions cannot be truthfully classified PASS here.

## Nonblocked verification completed

### Current-main / staging deployment parity

The deployed staging Edge source is byte-exact with current main for:

- `community-public-query` v2 ACTIVE, `verify_jwt=false`
- `community-public-media` v2 ACTIVE, `verify_jwt=false`
- `community-command` v28 ACTIVE, `verify_jwt=true`
- `community-query` v13 ACTIVE, `verify_jwt=true`
- `community-admin` v16 ACTIVE, `verify_jwt=true`

### Public authorization boundary

Direct function grants remain fail-closed:

- `community_get_gallery_public_v1`: anon/authenticated EXECUTE = false; service_role = true
- `community_get_question_public_v1`: anon/authenticated EXECUTE = false; service_role = true
- `community_get_tip_public_v1`: anon/authenticated EXECUTE = false; service_role = true
- `community_get_public_media_storage_v2`: anon/authenticated EXECUTE = false; service_role = true
- `community_search_public` remains the intended SECURITY INVOKER anonymous search surface.

### Existing staging public fixture

Current staging contains:

- PUBLIC/CLEAR/PUBLISHED Gallery works: 1
- PUBLIC Questions: 0
- PUBLIC Tips: 0

For the existing Gallery fixture:

- anon `community_search_public` finds the Work;
- public detail resolves the same Work;
- Creator attribution is present;
- public media storage authorization succeeds;
- owner-account identity is not exposed in the public detail projection.

This confirms the backend/public projection has no observed current-main regression, but it is not a substitute for configured Chrome acceptance.

## Explicitly not closed

- anonymous Gallery card -> media render -> direct-read Chrome sequence;
- page-error = 0 / console-error = 0 configured public run;
- signed Gallery publish -> discover -> Creator -> save -> reaction -> comment/reply -> report -> moderator action -> post-moderation -> My Gallery;
- signed Q&A ask -> related behavior -> discover -> answer -> Tip -> My Activity -> currentness/interaction -> report -> moderation;
- Profile Workspace HMAC E2E (`COMMUNITY_DDV_PROFILE_BINDING_KEY_V1`) — separate configuration gate;
- DreamSnaps real-round gate — unchanged;
- production provisioning / Privacy / Legal / launch seed — unchanged.

## Classification

No product defect was proven.

The correct status is **CONFIGURATION_BLOCKED** until the staging public browser variables are configured and a network-enabled real Chrome run executes the required anonymous and signed assertions.
