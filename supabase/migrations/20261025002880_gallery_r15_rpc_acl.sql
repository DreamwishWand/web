revoke all on function public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text) to service_role;
-- R14 v4 ACL stays unchanged; no anon/authenticated grants are introduced.
