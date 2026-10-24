-- 03 COMM clean-bootstrap parity: historic provider identity cleanup table.
-- SOURCE GAP: source migration 20260930115623 already expects this relation.
-- Definition reconstructed ONLY from the staging schema catalog (2026-10-24).
-- No worker, RPC, cleanup transition, data rows, entitlement, or retention action.
-- Do not infer that the two historical staging-only RPCs are validated here.
create schema if not exists private;

create table if not exists private.provider_identity_cleanup_jobs (
  cleanup_job_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wand_accounts(account_id),
  provider text not null,
  provider_subject text not null,
  state text not null default 'pending'
    check (state in ('pending','completed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Historical staging indexes, except account index which is already created by
-- the canonical next migration 20260930115623.
create unique index if not exists provider_identity_cleanup_pending_unique
 on private.provider_identity_cleanup_jobs (provider,provider_subject)
 where state='pending';

create index if not exists provider_identity_cleanup_pending_idx
 on private.provider_identity_cleanup_jobs (requested_at)
 where state='pending';

-- Internal-only table. Never expose direct Data API access.
revoke all on private.provider_identity_cleanup_jobs
 from public,anon,authenticated,service_role;
