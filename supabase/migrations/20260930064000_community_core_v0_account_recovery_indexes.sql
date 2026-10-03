
create index if not exists account_recovery_cases_opened_by_idx
  on public.account_recovery_cases(opened_by_account_id);

create index if not exists account_recovery_cases_completed_by_idx
  on public.account_recovery_cases(completed_by_account_id);

create index if not exists auth_identities_replaced_by_idx
  on public.auth_identities(replaced_by_auth_identity_id)
  where replaced_by_auth_identity_id is not null;
