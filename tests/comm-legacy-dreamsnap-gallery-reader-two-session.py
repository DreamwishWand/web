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
    leaked=[z for z in witness if z['legacySearchReturnsWork'] or z['legacyDetailReturnsWork']]
    print(json.dumps({'marker':'LEGACY_GALLERY_144_SQL_REPRODUCTION',
      'evidence':len(leaked),'cases':[z['case'] for z in leaked],
      'liveStage':False,'jwt':False,'realMedia':False,'newMigration':False}),flush=True)
    assert leaked, 'LEGACY_GALLERY_READER_NOT_REPRODUCED_IN_ISOLATED_ACTUAL_PG'
