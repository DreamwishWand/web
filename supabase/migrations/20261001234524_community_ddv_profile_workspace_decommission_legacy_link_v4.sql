revoke execute on function public.community_link_ddv_profile_v1(
  uuid,uuid,bigint,text,text
) from service_role;

revoke execute on function public.community_get_linked_ddv_profiles(uuid)
from service_role;

revoke execute on function public.community_admin_correct_ddv_profile_link_v1(
  uuid,uuid,bigint,uuid,uuid,text
) from service_role;

comment on function public.community_link_ddv_profile_v1(uuid,uuid,bigint,text,text) is
  'SUPERSEDED: exclusive Linked DDV Profile model. Retained only as historical migration artifact; no runtime role has EXECUTE.';
comment on function public.community_get_linked_ddv_profiles(uuid) is
  'SUPERSEDED: use community_get_ddv_profile_workspaces_v1.';
comment on function public.community_admin_correct_ddv_profile_link_v1(uuid,uuid,bigint,uuid,uuid,text) is
  'SUPERSEDED: optional identity association now supports normal self-service unlink; legacy admin correction is disabled.';
