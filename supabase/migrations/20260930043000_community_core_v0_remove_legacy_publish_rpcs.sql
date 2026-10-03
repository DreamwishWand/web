
drop function if exists public.community_publish_gallery(
  uuid,uuid,bigint,text,text,text
);
drop function if exists public.community_publish_gallery_v2(
  uuid,uuid,bigint,text,text,uuid[],text
);
