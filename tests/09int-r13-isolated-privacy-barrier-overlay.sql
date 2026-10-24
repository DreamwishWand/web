-- 09 INT R13 EXPERIMENTAL ISOLATED OVERLAY, never in supabase/migrations.
-- Applies ONLY after 113 Source migrations on disposable local PG.
-- Production/Edge grants, native writers, physical Storage operations NOT allowed.
create table private.r13_account_privacy_barriers (
 account_id uuid primary key references public.wand_accounts(account_id),
 auth_subject uuid not null,
 session_id uuid not null,
 request_key text not null,
 suppressed_at timestamptz not null default clock_timestamp(),
 barrier_version bigint not null default 1,
 cleanup_state text not null default 'deferred_unaccepted'
   check(cleanup_state='deferred_unaccepted')
);
alter table private.r13_account_privacy_barriers enable row level security;
revoke all on private.r13_account_privacy_barriers from public,anon,authenticated,service_role;

-- Existing public GET/Media/QA routes using this common helper must suppress
-- owners whose deletion barrier is committed, WITHOUT mutating published Works.
-- Cloud/private/issued-URL safeguards remain untouched.
create or replace function private.is_discoverable_work(p_work_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,auth,public,private as $$
 select exists (
  select 1 from public.community_works w
  join public.community_entities e on e.entity_id=w.work_id
  join public.wand_accounts a on a.account_id=w.owner_account_id
  where w.work_id=p_work_id and e.deleted_at is null
    and w.lifecycle_state='published' and w.visibility='public'
    and w.moderation_state='clear' and w.current_published_revision_id is not null
    and a.status='active' and a.deleted_at is null
    and not exists(select 1 from private.r13_account_privacy_barriers b where b.account_id=w.owner_account_id)
 ) $$;
revoke all on function private.is_discoverable_work(uuid) from public,anon,authenticated,service_role;

-- Owner-authenticated Source writers must stop after barrier commit;
-- no change to auth identities until verified recent-auth safety request.
create or replace function private.resolve_active_account(p_auth_subject uuid)
returns uuid language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_id uuid;v_status public.account_status;
begin
 select a.account_id,a.status into v_id,v_status
 from public.auth_identities i join public.wand_accounts a on a.account_id=i.account_id
 where i.provider='supabase' and i.provider_subject=p_auth_subject::text
   and i.identity_state='active' limit 1;
 if v_id is null then raise exception 'WandAccount mapping not found for active Supabase subject';end if;
 if v_status<>'active' then raise exception 'WandAccount is not active';end if;
 if exists(select 1 from private.r13_account_privacy_barriers b where b.account_id=v_id)
 then raise exception 'R13_ACCOUNT_PRIVACY_BARRIER_ACTIVE';end if;
 return v_id;
end $$;
revoke all on function private.resolve_active_account(uuid) from public,anon,authenticated,service_role;

-- Account row FOR SHARE provides a physical serialization fence even for
-- a publish already admitted BEFORE the suppression request: privacy writer
-- holds same account row FOR UPDATE through suppression commit. Existing
-- Moderation RESTRICT/REMOVE remains available after suppression.
create or replace function private.r13_guard_suppressed_owner_work_write()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_suppressed boolean;
begin
 perform 1 from public.wand_accounts where account_id=new.owner_account_id for share;
 select exists(select 1 from private.r13_account_privacy_barriers
               where account_id=new.owner_account_id) into v_suppressed;
 if not v_suppressed then return new;end if;
 if tg_op='INSERT' then raise exception 'R13_OWNER_PUBLICATION_BARRIER';end if;
 if new.lifecycle_state='published' and new.visibility in ('public','unlisted')
    and ((new.current_published_revision_id is distinct from old.current_published_revision_id)
      or (new.lifecycle_state is distinct from old.lifecycle_state)
      or (new.visibility is distinct from old.visibility)
      or (new.moderation_state='clear' and old.moderation_state is distinct from 'clear'))
 then raise exception 'R13_OWNER_PUBLICATION_BARRIER';end if;
 return new;
end $$;
drop trigger if exists r13_owner_work_write_fence on public.community_works;
create trigger r13_owner_work_write_fence before insert or update on public.community_works
for each row execute function private.r13_guard_suppressed_owner_work_write();
revoke all on function private.r13_guard_suppressed_owner_work_write() from public,anon,authenticated,service_role;

-- Prevent stale publisher/worker race from reinstating a discoverable
-- search document once the barrier has been durably committed.
create or replace function private.r13_guard_search_projection()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_owner uuid;
begin
 select owner_account_id into v_owner from public.community_works where work_id=new.work_id;
 if v_owner is not null and exists(
  select 1 from private.r13_account_privacy_barriers where account_id=v_owner)
 then raise exception 'R13_SEARCH_PROJECTION_SUPPRESSED';end if;
 return new;
end $$;
drop trigger if exists r13_search_projection_suppression on public.search_documents;
create trigger r13_search_projection_suppression before insert or update on public.search_documents
for each row execute function private.r13_guard_search_projection();
revoke all on function private.r13_guard_search_projection() from public,anon,authenticated,service_role;

-- A private, isolated test-only owner privacy transaction. No request can
-- invoke via anon/authenticated/service_role. It does NOT claim deletion of
-- Storage bytes, prior issued URLs, full account tombstone or retention.
create or replace function private.r13_begin_account_privacy_barrier(
 p_subject uuid,p_session_id uuid,p_iat bigint,p_confirmation text,p_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_existing uuid;v_deleted_count bigint;
begin
 if p_confirmation<>'DELETE' or p_key is null or length(p_key) not between 16 and 160
 then raise exception 'R13_PRIVACY_CONFIRMATION_REQUIRED';end if;
 v_account:=private.require_recent_session(p_subject,p_session_id,p_iat,900);
 -- Single account row lock is acquired before barrier/index changes.
 perform 1 from public.wand_accounts a
  where a.account_id=v_account and a.status='active' and a.deleted_at is null
  for update;
 if not found then raise exception 'R13_ACCOUNT_NOT_ACTIVE';end if;
 select account_id into v_existing from private.r13_account_privacy_barriers
  where account_id=v_account;
 if v_existing is not null then raise exception 'R13_PRIVACY_ALREADY_SUPPRESSED';end if;
 insert into private.r13_account_privacy_barriers
  (account_id,auth_subject,session_id,request_key)
 values(v_account,p_subject,p_session_id,p_key);
 -- Keep provider identity evidence; invalidate previous session-issued tokens.
 update public.auth_identities set sessions_valid_after=
  date_trunc('second',clock_timestamp())+interval '1 second'
 where account_id=v_account and identity_state='active';
 update public.creator_profiles set profile_visibility='private'
 where owner_account_id=v_account;
 delete from public.search_documents
 where work_id in(select work_id from public.community_works where owner_account_id=v_account);
 get diagnostics v_deleted_count=row_count;
 insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
 values(v_account,'account.privacy_barrier',null,
   jsonb_build_object('phase','durable_public_suppression','cleanup','deferred',
                      'requestKey',p_key,'searchDocumentsRemoved',v_deleted_count));
 insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
 values('wand_account',v_account,'account.privacy_suppressed',
   jsonb_build_object('accountId',v_account,'privacySuppressionActive',true,
                      'storageDeletionComplete',false,'oldBearerUrlsRevoked',false),
   'r13.account.privacy_suppressed:'||v_account::text);
 return jsonb_build_object('accountId',v_account,'suppressed',true,
   'cleanupComplete',false,'previouslyIssuedMediaUrlsRevoked',false,
   'searchDocumentsRemoved',v_deleted_count);
end $$;
revoke all on function private.r13_begin_account_privacy_barrier(uuid,uuid,bigint,text,text)
 from public,anon,authenticated,service_role;
