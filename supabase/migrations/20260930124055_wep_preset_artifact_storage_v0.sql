-- Preset Artifact Storage bucket provisioning is environment-specific.
-- Do not create a staging-named bucket from the production migration chain.
-- Known staging bootstrap lives under supabase/staging; production Release Operations
-- must provision the private bucket selected by WEP_PRESET_ARTIFACT_BUCKET before
-- deploying the WEP Preset Edge Functions.

insert into private.community_action_rate_policies(
  bucket,window_seconds,max_actions,enabled,updated_at
) values (
  'preset_artifact_prepare',3600,30,true,now()
)
on conflict(bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at;
