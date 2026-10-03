alter table private.community_operations_alerts
  add column if not exists occurrence integer not null default 1,
  add column if not exists occurrence_started_at timestamptz not null default now();

create or replace function private.community_operations_alert_occurrence_guard()
returns trigger language plpgsql set search_path=pg_catalog,private as $$
begin
  if old.state='resolved' and new.state='open' then
    new.occurrence:=old.occurrence+1;
    new.occurrence_started_at:=now();
  end if;
  return new;
end $$;

drop trigger if exists community_operations_alert_occurrence_guard on private.community_operations_alerts;
create trigger community_operations_alert_occurrence_guard
before update on private.community_operations_alerts
for each row execute function private.community_operations_alert_occurrence_guard();

create table if not exists private.community_operations_escalation_config(
  config_id boolean primary key default true check(config_id),
  enabled boolean not null default false,
  channel text not null default 'generic_webhook' check(channel in('generic_webhook')),
  endpoint_secret_name text not null default 'community_operations_escalation_endpoint',
  auth_token_secret_name text null default 'community_operations_escalation_auth_token',
  updated_at timestamptz not null default now()
);
insert into private.community_operations_escalation_config(config_id,enabled)
values(true,false) on conflict(config_id) do nothing;
revoke all on private.community_operations_escalation_config from public,anon,authenticated;

create table if not exists private.community_operations_escalation_deliveries(
  delivery_id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references private.community_operations_alerts(alert_id),
  alert_occurrence integer not null check(alert_occurrence>0),
  channel text not null default 'generic_webhook' check(channel in('generic_webhook')),
  state text not null default 'pending'
    check(state in('pending','processing','delivered','cancelled','dead_letter')),
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz null,
  lock_token uuid null,
  delivered_at timestamptz null,
  last_http_status integer null,
  last_error text null,
  dead_lettered_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(alert_id,alert_occurrence,channel)
);
create index if not exists community_operations_escalation_pending_idx
on private.community_operations_escalation_deliveries(state,next_attempt_at,created_at);
revoke all on private.community_operations_escalation_deliveries from public,anon,authenticated;

create or replace function private.community_enqueue_operations_escalations()
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_inserted integer:=0; v_cancelled integer:=0; v_enabled boolean; v_channel text;
begin
  select enabled,channel into v_enabled,v_channel
  from private.community_operations_escalation_config where config_id=true;
  if coalesce(v_enabled,false) is not true then
    return jsonb_build_object('enabled',false,'inserted',0,'cancelled',0);
  end if;

  insert into private.community_operations_escalation_deliveries(
    alert_id,alert_occurrence,channel,state,next_attempt_at
  )
  select alert_id,occurrence,v_channel,'pending',now()
  from private.community_operations_alerts
  where severity='critical' and state='open'
  on conflict(alert_id,alert_occurrence,channel) do nothing;
  get diagnostics v_inserted=row_count;

  update private.community_operations_escalation_deliveries d
  set state='cancelled',locked_at=null,lock_token=null,updated_at=now()
  where d.state='pending'
    and exists(
      select 1 from private.community_operations_alerts a
      where a.alert_id=d.alert_id
        and (a.state<>'open' or a.occurrence<>d.alert_occurrence)
    );
  get diagnostics v_cancelled=row_count;
  return jsonb_build_object('enabled',true,'inserted',v_inserted,'cancelled',v_cancelled);
end $$;

create or replace function public.community_claim_operations_escalations(
  p_limit integer,p_lock_token uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_limit integer; v_jobs jsonb;
begin
  if p_lock_token is null then raise exception 'Operations escalation lock token is required'; end if;
  perform private.community_enqueue_operations_escalations();
  v_limit:=least(greatest(coalesce(p_limit,10),1),50);

  with candidates as(
    select d.delivery_id
    from private.community_operations_escalation_deliveries d
    join private.community_operations_alerts a
      on a.alert_id=d.alert_id and a.occurrence=d.alert_occurrence
    where a.state='open' and a.severity='critical' and (
      (d.state='pending' and d.next_attempt_at<=now())
      or (d.state='processing' and d.locked_at<now()-interval '5 minutes')
    )
    order by d.created_at,d.delivery_id
    for update of d skip locked limit v_limit
  ), claimed as(
    update private.community_operations_escalation_deliveries d
    set state='processing',locked_at=now(),lock_token=p_lock_token,updated_at=now()
    where d.delivery_id in(select delivery_id from candidates)
    returning d.delivery_id,d.alert_id,d.alert_occurrence,d.channel,d.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'deliveryId',c.delivery_id,'alertId',c.alert_id,'alertType',a.alert_type,
    'severity',a.severity,'occurrence',c.alert_occurrence,
    'firstSeenAt',a.occurrence_started_at,'lastSeenAt',a.last_seen_at,
    'attempts',c.attempts
  ) order by c.delivery_id),'[]'::jsonb)
  into v_jobs
  from claimed c join private.community_operations_alerts a on a.alert_id=c.alert_id;

  return jsonb_build_object('lockToken',p_lock_token,'jobs',v_jobs);
