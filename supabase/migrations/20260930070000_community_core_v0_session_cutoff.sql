
alter table public.auth_identities
  add column if not exists sessions_valid_after timestamptz
    not null default '1970-01-01 00:00:00+00'::timestamptz;

create index if not exists auth_identities_active_session_cutoff_idx
  on public.auth_identities(provider,provider_subject,sessions_valid_after)
  where identity_state='active';

create or replace function public.community_authorize_session(
  p_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_max_age_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_identity_id uuid;
  v_cutoff timestamptz;
  v_issued_at timestamptz;
  v_age_seconds bigint;
begin
  if p_issued_at_epoch is null or p_issued_at_epoch <= 0 then
    raise exception 'JWT issued-at claim is required';
  end if;

  if p_max_age_seconds is not null and p_max_age_seconds <= 0 then
    raise exception 'Recent-auth max age must be positive';
  end if;

  v_account_id := private.resolve_active_account(p_auth_subject);
  v_issued_at := to_timestamp(p_issued_at_epoch);

  select auth_identity_id,sessions_valid_after
    into v_identity_id,v_cutoff
  from public.auth_identities
  where provider='supabase'
    and provider_subject=p_auth_subject::text
    and account_id=v_account_id
    and identity_state='active'
  limit 1;

  if v_identity_id is null then
    raise exception 'Active AuthIdentity not found';
  end if;

  if v_issued_at < v_cutoff then
    raise exception 'Wand session has been revoked';
  end if;

  v_age_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_issued_at)))::bigint
  );

  if p_max_age_seconds is not null and v_age_seconds > p_max_age_seconds then
    raise exception 'Recent authentication required';
  end if;

  return jsonb_build_object(
    'accountId',v_account_id,
    'authIdentityId',v_identity_id,
    'issuedAt',v_issued_at,
    'sessionAgeSeconds',v_age_seconds,
    'sessionsValidAfter',v_cutoff,
    'recentAuthSatisfied',
      case
        when p_max_age_seconds is null then null
        else v_age_seconds <= p_max_age_seconds
      end
  );
end;
$$;

create or replace function public.community_revoke_wand_sessions(
  p_auth_subject uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_account_id uuid;
  v_identity_id uuid;
  v_cutoff timestamptz;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  -- JWT iat has one-second precision. Move the cutoff to the next whole
  -- second so every token minted at or before the revocation second is rejected.
  v_cutoff := date_trunc('second',clock_timestamp()) + interval '1 second';

  update public.auth_identities
  set sessions_valid_after=v_cutoff
  where provider='supabase'
    and provider_subject=p_auth_subject::text
    and account_id=v_account_id
    and identity_state='active'
  returning auth_identity_id into v_identity_id;

  if v_identity_id is null then
    raise exception 'Active AuthIdentity not found';
  end if;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,
    'auth.sessions_revoked',
    null,
    jsonb_build_object(
      'authIdentityId',v_identity_id,
      'sessionsValidAfter',v_cutoff
    )
  );

  return jsonb_build_object(
    'accountId',v_account_id,
    'authIdentityId',v_identity_id,
    'sessionsValidAfter',v_cutoff
  );
end;
$$;

revoke execute on function public.community_authorize_session(uuid,bigint,integer)
from public, anon, authenticated;
revoke execute on function public.community_revoke_wand_sessions(uuid)
from public, anon, authenticated;

grant execute on function public.community_authorize_session(uuid,bigint,integer)
to service_role;
grant execute on function public.community_revoke_wand_sessions(uuid)
to service_role;
