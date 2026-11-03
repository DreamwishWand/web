-- Source157 / W-COMM-006 / STRICTLY FORWARD AFTER SOURCE156.
-- DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC NO-GO.
--
-- Disposable exact FULL156 catalog evidence:
-- 41573411206: public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)
-- had service_role EXECUTE=true and anon/authenticated EXECUTE=false.
-- The v2 DreamSnaps branch can mutate publication/Search/Audit using only the
-- claimed subject; it has NO in-transaction verified GoTrue signed session.
-- PR337 is a separate Edge-only OFF candidate, NOT independently accepted yet.
--
-- Only retire the unaccepted raw legacy v2 service_role invocation.
-- Keep Source154/155/156 SQL bytes, Source156 signed R16, first Account, and
-- unrelated emergency Moderation/Privacy/retention grants untouched.
-- Function definition remains for historical schema and owner-internal calls.
-- This migration neither enrolls nor remaps a Writer.
--
-- Rollback: before deploy, revert this isolated Draft branch. After any
-- authorized deployment, restoring the unsafe service_role EXECUTE is a
-- separate Owner security-risk decision: backup first and only run guarded
-- GRANT in an isolated recovery transaction with repeat signed/ACL QA.
-- No automatic/down migration reopens the prior legacy capability.
do $pre$
begin
  if to_regprocedure('public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)')
    is null then
    raise exception 'SOURCE157_EXPECTED_LEGACY_V2_FUNCTION_MISSING';
  end if;
  if not has_function_privilege('service_role',
     'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)',
     'EXECUTE') then
    raise exception 'SOURCE157_ACCEPTED_R16_WRITER_GRANT_MISSING';
  end if;
end
$pre$;

revoke execute on function public.community_set_gallery_comments_enabled_v2(
  uuid,uuid,boolean
) from public,anon,authenticated,service_role;

do $post$
begin
  if has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)',
    'EXECUTE') or
    has_function_privilege('anon',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)',
    'EXECUTE') or
    has_function_privilege('authenticated',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)',
    'EXECUTE') then
    raise exception 'SOURCE157_UNBOUND_LEGACY_V2_WRITER_NOT_CLOSED';
  end if;
  if not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)',
    'EXECUTE') then
    raise exception 'SOURCE157_ACCIDENTALLY_REVOKED_R16';
  end if;
end
$post$;
