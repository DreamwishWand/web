#!/usr/bin/env python3
import json,os,uuid,psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
def one(c,q,a=()):
    return c.execute(q,a).fetchone()[0]
with psycopg.connect(dsn,autocommit=True) as c:
    owner,auth,creator,work,revision=(uuid.uuid4() for _ in range(5))
    with c.transaction():
        c.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
        c.execute("""insert into public.auth_identities(
            account_id,provider,provider_subject,last_verified_at,identity_state
        ) values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(auth)))
        c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile'),(%s,'community_work')",(creator,work))
        c.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,%s)""",(creator,owner,'isolated_r16_'+uuid.uuid4().hex[:14],'R16 comments isolated'))
        c.execute("""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'gallery','public','clear')""",(work,owner,creator))
        c.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
        c.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(work,))
        c.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,1,%s)""",(revision,work,owner))
        c.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'R16 metadata')",(revision,))
        c.execute("""update public.community_works set lifecycle_state='published',
            current_published_revision_id=%s,published_at=now() where work_id=%s""",(revision,work))
        c.execute("""insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
        ) values(%s,%s,'gallery',%s,'R16 metadata','',array[]::text[],
            '{"galleryKind":"outdoor","commentsEnabled":true}'::jsonb,now(),now())""",(work,work,creator))
    version=one(c,'select row_version from public.community_works where work_id=%s',(work,))
    registry=one(c,"select count(*) from private.community_writer_reference_registry_r16")
    writers=one(c,"select count(*) from private.community_writer_routes_r16")
    assert registry>=29 and writers>=18,(registry,writers)
    assert one(c,"select count(*) from private.community_writer_reference_registry_r16 where evidence_class='UNKNOWN'")>=5
    print(json.dumps({'case':'R16_REFERENCE_REGISTRY_PRESENT','references':registry,'writers':writers}))
def invoke(c,expected,rev,enabled,key):
    return one(c,"""select public.community_set_gallery_comments_enabled_atomic_r16(
       %s,%s,%s,%s,%s,%s)""",(auth,work,expected,rev,enabled,key))
def state(c):
    return tuple(c.execute("""select
      (select comments_enabled from public.gallery_work_settings where work_id=%s),
      (select facets->>'commentsEnabled' from public.search_documents where work_id=%s),
      (select count(*) from public.audit_events where target_entity_id=%s and action_type='gallery.comments_enabled'),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like 'r16%%'),
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select row_version from public.community_works where work_id=%s)
    """,(work,work,work,owner,work,work)).fetchone())
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
    assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
    start=state(a)
    for held in ('account','gallery'):
        a.execute('begin')
        if held=='account':
            one(a,'select account_id from public.wand_accounts where account_id=%s for update',(owner,))
        else:
            one(a,'select work_id from public.community_works where work_id=%s for update',(work,))
        b.execute('begin')
        b.execute("set local lock_timeout='250ms'")
        try:
            invoke(b,version,revision,False,'r16-held-'+held)
            raise AssertionError('R16_ATOMIC_LOCK_BYPASS_'+held)
        except psycopg.Error as e:
            assert e.sqlstate=='55P03',(held,e.sqlstate,str(e))
        b.execute('rollback')
        a.execute('rollback')
        assert state(b)==start
        print(json.dumps({'case':'R16_HELD_'+held.upper()+'_55P03','atomicRollback':True}))
with psycopg.connect(dsn,autocommit=True) as c:
    before=state(c)
    result=invoke(c,version,revision,False,'r16-commit')
    assert result['workId']==str(work) and result['commentsEnabled'] is False
    after=state(c)
    assert after[:5]==(False,'false',1,1,1),after
    assert after[5]>before[5],(before,after)
    replay=invoke(c,version,revision,False,'r16-commit')
    assert replay==result and state(c)==after
    try:
        invoke(c,version,revision,True,'r16-commit')
        raise AssertionError('R16_IDEMPOTENCY_CHANGED_INTENT_ACCEPTED')
    except psycopg.Error as e:
        assert 'R16_IDEMPOTENCY_CONFLICT' in str(e),str(e)
    try:
        invoke(c,version,revision,True,'r16-stale')
        raise AssertionError('R16_STALE_VERSION_ACCEPTED')
    except psycopg.Error as e:
        assert 'R16_STALE_WORK_TERMINAL' in str(e),str(e)
    assert state(c)==after
    print(json.dumps({'case':'R16_METADATA_COMMIT_REPLAY_STALE','oneSettingsSearchAuditIdempotency':True,
      'rowVersionAdvanced':True,'sameKeyReplayStable':True,'changedKeyStaleDenied':True}))
print(json.dumps({'result':'03COMM_R16_GALLERY_METADATA_TWO_BACKEND_SOURCE_PASS',
  'newScopedWriter':True,'photoMediaSceneWriterExpanded':False,'signedJWT':False,
  'nativeDDVWriter':False}))
