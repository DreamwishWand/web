# Community Core VS-02 / VS-12 real media network runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status: **CONFIRMED PASS at the Community backend/network boundary**

This test exercised the deployed Supabase Auth, Community Edge Functions and private Storage bucket over real HTTP. It did not insert a fake MediaAsset row or bypass the media adapter.

## Path exercised

A one-time staging harness used a single-use, short-lived nonce stored only as a SHA-256 hash in a private database table. The harness source contained no service-role key, publishable key, nonce or user password. Supabase-provided runtime secrets were used only inside the Edge runtime.

The harness performed:

1. create an ephemeral Supabase Auth user through the supported Admin Auth API;
2. password sign-in and obtain a real user JWT;
3. call JWT-required `community-command.ensureAccountCreator`;
4. call JWT-required `community-media.prepare`;
5. upload an actual PNG file to the returned signed Storage upload URL using HTTP `PUT` + multipart form data;
6. call `community-media.finalize`;
7. server-side re-download of the object from the private bucket;
8. server-side image signature/dimension validation and SHA-256 calculation;
9. READY MediaAsset registration;
10. call `community-media.read`;
11. fetch the returned signed read URL and compare returned byte length to the uploaded file;
12. create a PRIVATE Gallery draft;
13. publish it through `community_publish_gallery_v3` with the validated MediaAsset;
14. query the published work through the JWT-required Community query boundary.

## Confirmed HTTP/runtime results

All required stages returned HTTP 200:

- identity command: **200**
- media prepare: **200**
- signed Storage upload: **200**
- media finalize: **200**
- media read/sign: **200**
- signed read URL fetch: **200**
- media-backed Gallery publish: **200**
- authorized work query: **200**

Server-side media validation result:

- detected MIME: **image/png**
- dimensions: **1 × 1**
- SHA-256 length: **64 hex characters**
- signed-read byte length matched uploaded byte length: **true**

Publication result:

- non-empty MediaAsset ID returned;
- non-empty Work ID returned;
- non-empty published Revision ID returned;
- work readback lifecycle: **published**.

The normal v3 publication path was used, so the existing sealed-revision and media-relation immutability guards applied.

## Safety / cleanup

The one-time E2E function was immediately replaced with a `verify_jwt=true` 410-only stub after the single invocation.

The harness removed the Storage object and Supabase Auth user in its `finally` path.

The remaining Community fixture was then removed from staging. Cleanup verification returned:

- AuthIdentity: **0**
- CreatorProfile: **0**
- MediaAsset: **0**
- CommunityWork: **0**
- CommunityWorkRevision: **0**
- Storage object: **0**
- WandAccount: **0**

The three temporarily disabled fixture-cleanup immutability triggers were all re-enabled:

- `work_revision_media_immutable`
- `gallery_work_revisions_immutable`
- `community_work_revisions_immutable`

The one-time nonce table/function and temporary `pg_net` extension were dropped.

Post-cleanup Supabase Security Advisor: **WARN 0**. Remaining findings are INFO for intentionally server-only RLS tables without client policies.

No access token, refresh token, password, nonce, signed upload token, signed upload URL, signed read URL, service-role key or secret key is stored in this evidence document.

## Acceptance impact

- **VS-02 Gallery draft -> validated media -> immutable publish: CONFIRMED PASS** at the Community backend/network boundary.
- **VS-12 Media guards/delivery: CONFIRMED PASS** at the Community backend/network boundary.

The full Community Phase 2 product-shaped gate remains open until the internal Community Lab is executed through the intended browser UX for A -> B -> Moderator, and WEP-owned Preset validation/preflight/apply is integrated.
