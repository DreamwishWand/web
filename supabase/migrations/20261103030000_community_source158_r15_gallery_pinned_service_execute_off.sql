-- Source158 / W-COMM-006 R15 Pinned Gallery Legacy SQL OFF.
-- STRICTLY FORWARD after frozen Source154/155/156 and accepted Source157.
-- DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC WRITER NO-GO.
--
-- Direct evidence PR363 exact c11c5271c9550d17a9dfcde590631d342adf3d6a,
-- disposable FULL157 real GoTrue ES256 CI41613191458:
-- genuinely signed A1 passes preflight; Source154 Local revoke commits;
-- A1 verified signed Session now 401; subsequent service-role R15 direct
-- RPC COMMITTED and mutated Gallery Work/Revision/Search/Outbox/Idempotency.
-- The test staged preflight and SQL in separate transactions: it does NOT
-- demonstrate a live HTTP in-flight race or a client-held service_role key.
--
-- This unsupported R15 business Writer MUST NOT accept a subject-only direct
-- service_role call. Until a new same-transaction verified GoTrue Session +
-- graph CAS writer is independently accepted, its service invocation is OFF.
-- R16 new signed atomic Gallery comments, Source157 legacy v2 OFF, emergency
-- Moderation/Privacy and other unrelated RPCs are unchanged.
--
-- Rollback contract: abandon the Draft before deployment. After an expressly
-- authorized deployment, do not auto-regrant unsafe R15. Recovery requires
-- Owner risk acceptance, backup, per-operation independent fresh signed QA,
-- and a new forward-only migration. A disposable GRANT+ROLLBACK dry run can
-- prove ACL reversibility without authorizing production rollback.
do $pre$
begin
  if to_regprocedure('public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)') is null then
    raise exception 'SOURCE158_R15_EXPECTED_RPC_NOT_PRESENT';
  end if;
  if has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)', 'EXECUTE') then
    raise exception 'SOURCE158_SOURCE157_LEGACY_COMMENTS_OFF_PRECONDITION_MISSING';
  end if;
  if not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)', 'EXECUTE') then
    raise exception 'SOURCE158_SIGNED_R16_GRANT_PRECONDITION_MISSING';
  end if;
end
$pre$;

revoke all on function public.community_publish_gallery_pinned_r15(
  uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text
) from public,anon,authenticated,service_role;

do $post$
begin
  if has_function_privilege('service_role',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)', 'EXECUTE')
    or has_function_privilege('anon',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)', 'EXECUTE') then
    raise exception 'SOURCE158_UNVERIFIED_R15_PINNED_WRITER_EXECUTE_STILL_ON';
  end if;
  if has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)', 'EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)', 'EXECUTE') then
    raise exception 'SOURCE158_LEGACY_V2_OR_ACCEPTED_R16_GRANT_REGRESSION';
  end if;
end
$post$;
