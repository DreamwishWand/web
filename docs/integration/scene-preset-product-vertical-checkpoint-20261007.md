# Scene Wand Preset product vertical — 2026-10-07

Status: IMPLEMENTATION / VERIFICATION IN PROGRESS

Target: Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / profile schema 624.

This branch implements one coherent Scene Wand Preset vertical:

World Editor Capture Region -> private local master -> explicit public Publish -> associated Gallery Work -> public Preset Detail -> Library save -> exact signed revision read -> World Editor handoff/preflight.

Safety remains fail-closed:
- published revisions are immutable;
- first public Publish requires a title and at least one public image;
- Scene artifact schema v1 only;
- exact signed bytes, SHA-256, byte size, revision identity and schema are revalidated before reuse;
- clipped Road/Fence topology is rejected;
- unsupported Scene object classes and unsupported Switch build/schema are rejected;
- persistentWriteAuthorized=false;
- productApplyAuthorized=false;
- directSourceReplacementAuthorized=false;
- whole-Scene automatic persistent Apply is not authorized.

The existing WEP artifact bucket and Community PresetArtifact/PresetRevision/ArtifactBlob domains are reused. No duplicate Item, Creator, Preset payload-store or entitlement model is introduced.
