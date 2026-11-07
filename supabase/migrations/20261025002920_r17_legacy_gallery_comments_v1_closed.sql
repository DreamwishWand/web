create or replace function public.community_set_gallery_comments_enabled_v1(
  p_auth_subject uuid,p_work_id uuid,p_enabled boolean
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private as $r17$
begin
  raise exception 'R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED';
end;
$r17$;
