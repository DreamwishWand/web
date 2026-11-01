#!/usr/bin/env python3
"""Reproduce conditional legacy SECURITY DEFINER public Work disclosure in disposable full153.
Source144/F08/F09 fixture shape reused, but only two legacy RPCs and
R20 predicate exercised. No real JWT, user Media, Storage or external endpoints.
Mode REPRO=1 detects actual static hypothesis. REPRO=0 tests candidate closure.
"""
import json,os,uuid,hashlib,psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
uid=uuid.uuid4
account,subject,creator,work,rev,media,entry,challenge=[uid() for _ in range(8)]
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
def reads(c):
 try:
  with c.transaction():
   search=one(c,"select public.community_search_gallery_dreamsnaps_public_v1(null,30)")
  found=any(x.get('workId')==str(work) for x in search)
 except psycopg.Error as e:
  raise AssertionError('SEARCH_SQL_FAILED '+str(e)) from e
 try:
  with c.transaction():
   detail=one(c,"select public.community_get_gallery_dreamsnap_public_v1(%s)",(work,))
  detailed=isinstance(detail,dict) and detail.get('workId')==str(work)
 except psycopg.Error:
  detail=None;detailed=False
 return dict(search=found,detail=detailed,mediaId=str(media) if detailed else None,
  creatorId=str(creator) if found or detailed else None,
  caption=detail.get('caption') if detail else None)
