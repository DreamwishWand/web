
-- pgcrypto is installed in Supabase's extensions schema. Keep a fixed search_path,
-- but include extensions so digest() remains resolvable inside SECURITY DEFINER RPCs.
alter function public.community_create_gallery_draft(uuid,uuid,text,text,text)
  set search_path = pg_catalog, extensions, public, private;
alter function public.community_publish_gallery(uuid,uuid,bigint,text,text,text)
  set search_path = pg_catalog, extensions, public, private;
alter function public.community_add_comment(uuid,uuid,uuid,uuid,text,text)
  set search_path = pg_catalog, extensions, public, private;
alter function public.community_report_entity(uuid,uuid,text,text,text)
  set search_path = pg_catalog, extensions, public, private;
