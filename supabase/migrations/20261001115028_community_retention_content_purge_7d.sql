insert into private.community_retention_policy(policy_key,integer_value,updated_at)
values ('deleted_account_content_days',7,now())
on conflict (policy_key) do update
set integer_value=excluded.integer_value,
    updated_at=now();

update public.account_deletion_events e
set content_purge_after=e.requested_at + interval '7 days'
where e.content_purged_at is null;

update private.account_retention_jobs j
set
  due_at=e.requested_at + interval '7 days',
  next_attempt_at=case
    when j.state='pending' then e.requested_at + interval '7 days'
    else j.next_attempt_at
  end
from public.account_deletion_events e
where j.deletion_event_id=e.deletion_event_id
  and j.stage='content_payload'
  and j.state<>'completed';