def denied(c,case):
 r=reads(c)
 assert not r['search'] and not r['detail'],(case,r)
 return r
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
          values(%s,%s,%s,'Legacy reader local creator')""",(creator,account,'leg_'+uid().hex[:20]))
        a.execute("""insert into public.dreamsnap_challenges(
          challenge_id,challenge_key,title,lifecycle_state,
          submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,
          results_at,closes_at,formal_vote_allowance,special_pick_allowance,
          minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic
          ) values (%s,%s,'Legacy reader local challenge','results',
          now()-interval '6 hours',now()-interval '5 hours',
          now()-interval '4 hours',now()-interval '3 hours',
          now()-interval '2 hours',now()+interval '1 hour',2,1,1,1,false)""",
          (challenge,'leg_'+uid().hex[:20]))
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
          (media,account,f'legacy/disposable/{media}.png','a'*64))
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
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==153
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    rawsearch=one(a,"select pg_get_functiondef('public.community_search_gallery_dreamsnaps_public_v1(text,integer)'::regprocedure)")
    rawdetail=one(a,"select pg_get_functiondef('public.community_get_gallery_dreamsnap_public_v1(uuid)'::regprocedure)")
    print(json.dumps({'marker':'LEGACY_DB_FINAL_DEFINITIONS',
      'searchSha256':hashlib.sha256(rawsearch.encode()).hexdigest(),
      'detailSha256':hashlib.sha256(rawdetail.encode()).hexdigest(),
      'searchReferencesR20': 'dreamsnap_public_work_accessible_r20' in rawsearch,
      'detailReferencesR20': 'dreamsnap_public_work_accessible_r20' in rawdetail,
      'searchSecurityDefiner': 'SECURITY DEFINER' in rawsearch.upper(),
      'detailSecurityDefiner': 'SECURITY DEFINER' in rawdetail.upper()}),flush=True)
    baseline=reads(b)
    assert baseline['search'] and baseline['detail'],baseline
    assert one(a,"select count(*) from private.dreamsnap_official_result_account_consent_r20 where account_id=%s",(account,))==0
    assert one(b,"select private.dreamsnap_public_work_accessible_r20(%s)",(work,)) is True
    print(json.dumps({'marker':'LEGACY_VALID_PUBLIC_WORK_WITH_OFF_OFFICIAL_CONSENT_PASS','observed':baseline}),flush=True)
    mode=os.getenv('LEGACY_EXPECT_EXPOSURE')=='1'
    scenarios=[
      ('ACCOUNT_RESTRICTED',"update public.wand_accounts set status='restricted' where account_id=%s",(account,)),
      ('IDENTITY_RETIRED',"update public.auth_identities set identity_state='retired' where account_id=%s",(account,)),
      ('PRIVACY_SUPPRESSED',"insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,)),
      ('CREATOR_ENTITY_DELETED',"update public.community_entities set deleted_at=now() where entity_id=%s",(creator,)),
      ('CREATOR_PRIVATE',"update public.creator_profiles set profile_visibility='private' where creator_profile_id=%s",(creator,))
    ]
    exposed=0
    for label,sql,args in scenarios:
      with a.transaction():
        a.execute('savepoint legacy_probe')
        try:
          a.execute(sql,args)
          source144=one(a,"select private.dreamsnap_public_work_accessible_r20(%s)",(work,))
          actual=reads(a)
          state=a.execute("""
            select w.lifecycle_state,w.visibility,w.moderation_state,
                   a.status,ai.identity_state,cp.profile_visibility,
                   gp.publication_state,ce.deleted_at is not null,
                   private.is_account_privacy_suppressed(w.owner_account_id),
                   cp.moderation_state,e.entry_state,e.eligibility_state,
                   e.managed_under13,m.processing_state,m.moderation_state,
                   w.current_published_revision_id=gp.revision_id,
                   e.entry_revision_id=gp.revision_id
            from public.community_works w
            join public.wand_accounts a on a.account_id=w.owner_account_id
            join public.auth_identities ai on ai.account_id=a.account_id
            join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
            join public.community_entities ce on ce.entity_id=cp.creator_profile_id
            join public.dreamsnap_gallery_publications gp on gp.work_id=w.work_id
            join public.dreamsnap_entries e on e.entry_id=gp.entry_id
            join public.work_revision_media wrm on wrm.work_revision_id=gp.revision_id and wrm.role='dreamsnap' and wrm.ordinal=0
            join public.media_assets m on m.media_id=wrm.media_id
            where w.work_id=%s limit 1
          """,(work,)).fetchone()
          assert state is not None,(label,'missing Work state')
          assert source144 is False,(label,'Source144 R20 unexpectedly true',actual)
          if mode:
            if actual['search'] or actual['detail']: exposed+=1
          else:
            assert not actual['search'] and not actual['detail'],(label,actual)
          print(json.dumps({'case':label,'source144PublicAccess':source144,
            'legacySearchReturnedWork':actual['search'],'legacyDetailReturnedWork':actual['detail'],
            'mediaIdReturned':actual['mediaId'] is not None,
            'creatorIdReturned':actual['creatorId'] is not None,
            'captionReturned':actual['caption'] is not None,
            'effectiveWorkLifecycle':state[0],'effectiveWorkVisibility':state[1],
            'effectiveWorkModeration':state[2], 'effectiveAccountStatus':state[3],
            'effectiveIdentityState':state[4], 'effectiveCreatorVisibility':state[5],
            'effectivePublicationState':state[6],
            'creatorEntityDeleted':state[7],'effectivePrivacySuppression':state[8],
            'creatorModeration':state[9], 'entryState':state[10],
            'entryEligibility':state[11],'entryUnder13':state[12],
            'mediaProcessing':state[13],'mediaModeration':state[14],
            'workCurrentRevisionEqualsGallery':state[15],
            'entryRevisionEqualsGallery':state[16]}),flush=True)
        finally:
          a.execute('rollback to savepoint legacy_probe')
          a.execute('release savepoint legacy_probe')
    if mode:
      assert exposed>=1,('NO_TRUE_RED',exposed)
      print(json.dumps({'marker':'LEGACY_ACTUAL_SQL_TRUE_RED_REPRODUCED','scenariosWithExposure':exposed}),flush=True)
    else:
      print(json.dumps({'marker':'LEGACY_EXISTING_EFFECTIVE_GUARDS_NO_TRUE_RED','scenariosWithExposure':exposed}),flush=True)
    assert reads(b)==baseline,'Valid PUBLIC Work drift after rollbacks'
    print(json.dumps({'marker':'LEGACY_2PG_VALID_PUBLIC_WORK_PRESERVED','migrations':153,
      'realProvider':False,'signedJwt':False}),flush=True)
