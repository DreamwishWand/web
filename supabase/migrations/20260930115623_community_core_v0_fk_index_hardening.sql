create index if not exists account_retention_holds_created_by_idx
  on private.account_retention_holds(created_by_account_id);

create index if not exists account_retention_holds_released_by_idx
  on private.account_retention_holds(released_by_account_id)
  where released_by_account_id is not null;

create index if not exists account_retention_jobs_deletion_event_idx
  on private.account_retention_jobs(deletion_event_id);

create index if not exists community_operations_alerts_ack_by_idx
  on private.community_operations_alerts(acknowledged_by_account_id)
  where acknowledged_by_account_id is not null;

create index if not exists provider_cleanup_jobs_account_idx
  on private.provider_cleanup_jobs(account_id);

create index if not exists provider_identity_cleanup_jobs_account_idx
  on private.provider_identity_cleanup_jobs(account_id);

create index if not exists account_recovery_cases_verified_by_idx
  on public.account_recovery_cases(verified_by_account_id)
  where verified_by_account_id is not null;
