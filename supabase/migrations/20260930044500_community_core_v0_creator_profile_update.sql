
alter table public.creator_profiles
  add column if not exists row_version bigint not null default 1;

create or replace function public.increment_creator_profile_row_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists creator_profiles_row_version on public.creator_profiles;
create trigger creator_profiles_row_version
before update on public.creator_profiles
for each row execute function public.increment_creator_profile_row_version();

create or replace function public.community_update_creator_profile(
  p_auth_subject uuid,
  p_expected_version bigint,
  p_handle text,
  p_display_name text,
  p_bio text,
  p_profile_visibility text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, private
as $$
declare
  v_account_id uuid;
  v_profile public.creator_profiles%rowtype;
  v_request_hash text;
  v_existing_hash text;
  v_response jsonb;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(
    hashtextextended(v_account_id::text || ':' || p_idempotency_key, 0)
  );

  if coalesce(length(btrim(p_handle)),0) < 3
     or length(btrim(p_handle)) > 40
     or btrim(p_handle) !~ '^[A-Za-z0-9][A-Za-z0-9._-]*$' then
    raise exception 'Creator handle must be 3-40 characters using letters, digits, dot, underscore or hyphen';
  end if;

  if coalesce(length(btrim(p_display_name)),0) < 1
     or length(btrim(p_display_name)) > 80 then
    raise exception 'Creator display name must be 1-80 characters';
  end if;

  if p_bio is not null and length(p_bio) > 1000 then
    raise exception 'Creator bio must be at most 1000 characters';
  end if;

  v_request_hash := encode(
    digest(
      concat_ws(
        '|',
        'update_creator_profile',
        p_expected_version::text,
        lower(btrim(p_handle)),
        btrim(p_display_name),
        coalesce(p_bio,''),
        p_profile_visibility
      ),
      'sha256'
    ),
    'hex'
  );

  select request_hash,response
    into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id
    and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  select *
    into v_profile
  from public.creator_profiles
  where owner_account_id=v_account_id
  for update;

  if v_profile.creator_profile_id is null then
    raise exception 'CreatorProfile not found';
  end if;

  if v_profile.row_version <> p_expected_version then
    raise exception 'Row version conflict';
  end if;

  if v_profile.moderation_state <> 'clear' then
    raise exception 'CreatorProfile is moderation-blocked';
  end if;

  insert into public.idempotency_keys(
    account_id,idempotency_key,command_name,request_hash
  ) values (
    v_account_id,p_idempotency_key,'update_creator_profile',v_request_hash
  );

  update public.creator_profiles
  set handle=btrim(p_handle),
      display_name=btrim(p_display_name),
      bio=nullif(btrim(coalesce(p_bio,'')),''),
      profile_visibility=p_profile_visibility::visibility_state
  where creator_profile_id=v_profile.creator_profile_id
  returning * into v_profile;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,
    'creator.profile_updated',
    v_profile.creator_profile_id,
    jsonb_build_object(
      'rowVersion',v_profile.row_version,
      'profileVisibility',v_profile.profile_visibility
    )
  );

  v_response := jsonb_build_object(
    'accountId',v_account_id,
    'creatorProfileId',v_profile.creator_profile_id,
    'handle',v_profile.handle,
    'displayName',v_profile.display_name,
    'bio',v_profile.bio,
    'profileVisibility',v_profile.profile_visibility,
    'rowVersion',v_profile.row_version
  );

  update public.idempotency_keys
  set response=v_response,
      completed_at=now()
  where account_id=v_account_id
    and idempotency_key=p_idempotency_key;

  return v_response;
end;
$$;

create or replace function public.community_get_me(p_auth_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_profile public.creator_profiles%rowtype;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  select *
    into v_profile
  from public.creator_profiles
  where owner_account_id=v_account_id;

  return jsonb_build_object(
    'accountId',v_account_id,
    'creatorProfileId',v_profile.creator_profile_id,
    'handle',v_profile.handle,
    'displayName',v_profile.display_name,
    'bio',v_profile.bio,
    'profileVisibility',v_profile.profile_visibility,
    'rowVersion',v_profile.row_version
  );
end;
$$;

revoke execute on function public.increment_creator_profile_row_version()
from public, anon, authenticated;

revoke execute on function public.community_update_creator_profile(
  uuid,bigint,text,text,text,text,text
) from public, anon, authenticated;

grant execute on function public.community_update_creator_profile(
  uuid,bigint,text,text,text,text,text
) to service_role;
