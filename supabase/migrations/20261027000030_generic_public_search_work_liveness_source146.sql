-- 03 COMM / Issue #228 X06: CONFIRMED full145 local anon generic Search RED.
-- Forward-only Source146, solely the SearchDocument RLS reader boundary.
-- Keep Source141-145 and canonical publisher/index updater byte-unchanged.
-- Source144 r20 is effective public DreamSnaps Work authority; numeric official
-- DDV result account-global OFF is independent of legitimate Wand Public Work.
--
-- SECURITY DEFINER boolean RLS adapter is required because Source144 r20
-- deliberately REVOKES EXECUTE from anon/authenticated/service_role. Never
-- grant r20 directly to Data API callers.
create or replace function private.generic_public_search_work_accessible_r21(
  p_work_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $generic_search_work$
  select case
    when w.work_type = 'dreamsnap'
      then coalesce(private.dreamsnap_public_work_accessible_r20(w.work_id), false)
    else coalesce(private.is_discoverable_work(w.work_id), false)
  end
  from public.community_works w
  where w.work_id = p_work_id
$generic_search_work$;

revoke all on function private.generic_public_search_work_accessible_r21(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.generic_public_search_work_accessible_r21(uuid)
to anon, authenticated;

-- Replace precisely the historical permissive public SearchDocument read
-- policy. Do not ADD another permissive policy (PostgreSQL ORs policies).
-- The actual Work row determines type, not potentially stale index metadata.
-- All non-DreamSnap types preserve the exact prior is_discoverable_work rule.
drop policy if exists search_documents_public_read on public.search_documents;
create policy search_documents_public_read
on public.search_documents
for select to anon, authenticated
using (coalesce(private.generic_public_search_work_accessible_r21(work_id), false));

comment on function private.generic_public_search_work_accessible_r21(uuid) is
  'Source146: generic SearchDocument RLS; DreamSnaps use accepted Source144 r20 Account/Identity/Creator Work liveness; all other Work types keep prior discoverable predicate; no official DDV numeric disclosure.';
