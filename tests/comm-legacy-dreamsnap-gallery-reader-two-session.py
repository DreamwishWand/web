#!/usr/bin/env python3
"""F08/F09: disposable LOCAL PostgreSQL only; real SQL/function calls, no Storage/JWT."""
import json,os,uuid,psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
uid=uuid.uuid4
account,subject,creator,work,rev,media,entry,challenge=[uid() for _ in range(8)]
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
def media_read(c,m=media):
    return one(c,"select public.community_get_public_media_storage_v2(%s)",(m,))
def rows(c):
    return one(c,"select public.community_get_dreamsnap_results_public_v1(%s)",(challenge,))['wandResults']
def denies(c,m=media):
    try:
        with c.transaction():
            media_read(c,m)
    except psycopg.Error as e:
        assert 'Public media is not accessible' in str(e),(e.sqlstate,str(e))
        return
    raise AssertionError('PUBLIC_MEDIA_UNEXPECTEDLY_AUTHORIZED')
def visible(c,label=''):
    a=media_read(c)
    assert a['mediaId']==str(media) and a['storageKey']==f'f08/disposable/{media}.png',(label,a)
    r=rows(c)
    assert len(r)==1 and r[0]['entryId']==str(entry) and r[0]['mediaId']==str(media),(label,r)
    assert one(c,"select private.dreamsnap_public_official_result(%s)",(entry,)) is None
def hidden(c,label=''):
    denies(c)
    try:
        with c.transaction():
            got=rows(c)
        assert got==[],(label,got)
    except psycopg.Error as e:
        # For an UNRELEASED challenge, the public Results endpoint correctly
        # rejects the entire request instead of returning an empty list.
        assert label=='CHALLENGE_EARLY' and 'DreamSnaps Results are not publicly accessible' in str(e),(label,str(e))
