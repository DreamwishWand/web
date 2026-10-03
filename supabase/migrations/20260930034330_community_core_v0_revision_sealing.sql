
alter table public.community_work_revisions
  add column if not exists sealed_at timestamptz null;

create or replace function public.guard_community_work_revision_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Published/revision records are immutable; create a new revision instead';
  end if;

  if old.sealed_at is null
     and new.sealed_at is not null
     and (to_jsonb(new) - 'sealed_at') = (to_jsonb(old) - 'sealed_at') then
    return new;
  end if;

  raise exception 'Published/revision records are immutable; create a new revision instead';
end;
$$;

drop trigger if exists community_work_revisions_immutable on public.community_work_revisions;
create trigger community_work_revisions_immutable
before update or delete on public.community_work_revisions
for each row execute function public.guard_community_work_revision_mutation();

create or replace function public.seal_current_work_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.current_published_revision_id is not null
     and (
       tg_op = 'INSERT'
       or old.current_published_revision_id is distinct from new.current_published_revision_id
     ) then
    update public.community_work_revisions r
    set sealed_at=coalesce(r.sealed_at,now())
    where r.revision_id=new.current_published_revision_id
      and r.work_id=new.work_id;

    if not found then
      raise exception 'current_published_revision_id must belong to the same work';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists community_works_seal_revision on public.community_works;
create trigger community_works_seal_revision
before insert or update of current_published_revision_id on public.community_works
for each row execute function public.seal_current_work_revision();

create or replace function public.guard_revision_composition_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_revision_id uuid;
  v_sealed_at timestamptz;
begin
  if tg_table_name = 'gallery_work_revisions' then
    v_revision_id := new.revision_id;
  elsif tg_table_name = 'work_revision_media' then
    v_revision_id := new.work_revision_id;
  elsif tg_table_name = 'gallery_revision_presets' then
    v_revision_id := new.gallery_revision_id;
  elsif tg_table_name = 'preset_revision_publications' then
    v_revision_id := new.work_revision_id;
  else
    raise exception 'Unsupported revision composition table';
  end if;

  select sealed_at into v_sealed_at
  from public.community_work_revisions
  where revision_id=v_revision_id;

  if not found then raise exception 'CommunityWorkRevision not found'; end if;
  if v_sealed_at is not null then
    raise exception 'Published revision composition is sealed';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_revision_composition_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Published revision composition is immutable';
end;
$$;

drop trigger if exists gallery_work_revisions_open_insert on public.gallery_work_revisions;
create trigger gallery_work_revisions_open_insert
before insert on public.gallery_work_revisions
for each row execute function public.guard_revision_composition_insert();

drop trigger if exists work_revision_media_open_insert on public.work_revision_media;
create trigger work_revision_media_open_insert
before insert on public.work_revision_media
for each row execute function public.guard_revision_composition_insert();

drop trigger if exists work_revision_media_immutable on public.work_revision_media;
create trigger work_revision_media_immutable
before update or delete on public.work_revision_media
for each row execute function public.prevent_revision_composition_mutation();

drop trigger if exists gallery_revision_presets_open_insert on public.gallery_revision_presets;
create trigger gallery_revision_presets_open_insert
before insert on public.gallery_revision_presets
for each row execute function public.guard_revision_composition_insert();

drop trigger if exists gallery_revision_presets_immutable on public.gallery_revision_presets;
create trigger gallery_revision_presets_immutable
before update or delete on public.gallery_revision_presets
for each row execute function public.prevent_revision_composition_mutation();

drop trigger if exists preset_revision_publications_open_insert on public.preset_revision_publications;
create trigger preset_revision_publications_open_insert
before insert on public.preset_revision_publications
for each row execute function public.guard_revision_composition_insert();

drop trigger if exists preset_revision_publications_immutable on public.preset_revision_publications;
create trigger preset_revision_publications_immutable
before update or delete on public.preset_revision_publications
for each row execute function public.prevent_revision_composition_mutation();

create or replace function public.validate_current_published_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.current_published_revision_id is not null and not exists (
    select 1
    from public.community_work_revisions r
    where r.revision_id=new.current_published_revision_id
      and r.work_id=new.work_id
      and r.sealed_at is not null
  ) then
    raise exception 'current_published_revision_id must be a sealed revision belonging to the same work';
  end if;

  if new.lifecycle_state='published' and new.current_published_revision_id is null then
    raise exception 'Published work requires current_published_revision_id';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_community_work_revision_mutation()
from public, anon, authenticated;
revoke execute on function public.seal_current_work_revision()
from public, anon, authenticated;
revoke execute on function public.guard_revision_composition_insert()
from public, anon, authenticated;
revoke execute on function public.prevent_revision_composition_mutation()
from public, anon, authenticated;
