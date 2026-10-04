alter table private.community_operations_escalation_config
  drop constraint if exists community_operations_escalation_config_channel_check;

update private.community_operations_escalation_config
set channel='operator_email',updated_at=now()
where channel='generic_webhook';

alter table private.community_operations_escalation_config
  alter column channel set default 'operator_email';

alter table private.community_operations_escalation_config
  add constraint community_operations_escalation_config_channel_check
  check(channel in('operator_email'));

alter table private.community_operations_escalation_deliveries
  drop constraint if exists community_operations_escalation_deliveries_channel_check;

update private.community_operations_escalation_deliveries
set channel='operator_email',updated_at=now()
where channel='generic_webhook';

alter table private.community_operations_escalation_deliveries
  alter column channel set default 'operator_email';

alter table private.community_operations_escalation_deliveries
  add constraint community_operations_escalation_deliveries_channel_check
  check(channel in('operator_email'));

update private.community_operations_escalation_config
set endpoint_secret_name='community_operations_email_relay_url',
    auth_token_secret_name='community_operations_email_relay_token',
    updated_at=now()
where config_id=true
  and endpoint_secret_name='community_operations_escalation_endpoint';

create or replace function private.community_set_operations_escalation_destination(
  p_endpoint_secret_name text,
  p_auth_token_secret_name text default null,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,vault
as $$
declare
  v_url text;
begin
  if p_enabled then
    select decrypted_secret
      into v_url
    from vault.decrypted_secrets
    where name=btrim(p_endpoint_secret_name)
    limit 1;

    if v_url is null or v_url !~ '^https://[^[:space:]]+$' then
      raise exception 'Operator email relay Vault secret must contain a valid HTTPS URL';
    end if;

    if p_auth_token_secret_name is not null and not exists(
      select 1
      from vault.decrypted_secrets
      where name=btrim(p_auth_token_secret_name)
        and coalesce(length(decrypted_secret),0)>0
    ) then
      raise exception 'Operator email relay auth-token Vault secret is missing';
    end if;
  end if;

  update private.community_operations_escalation_config
  set enabled=p_enabled,
      channel='operator_email',
      endpoint_secret_name=coalesce(
        nullif(btrim(p_endpoint_secret_name),''),
        endpoint_secret_name
      ),
      auth_token_secret_name=case
        when p_auth_token_secret_name is null then null
        else nullif(btrim(p_auth_token_secret_name),'')
      end,
      updated_at=now()
  where config_id=true;

  return jsonb_build_object(
    'enabled',p_enabled,
    'channel','operator_email',
    'configured',true
  );
end;
$$;