end $$;

create or replace function public.community_complete_operations_escalation(
  p_delivery_id uuid,p_lock_token uuid,p_http_status integer
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v private.community_operations_escalation_deliveries%rowtype;
begin
  if p_http_status<200 or p_http_status>299 then raise exception 'Successful HTTP status is required'; end if;
  update private.community_operations_escalation_deliveries
  set state='delivered',attempts=attempts+1,delivered_at=now(),
      last_http_status=p_http_status,last_error=null,locked_at=null,lock_token=null,updated_at=now()
  where delivery_id=p_delivery_id and state='processing' and lock_token=p_lock_token
  returning * into v;
  if v.delivery_id is null then raise exception 'Claimed operations escalation delivery not found'; end if;
  return jsonb_build_object('deliveryId',v.delivery_id,'state',v.state,'attempts',v.attempts);
end $$;

create or replace function public.community_fail_operations_escalation(
  p_delivery_id uuid,p_lock_token uuid,p_error text,p_http_status integer default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v private.community_operations_escalation_deliveries%rowtype;
begin
  update private.community_operations_escalation_deliveries
  set attempts=attempts+1,last_error=left(coalesce(p_error,'operations escalation failed'),500),
      last_http_status=p_http_status,
      state=case when attempts+1>=5 then 'dead_letter' else 'pending' end,
      next_attempt_at=case when attempts+1>=5 then next_attempt_at else
        now()+make_interval(secs=>least(3600,(30*power(2,least(attempts,6)))::integer)) end,
      dead_lettered_at=case when attempts+1>=5 then now() else null end,
      locked_at=null,lock_token=null,updated_at=now()
  where delivery_id=p_delivery_id and state='processing' and lock_token=p_lock_token
  returning * into v;
  if v.delivery_id is null then raise exception 'Claimed operations escalation delivery not found'; end if;
  return jsonb_build_object('deliveryId',v.delivery_id,'state',v.state,'attempts',v.attempts);
end $$;

create or replace function public.community_get_operations_escalation_destination()
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,vault as $$
declare c private.community_operations_escalation_config%rowtype; v_url text; v_token text;
begin
  select * into c from private.community_operations_escalation_config where config_id=true;
  if c.config_id is null or c.enabled is not true then
    return jsonb_build_object('enabled',false,'channel',coalesce(c.channel,'generic_webhook'));
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets
    where name=c.endpoint_secret_name limit 1;
  if c.auth_token_secret_name is not null then
    select decrypted_secret into v_token from vault.decrypted_secrets
      where name=c.auth_token_secret_name limit 1;
  end if;
  if v_url is null or v_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Operations escalation HTTPS destination is not configured';
  end if;
  return jsonb_build_object('enabled',true,'channel',c.channel,'url',v_url,'authToken',v_token);
end $$;

create or replace function private.community_set_operations_escalation_destination(
  p_endpoint_secret_name text,p_auth_token_secret_name text default null,p_enabled boolean default true
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,vault as $$
declare v_url text;
begin
  if p_enabled then
    select decrypted_secret into v_url from vault.decrypted_secrets
      where name=btrim(p_endpoint_secret_name) limit 1;
    if v_url is null or v_url !~ '^https://[^[:space:]]+$' then
      raise exception 'Endpoint Vault secret must contain a valid HTTPS URL';
    end if;
    if p_auth_token_secret_name is not null and not exists(
      select 1 from vault.decrypted_secrets
      where name=btrim(p_auth_token_secret_name) and coalesce(length(decrypted_secret),0)>0
    ) then
      raise exception 'Auth-token Vault secret is missing';
    end if;
  end if;
  update private.community_operations_escalation_config
  set enabled=p_enabled,
      endpoint_secret_name=coalesce(nullif(btrim(p_endpoint_secret_name),''),endpoint_secret_name),
      auth_token_secret_name=case when p_auth_token_secret_name is null then null
        else nullif(btrim(p_auth_token_secret_name),'') end,
      updated_at=now()
  where config_id=true;
  return jsonb_build_object('enabled',p_enabled,'channel','generic_webhook','configured',true);
end $$;

create or replace function private.community_invoke_operations_escalation_worker()
returns bigint language plpgsql security definer
set search_path=pg_catalog,public,private,vault,net as $$
declare v_url text; v_token text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets
    where name='community_operations_escalation_worker_url' limit 1;
  select decrypted_secret into v_token from vault.decrypted_secrets
    where name='community_operations_escalation_worker_token' limit 1;
  if v_url is null or v_token is null then
    raise exception 'Operations escalation worker Vault configuration is incomplete';
  end if;
  select net.http_post(
    url:=v_url,
    headers:=jsonb_build_object('Content-Type','application/json','x-community-worker-token',v_token),
    body:=jsonb_build_object('limit',20),
    timeout_milliseconds:=15000
  ) into v_request_id;
  return v_request_id;
end $$;

create or replace function private.community_configure_operations_escalation_scheduler(
  p_worker_url text,p_schedule text default '* * * * *'
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,vault,extensions,cron as $$
declare v_token text; v_id uuid; v_job bigint; v_old bigint;
begin
  if p_worker_url is null or
     p_worker_url !~ '^https://[A-Za-z0-9.-]+/functions/v1/community-ops-escalation$' then
    raise exception 'Valid HTTPS community-ops-escalation worker URL is required';
  end if;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');

  select id into v_id from vault.secrets where name='community_operations_escalation_worker_token' limit 1;
  if v_id is null then
    perform vault.create_secret(v_token,'community_operations_escalation_worker_token',
      'Dreamwish Wand operations escalation worker token');
  else
    perform vault.update_secret(v_id,v_token,'community_operations_escalation_worker_token',
      'Dreamwish Wand operations escalation worker token');
  end if;

  v_id:=null;
  select id into v_id from vault.secrets where name='community_operations_escalation_worker_url' limit 1;
  if v_id is null then
    perform vault.create_secret(p_worker_url,'community_operations_escalation_worker_url',
      'Dreamwish Wand operations escalation Edge URL');
  else
    perform vault.update_secret(v_id,p_worker_url,'community_operations_escalation_worker_url',
      'Dreamwish Wand operations escalation Edge URL');
  end if;

  insert into private.community_worker_auth(worker_name,token_hash,rotated_at,last_verified_at)
  values('operations_escalation',extensions.digest(v_token,'sha256'),now(),null)
  on conflict(worker_name) do update
  set token_hash=excluded.token_hash,rotated_at=excluded.rotated_at,last_verified_at=null;

  for v_old in select jobid from cron.job
    where jobname='community-operations-escalation-every-minute'
  loop perform cron.unschedule(v_old); end loop;

  select cron.schedule(
    'community-operations-escalation-every-minute',p_schedule,
    'select private.community_invoke_operations_escalation_worker();'
  ) into v_job;
  return jsonb_build_object('worker','operations_escalation','jobId',v_job,'schedule',p_schedule);
end $$;

revoke execute on function public.community_claim_operations_escalations(integer,uuid)
  from public,anon,authenticated;
revoke execute on function public.community_complete_operations_escalation(uuid,uuid,integer)
  from public,anon,authenticated;
revoke execute on function public.community_fail_operations_escalation(uuid,uuid,text,integer)
  from public,anon,authenticated;
revoke execute on function public.community_get_operations_escalation_destination()
  from public,anon,authenticated;
grant execute on function public.community_claim_operations_escalations(integer,uuid) to service_role;
grant execute on function public.community_complete_operations_escalation(uuid,uuid,integer) to service_role;
grant execute on function public.community_fail_operations_escalation(uuid,uuid,text,integer) to service_role;
grant execute on function public.community_get_operations_escalation_destination() to service_role;
revoke execute on function private.community_enqueue_operations_escalations() from public,anon,authenticated,service_role;
revoke execute on function private.community_set_operations_escalation_destination(text,text,boolean)
  from public,anon,authenticated,service_role;
revoke execute on function private.community_invoke_operations_escalation_worker()
  from public,anon,authenticated,service_role;
revoke execute on function private.community_configure_operations_escalation_scheduler(text,text)
  from public,anon,authenticated,service_role;
