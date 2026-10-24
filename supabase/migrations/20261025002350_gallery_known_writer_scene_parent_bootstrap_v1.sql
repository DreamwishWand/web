-- 03 COMM / 09 INT: create the Scene Preset association parent before
-- 20261025002400 Gallery known-reference Writer Fence trigger creation.
-- Historically added to Staging by an out-of-tree Scene Preset migration;
-- confirmed current staging contract: nullable UUID, no default, FK to
-- public.gallery_works(work_id), name specified below.
-- Only DDL parity: no positive Gallery retirement/Cloud/public writer enable.
alter table public.preset_artifacts
 add column if not exists associated_gallery_work_id uuid;

do $bootstrap_fk$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.preset_artifacts'::regclass
      and conname='preset_artifacts_associated_gallery_work_id_fkey'
  ) then
    alter table public.preset_artifacts
      add constraint preset_artifacts_associated_gallery_work_id_fkey
      foreign key (associated_gallery_work_id)
      references public.gallery_works(work_id);
  end if;
end
$bootstrap_fk$;

-- Restore the ACTIVE Staging immutability invariant lost with the historical
-- Scene product migration. Adding the column/FK alone is NOT sufficient:
-- after the first PresetRevision, its Gallery association is identity data.
-- Keep this trigger ordinary SECURITY INVOKER (same as Staging), NOT an
-- authorization route for Gallery retirement / Cloud / native save writes.
create or replace function public.guard_preset_artifact_identity()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $preset_identity$
begin
  if exists (
    select 1 from public.preset_revisions pr
    where pr.preset_artifact_id=old.preset_artifact_id
  ) and (
    new.owner_account_id is distinct from old.owner_account_id
    or new.creator_profile_id is distinct from old.creator_profile_id
    or new.community_work_id is distinct from old.community_work_id
    or new.associated_gallery_work_id is distinct from old.associated_gallery_work_id
    or new.preset_type is distinct from old.preset_type
  ) then
    raise exception 'PresetArtifact identity is immutable after first revision';
  end if;
  return new;
end
$preset_identity$;

-- The original preset_artifacts_identity_guard trigger remains installed.
-- Preserve the existing trigger-function privileges: not a client RPC.
revoke execute on function public.guard_preset_artifact_identity()
  from public,anon,authenticated;
