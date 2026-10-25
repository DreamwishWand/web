do $acl$
begin
  execute 'revoke all on function public.community_set_gallery_comments_enabled_atomic_r16(uuid,uuid,bigint,uuid,boolean,text) from public,anon,authenticated,service_role';
  execute 'grant execute on function public.community_set_gallery_comments_enabled_atomic_r16(uuid,uuid,bigint,uuid,boolean,text) to service_role';
end;
$acl$;