def scenario(c,name,sql,args=(),denied=True):
    c.execute('savepoint f08case')
    try:
        c.execute(sql,args)
        (hidden if denied else visible)(c,name)
        print(json.dumps({'case':name,'publicMedia':not denied,'wandResult':not denied}))
    finally:
        c.execute('rollback to savepoint f08case')
        c.execute('release savepoint f08case')
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
    assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
    with a.transaction():
        a.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
        a.execute("""insert into public.auth_identities(
          account_id,provider,provider_subject,last_verified_at,identity_state)
          values(%s,'supabase',%s,clock_timestamp(),'active')""",(account,str(subject)))
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile'),(%s,'community_work'),(%s,'media_asset')",(creator,work,media))
        a.execute("""insert into public.creator_profiles(
          creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,'F08 Public creator')""",(creator,account,'f08_'+uid().hex[:20]))
        a.execute("""insert into public.dreamsnap_challenges(
          challenge_id,challenge_key,title,lifecycle_state,
          submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,
          results_at,closes_at,formal_vote_allowance,special_pick_allowance,
          minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic
          ) values (%s,%s,'F08 local challenge','results',
          now()-interval '6 hours',now()-interval '5 hours',
          now()-interval '4 hours',now()-interval '3 hours',
          now()-interval '2 hours',now()+interval '1 hour',2,1,1,1,false)""",
          (challenge,'f08_'+uid().hex[:20]))
        a.execute("""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
          values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
        a.execute("""insert into public.community_work_revisions(
          revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,1,%s)""",(rev,work,account))
        a.execute("""insert into public.dreamsnap_works(
          work_id,challenge_id,workspace_relationship_kind,managed_under13)
          values(%s,%s,'self',false)""",(work,challenge))
        a.execute("""insert into public.dreamsnap_work_revisions(
          revision_id,challenge_id,game_screenshot_attested,
          no_external_edits_attested,integrity_state)
          values(%s,%s,true,true,'eligible')""",(rev,challenge))
        a.execute("""insert into public.media_assets(
          media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
          checksum_sha256,processing_state,moderation_state)
          values(%s,%s,%s,'image/png',1000,1920,1080,%s,'ready','clear')""",
          (media,account,f'f08/disposable/{media}.png','a'*64))
        a.execute("""insert into public.work_revision_media(
          work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')""",(rev,media))
        a.execute("""insert into public.dreamsnap_entries(
          entry_id,challenge_id,work_id,account_id,managed_under13,
          entry_revision_id,entry_state,eligibility_state,origin_kind)
          values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",
          (entry,challenge,work,account,rev))
        a.execute("""insert into public.dreamsnap_entry_revision_history(
          entry_id,revision_id) values(%s,%s)""",(entry,rev))
        a.execute("""insert into public.dreamsnap_gallery_publications(
          work_id,entry_id,revision_id,publication_state)
          values(%s,%s,%s,'published')""",(work,entry,rev))
        a.execute("""update public.community_works
          set lifecycle_state='published',visibility='public',
              current_published_revision_id=%s,published_at=now()
          where work_id=%s""",(rev,work))
        a.execute("""insert into public.dreamsnap_wand_results(
          entry_id,challenge_id,entry_revision_id,placement,formal_score)
          values(%s,%s,%s,1,100)""",(entry,challenge,rev))
    # Observe ORIGINAL Source44500 Search and FINAL Source44600 Detail while
    # Source144 V2 Media and Results enforce effective Account/Identity/Privacy.
    # Two genuine DB backends: A writes+commits; B reads as service_role.
    b.execute('set role service_role')
    def rpc(sql,args=()):
        try:
            with b.transaction():
                return one(b,sql,args)
        except psycopg.Error as e:
            return {'error':str(e).split('\\n')[0]}
    def snapshot(label):
        gate=one(a,"select private.dreamsnap_public_work_accessible_r20(%s)",(work,))
        search=rpc("select public.community_search_gallery_dreamsnaps_public_v1(null,30)")
        detail=rpc("select public.community_get_gallery_dreamsnap_public_v1(%s)",(work,))
        media_out=rpc("select public.community_get_public_media_storage_v2(%s)",(media,))
        result_out=rpc("select public.community_get_dreamsnap_results_public_v1(%s)",(challenge,))
        s_ok=isinstance(search,list) and any(z.get('workId')==str(work) for z in search)
        d_ok=isinstance(detail,dict) and detail.get('workId')==str(work)
        m_ok=isinstance(media_out,dict) and media_out.get('mediaId')==str(media)
        w_ok=isinstance(result_out,dict) and any(z.get('entryId')==str(entry) for z in result_out.get('wandResults',[]))
        state={'case':label,'effectiveGuard':gate,'legacySearchReturnsWork':s_ok,
            'legacyDetailReturnsWork':d_ok,'source144MediaReturnsKey':m_ok,
            'source144WandReturnsEntry':w_ok,
            'detailError':detail.get('error') if isinstance(detail,dict) else None}
        print(json.dumps(state),flush=True)
        return state
    join_diag=one(a,"""select jsonb_build_object(
      'gpState',gp.publication_state,'gpRevision',gp.revision_id,
      'entryRevision',e.entry_revision_id,'challengeState',c.lifecycle_state,
      'dreamsnapRevision',dr.revision_id,'imageId',wrm.media_id,
      'gpWorkMatchesEntry',gp.work_id=e.work_id)
      from public.dreamsnap_gallery_publications gp
      left join public.dreamsnap_entries e on e.entry_id=gp.entry_id
      left join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
      left join public.dreamsnap_work_revisions dr on dr.revision_id=gp.revision_id
      left join public.work_revision_media wrm on wrm.work_revision_id=gp.revision_id
         and wrm.ordinal=0 and wrm.role='dreamsnap'
      where gp.work_id=%s""",(work,))
    print(json.dumps({'marker':'LEGACY_GALLERY_JOIN_DIAG','tuple':join_diag}),flush=True)
    detailed_sql_join=one(a,"""select count(*)
      from public.dreamsnap_gallery_publications gp
      join public.dreamsnap_entries e on e.entry_id=gp.entry_id
      join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
      join public.dreamsnap_work_revisions dr on dr.revision_id=gp.revision_id
      join public.work_revision_media wrm on wrm.work_revision_id=gp.revision_id
        and wrm.ordinal=0 and wrm.role='dreamsnap'
      where gp.work_id=%s and gp.publication_state='published'
        and c.lifecycle_state in ('results','closed')
        and c.is_synthetic=false and e.entry_state='entered'
        and e.eligibility_state='eligible'""",(work,))
    print(json.dumps({'marker':'LEGACY_DETAIL_SQL_JOIN_COUNT_AS_POSTGRES',
      'rows':detailed_sql_join}),flush=True)
    baseline=snapshot('ACTIVE_PUBLIC')
    assert baseline['effectiveGuard'] and all(baseline[k] for k in
      ['legacySearchReturnsWork','legacyDetailReturnsWork',
       'source144MediaReturnsKey','source144WandReturnsEntry']),baseline
    witness=[]
    trials=[
      ('ACCOUNT_RESTRICTED',
       "update public.wand_accounts set status='restricted' where account_id=%s",
       (account,),
       "update public.wand_accounts set status='active' where account_id=%s",
       (account,)),
      ('RETIRED_IDENTITY',
       "update public.auth_identities set identity_state='retired' where account_id=%s",
       (account,),
       "update public.auth_identities set identity_state='active',retired_at=null where account_id=%s",
       (account,)),
      ('PRIVACY_SUPPRESSION',
       "insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",
       (account,),
       "delete from private.account_privacy_suppressions where account_id=%s",
       (account,)),
      ('CREATOR_ENTITY_TOMBSTONE',
       "update public.community_entities set deleted_at=now() where entity_id=%s",
       (creator,),
       "update public.community_entities set deleted_at=null where entity_id=%s",
       (creator,)),
    ]
    for label,change,args,restore,rargs in trials:
        with a.transaction():a.execute(change,args)
        try:
            z=snapshot(label)
            assert z['effectiveGuard'] is False and not z['source144MediaReturnsKey'] and not z['source144WandReturnsEntry'],z
            witness.append(z)
        finally:
            with a.transaction():a.execute(restore,rargs)
        assert snapshot(label+'_RESTORED')['effectiveGuard'] is True
    # Additional metadata-only negative cases. Account/Work itself may remain
    # PUBLIC (e.g. an unpublished Gallery publication while the entered image
    # is still authorized independently by Source144 Entry Media OR).
    other=[
      ('CREATOR_PRIVATE',
       "update public.creator_profiles set profile_visibility='private' where creator_profile_id=%s",
       (creator,),
       "update public.creator_profiles set profile_visibility='public' where creator_profile_id=%s",
       (creator,)),
      ('CREATOR_MODERATION',
       "update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",
       (creator,),
       "update public.creator_profiles set moderation_state='clear' where creator_profile_id=%s",
       (creator,)),
      ('MEDIA_MODERATION',
       "update public.media_assets set moderation_state='restricted' where media_id=%s",
       (media,),
       "update public.media_assets set moderation_state='clear' where media_id=%s",
       (media,)),
      ('ENTRY_INELIGIBLE',
       "update public.dreamsnap_entries set eligibility_state='ineligible' where entry_id=%s",
       (entry,),
       "update public.dreamsnap_entries set eligibility_state='eligible' where entry_id=%s",
       (entry,)),
      ('GALLERY_PUBLICATION_UNPUBLISHED',
       "update public.dreamsnap_gallery_publications set publication_state='unpublished' where work_id=%s",
       (work,),
       "update public.dreamsnap_gallery_publications set publication_state='published' where work_id=%s",
       (work,)),
      ('CHALLENGE_EARLY',
       "update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",
       (challenge,),
       "update public.dreamsnap_challenges set lifecycle_state='results' where challenge_id=%s",
       (challenge,)),
    ]
    for label,change,args,restore,rargs in other:
        with a.transaction():a.execute(change,args)
        try:
            z=snapshot(label)
            assert not z['legacySearchReturnsWork'] and not z['legacyDetailReturnsWork'],z
            print(json.dumps({'marker':'LEGACY_GALLERY_SOURCE145_METADATA_NEGATIVE','case':label}),flush=True)
        finally:
            with a.transaction():a.execute(restore,rargs)
        assert snapshot(label+'_RESTORED')['legacyDetailReturnsWork'] is True

    leaked=[z for z in witness if z['legacySearchReturnsWork'] or z['legacyDetailReturnsWork']]
    print(json.dumps({'marker':'LEGACY_GALLERY_SOURCE145_POSTFIX_COMPARISON',
      'exposureCount':len(leaked),'exposureCases':[z['case'] for z in leaked],
      'baselineSearchPositive':baseline['legacySearchReturnsWork'],
      'baselineDetailPositive':baseline['legacyDetailReturnsWork'],
      'liveStage':False,'jwt':False,'realMedia':False,'oldCdnBearerRevoked':False}),flush=True)
    assert not leaked,('LEGACY_GALLERY_SOURCE145_PUBLIC_READER_LEAK',leaked)
    print(json.dumps({'marker':'LEGACY_GALLERY_SOURCE145_REAL_TWO_PG_NEGATIVE_PASS',
      'effectiveGuard':True,'source144Source141Regression':True}),flush=True)
