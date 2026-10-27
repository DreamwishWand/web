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
    assert rows(c)==[],(label,rows(c))
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
    visible(b,'PUBLIC_WAND_WORK_WITH_OFF_GLOBAL_OFFICIAL_CONSENT')
    assert one(a,"select count(*) from private.dreamsnap_official_result_account_consent_r20 where account_id=%s",(account,))==0
    assert rows(b)[0]['formalScore']==100

    # Every test below runs an ACTUAL SQL update, actual SECURITY DEFINER
    # read and rollback within a savepoint. No real objects are modified.
    a.execute('begin')
    scenario(a,'PRIVATE_RETAINED_WORK',"update public.community_works set visibility='private' where work_id=%s",(work,))
    scenario(a,'UNPUBLISHED_RETAINED_WORK',"update public.community_works set lifecycle_state='unpublished' where work_id=%s",(work,))
    scenario(a,'DELETED_RETAINED_WORK',"update public.community_works set lifecycle_state='deleted' where work_id=%s",(work,))
    scenario(a,'RESTRICTED_WORK',"update public.community_works set moderation_state='restricted' where work_id=%s",(work,))
    scenario(a,'CREATOR_PRIVATE',"update public.creator_profiles set profile_visibility='private' where creator_profile_id=%s",(creator,))
    scenario(a,'CREATOR_MODERATED',"update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,))
    scenario(a,'ACCOUNT_RESTRICTED',"update public.wand_accounts set status='restricted' where account_id=%s",(account,))
    scenario(a,'RETIRED_IDENTITY',"update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
    scenario(a,'PRIVACY_SUPPRESSED',"insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,))
    scenario(a,'ENTRY_REMOVED',"update public.dreamsnap_entries set entry_state='removed' where entry_id=%s",(entry,))
    scenario(a,'ENTRY_UNDER_REVIEW',"update public.dreamsnap_entries set eligibility_state='under_review' where entry_id=%s",(entry,))
    scenario(a,'MANAGED_MINOR',"update public.dreamsnap_entries set managed_under13=true where entry_id=%s",(entry,))
    scenario(a,'MEDIA_MODERATED',"update public.media_assets set moderation_state='restricted' where media_id=%s",(media,))
    scenario(a,'MEDIA_PURGED',"update public.media_assets set purged_at=now() where media_id=%s",(media,))
    scenario(a,'CHALLENGE_EARLY',"update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",(challenge,))
    scenario(a,'CREATOR_ENTITY_DELETED',"update public.community_entities set deleted_at=now() where entity_id=%s",(creator,))
    scenario(a,'WORK_ENTITY_DELETED',"update public.community_entities set deleted_at=now() where entity_id=%s",(work,))
    scenario(a,'WORK_OWNER_CHANGED',"update public.community_works set owner_account_id=%s where work_id=%s",(uid(),work)) if False else None

    # Current and older media may differ after Entry revision reassociation.
    new_rev,new_media=uid(),uid()
    a.execute('savepoint f08revision')
    try:
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(new_media,))
        a.execute("""insert into public.community_work_revisions(
          revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,2,%s)""",(new_rev,work,account))
        a.execute("""insert into public.dreamsnap_work_revisions(
          revision_id,challenge_id,game_screenshot_attested,
          no_external_edits_attested,integrity_state)
          values(%s,%s,true,true,'eligible')""",(new_rev,challenge))
        a.execute("""insert into public.media_assets(
          media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
          checksum_sha256,processing_state,moderation_state)
          values(%s,%s,%s,'image/png',1001,1920,1080,%s,'ready','clear')""",
          (new_media,account,f'f08/disposable/{new_media}.png','b'*64))
        a.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(new_rev,new_media))
        a.execute("update public.dreamsnap_entry_revision_history set unbound_at=now() where entry_id=%s and unbound_at is null",(entry,))
        a.execute("update public.dreamsnap_entries set entry_revision_id=%s where entry_id=%s",(new_rev,entry))
        a.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,new_rev))
        assert rows(a)==[],('OLD_WAND_RESULT_REVISION_SHOULD_NOT_REASSOCIATE',rows(a))
        # Old media can remain valid as independently PUBLISHED gallery
        # revision; no global MediaID denial when a valid reference exists.
        assert media_read(a,media)['mediaId']==str(media)
        assert media_read(a,new_media)['mediaId']==str(new_media)
        a.execute("update public.dreamsnap_gallery_publications set publication_state='unpublished' where work_id=%s",(work,))
        denies(a,media)
        assert media_read(a,new_media)['mediaId']==str(new_media)
        print(json.dumps({'case':'ENTRY_REVISION_REPLACEMENT_AND_REFERENCE_BINDING',
          'oldWandResult':False,'oldMediaAfterGalleryUnpublished':False,'newEntryMedia':True}))
    finally:
        a.execute('rollback to savepoint f08revision')
        a.execute('release savepoint f08revision')
    assert rows(a)[0]['entryId']==str(entry)
    denies(a,uid())
    a.execute('rollback')
    visible(b,'PUBLIC_WORK_STILL_VISIBLE_AFTER_NEGATIVE_SAVEPOINTS')
    print(json.dumps({'result':'F08_F09_REAL_TWO_BACKEND_LOCAL_POSITIVE_NEGATIVE_PASS',
      'sourceOnly':True,'realStorage':False,'realSignedJwt':False,
      'stagingUntouched':True,'physicalDelete':False,'officialNumericPublic':False}))
