-- R13 independent validation-only PostgreSQL overlay.
-- Crucial trigger ordering: AAA before existing
-- community_works_privacy_positive_guard_v1; acquiring Account FOR SHARE
-- after that guard would still allow a pre-commit privacy race.
-- This file is NOT a migration, NOT deployed, NOT a production security approval.
create or replace function private.r13_owner_account_writer_root_fence()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
begin
  perform 1 from public.wand_accounts
   where account_id=new.owner_account_id for share;
  if not found then raise exception 'R13_OWNER_ACCOUNT_NOT_FOUND';end if;
  return new;
end $$;
revoke all on function private.r13_owner_account_writer_root_fence()
from public,anon,authenticated,service_role;
drop trigger if exists aaa_r13_owner_account_root_fence on public.community_works;
create trigger aaa_r13_owner_account_root_fence
 before insert or update on public.community_works
 for each row execute function private.r13_owner_account_writer_root_fence();
