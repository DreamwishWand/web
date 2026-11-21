-- #124: fail-closed physical Storage origin-delete guard.
-- Existing SQL claim/lease/retry tests remain valid under ROLLBACK; the hourly
-- worker is forbidden to issue Storage.remove until 04 QR signed acceptance.
alter table private.gallery_media_capacity_policy_v1
 add column if not exists physical_orphan_cleanup_accepted boolean
 not null default false check(physical_orphan_cleanup_accepted=false);
create or replace function public.community_gallery_physical_cleanup_gate_v1()
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private as $$
select jsonb_build_object(
 'physicalDeleteAuthorized',false,
 'reason','GALLERY_PHYSICAL_STORAGE_DELETE_E2E_NOT_ACCEPTED',
 'conditional72hEnabled',false,
 'signedActorPhysicalAbsenceProven',false,
 'externalStorageRaceCertified',false,
 'cloudDependencyGraphComplete',false)
from private.gallery_media_capacity_policy_v1 where singleton=true
$$;
revoke all on function public.community_gallery_physical_cleanup_gate_v1()
 from public,anon,authenticated;
grant execute on function public.community_gallery_physical_cleanup_gate_v1()
 to service_role;
