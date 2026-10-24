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
