-- 03 COMM R13 synthetic Source-only historical Identity rejection.
-- Disposable local Supabase full schema only. Entire fixture ROLLBACK.
begin;
do $r13_identity$
declare
  v_owner uuid;
  v_original uuid;
  v_historical uuid:=gen_random_uuid();
  v_gallery uuid;
  v_creator uuid;
  v_session uuid:=gen_random_uuid();
  v_issued bigint:=extract(epoch from clock_timestamp())::bigint;
  v_result jsonb;
  v_msg text;
  v_state text;
  v_test text;
  v_work_version bigint;
  v_outbox bigint;
  v_identity_count integer:=0;
begin
  select i.account_id,i.provider_subject::uuid,c.creator_profile_id,w.work_id
  into v_owner,v_original,v_creator,v_gallery
  from public.auth_identities i
  join public.creator_profiles c on c.owner_account_id=i.account_id
  join public.community_works w on w.owner_account_id=i.account_id
  where c.handle='isolated_bootstrap_creator'
    and i.provider='supabase' and w.work_type='gallery' limit 1;
  if v_owner is null or v_original is null or v_gallery is null then
    raise exception 'R13_SYNTHETIC_ACCOUNT_SEED_MISSING';
  end if;
  -- A second historical Supabase identity remains tied to an ACTIVE account,
  -- while its real currently active Supabase identity is still usable.
  insert into public.auth_identities(
    account_id,provider,provider_subject,last_verified_at,identity_state
  ) values(v_owner,'supabase',v_historical::text,now(),'active');
  insert into auth.users(id) values(v_historical)
    on conflict(id) do nothing;
  insert into auth.sessions(id,user_id,created_at)
    values(v_session,v_historical,clock_timestamp());
  if private.resolve_active_account(v_historical) is distinct from v_owner then
    raise exception 'R13_ACTIVE_IDENTITY_POSITIVE_REGRESSION';
  end if;
  if (public.community_authorize_session(v_historical,v_issued,null)->>'accountId')::uuid
     is distinct from v_owner then
    raise exception 'R13_ACTIVE_SESSION_POSITIVE_REGRESSION';
  end if;
  select row_version into v_work_version from public.community_works
  where work_id=v_gallery;
  select count(*) into v_outbox from public.outbox_events;
  -- Retire only the synthetic historical identity, NOT the account.
  update public.auth_identities set identity_state='retired',retired_at=now()
  where provider='supabase' and provider_subject=v_historical::text;
  if private.resolve_active_account(v_original) is distinct from v_owner then
    raise exception 'R13_UNRELATED_ACTIVE_IDENTITY_REGRESSION';
  end if;
  if not exists(select 1 from public.wand_accounts
    where account_id=v_owner and status='active' and deleted_at is null) then
    raise exception 'R13_ACCOUNT_INCORRECTLY_TOMBSTONED';
  end if;

  -- All paths must reject the RETIRED historical actor at their shared
  -- resolver BEFORE attempting downstream owner/creator/version/media work.
  for v_test in select unnest(array[
    'resolver','session','gallery_write','gallery_read',
    'gallery_media','scene_owner_readiness'
  ]) loop
    v_msg:=null;v_state:=null;
    begin
      case v_test
      when 'resolver' then
        perform private.resolve_active_account(v_historical);
      when 'session' then
        perform public.community_authorize_session(v_historical,v_issued,null);
      when 'gallery_write' then
        perform public.community_change_work_visibility(
          v_historical,v_gallery,v_work_version,'public','r13-retired-'||gen_random_uuid()
        );
      when 'gallery_read' then
        perform public.community_get_gallery_v1(v_historical,v_gallery);
      when 'gallery_media' then
        perform public.community_gallery_owner_media_read_v1(v_historical,gen_random_uuid());
      when 'scene_owner_readiness' then
        perform public.community_scene_revision_readiness_v1(v_historical,gen_random_uuid());
      end case;
      raise exception 'R13_RETIRED_IDENTITY_ACCEPTED_%',v_test;
    exception when others then
      get stacked diagnostics v_msg=message_text, v_state=returned_sqlstate;
      if v_msg='R13_RETIRED_IDENTITY_ACCEPTED_'||v_test
         or v_msg is distinct from 'Active AuthIdentity not found' then
        raise exception 'R13_WRITER_GATE_WRONG_RESULT %: SQLSTATE % / %',
          v_test,v_state,v_msg;
      end if;
    end;
    v_identity_count:=v_identity_count+1;
  end loop;
  if v_identity_count<>6 then raise exception 'R13_WRITER_GATE_COVERAGE_MISSING';end if;
  if (select row_version from public.community_works where work_id=v_gallery)
       is distinct from v_work_version
     or (select count(*) from public.outbox_events)<>v_outbox then
    raise exception 'R13_FAILED_AUTH_MUTATED_WORK_OR_OUTBOX';
  end if;

  -- Defensive drift case: state='active' paired with a nonnull retirement
  -- timestamp must remain denied instead of resurrecting a retired Subject.
  update public.auth_identities
     set identity_state='active',retired_at=clock_timestamp()
     where provider='supabase' and provider_subject=v_historical::text;
  begin
    perform private.resolve_active_account(v_historical);
    raise exception 'R13_RETIRED_AT_INCONSISTENCY_ACCEPTED';
  exception when others then
    get stacked diagnostics v_msg=message_text;
    if v_msg is distinct from 'Active AuthIdentity not found' then raise; end if;
  end;

  -- Account-level privacy suppression remains separate from identity
  -- retirement, still readable for a CURRENT active identity until phase1.
  update public.auth_identities
     set identity_state='retired',retired_at=clock_timestamp()
     where provider='supabase' and provider_subject=v_historical::text;
  if private.is_account_privacy_suppressed(v_owner) then
    raise exception 'R13_RETIRED_IDENTITY_FABRICATED_PRIVACY_SUPPRESSION';
  end if;
  raise notice 'R13_RETIRED_IDENTITY_6_WRITER_GATES_SOURCE_PASS';
end
$r13_identity$;
rollback;
