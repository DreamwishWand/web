create table if not exists private.community_action_rate_policies (
  bucket text primary key,
  window_seconds integer not null
    check (window_seconds between 1 and 86400),
  max_actions integer not null
    check (max_actions between 1 and 100000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists private.community_action_rate_windows (
  account_id uuid not null
    references public.wand_accounts(account_id) on delete cascade,
  bucket text not null
    references private.community_action_rate_policies(bucket) on delete restrict,
  window_start timestamptz not null,
  action_count integer not null
    check (action_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (account_id,bucket,window_start)
);

insert into private.community_action_rate_policies(
  bucket,window_seconds,max_actions,enabled,updated_at
) values
  ('profile_write',3600,20,true,now()),
  ('gallery_write',3600,60,true,now()),
  ('save',3600,240,true,now()),
  ('follow',3600,120,true,now()),
  ('reaction',3600,300,true,now()),
  ('comment',3600,90,true,now()),
  ('report',3600,12,true,now()),
  ('moderation_write',3600,120,true,now()),
  ('media_prepare',3600,30,true,now())
on conflict(bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at;

create or replace function public.community_consume_action_rate_limit(
  p_auth_subject uuid,
  p_bucket text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_policy private.community_action_rate_policies%rowtype;
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
  v_remaining integer;
  v_retry_after integer;
begin
  if coalesce(length(btrim(p_bucket)),0)=0 then
    raise exception 'Rate-limit bucket is required';
  end if;

  v_account_id:=private.resolve_active_account(p_auth_subject);

  select * into v_policy
  from private.community_action_rate_policies
  where bucket=btrim(p_bucket);

  if v_policy.bucket is null then
    raise exception 'Unknown Community rate-limit bucket';
  end if;

  if not v_policy.enabled then
    return jsonb_build_object(
      'allowed',true,
      'bucket',v_policy.bucket,
      'enabled',false,
      'limit',v_policy.max_actions,
      'windowSeconds',v_policy.window_seconds,
      'remaining',v_policy.max_actions,
      'retryAfterSeconds',0,
      'resetAt',null
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'community-rate:' || v_account_id::text || ':' || v_policy.bucket,
      0
    )
  );

  v_window_start:=to_timestamp(
    floor(extract(epoch from clock_timestamp()) / v_policy.window_seconds)
      * v_policy.window_seconds
  );
  v_reset_at:=v_window_start + make_interval(secs=>v_policy.window_seconds);

  select action_count into v_count
  from private.community_action_rate_windows
  where account_id=v_account_id
    and bucket=v_policy.bucket
    and window_start=v_window_start;

  v_count:=coalesce(v_count,0);

  if v_count >= v_policy.max_actions then
    v_retry_after:=greatest(
      1,
      ceil(extract(epoch from (v_reset_at-clock_timestamp())))::integer
    );

    return jsonb_build_object(
      'allowed',false,
      'bucket',v_policy.bucket,
      'enabled',true,
      'limit',v_policy.max_actions,
      'windowSeconds',v_policy.window_seconds,
      'remaining',0,
      'retryAfterSeconds',v_retry_after,
      'resetAt',v_reset_at
    );
  end if;

  insert into private.community_action_rate_windows(
    account_id,bucket,window_start,action_count,updated_at
  ) values (
    v_account_id,v_policy.bucket,v_window_start,1,now()
  )
  on conflict(account_id,bucket,window_start) do update
  set action_count=private.community_action_rate_windows.action_count+1,
      updated_at=now()
  returning action_count into v_count;

  delete from private.community_action_rate_windows
  where account_id=v_account_id
    and bucket=v_policy.bucket
    and window_start < v_window_start - interval '2 days';

  v_remaining:=greatest(0,v_policy.max_actions-v_count);

  return jsonb_build_object(
    'allowed',true,
    'bucket',v_policy.bucket,
    'enabled',true,
    'limit',v_policy.max_actions,
    'windowSeconds',v_policy.window_seconds,
    'remaining',v_remaining,
    'retryAfterSeconds',0,
    'resetAt',v_reset_at
  );
end;
$$;

create or replace function public.community_get_action_rate_policies(
  p_admin_auth_subject uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_result jsonb;
begin
  v_admin_account_id:=private.resolve_active_account(p_admin_auth_subject);

  if not exists(
    select 1 from public.account_roles
    where account_id=v_admin_account_id
      and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket',p.bucket,
        'windowSeconds',p.window_seconds,
        'maxActions',p.max_actions,
        'enabled',p.enabled,
        'updatedAt',p.updated_at
      )
      order by p.bucket
    ),
    '[]'::jsonb
  )
  into v_result
  from private.community_action_rate_policies p;

  return v_result;
end;
$$;

revoke execute on function public.community_consume_action_rate_limit(uuid,text)
from public,anon,authenticated;

revoke execute on function public.community_get_action_rate_policies(uuid)
from public,anon,authenticated;

grant execute on function public.community_consume_action_rate_limit(uuid,text)
to service_role;

grant execute on function public.community_get_action_rate_policies(uuid)
to service_role;
