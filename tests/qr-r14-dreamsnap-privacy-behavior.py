#!/usr/bin/env python3
"""04 QR R14 DreamSnaps live SQL behavior, synthetic challenge only, rollback-only.
No manufactured real competition result, no votes, no signed JWT or media bytes.
"""
import json, os, uuid
import psycopg
assert os.getenv("DDVRE_QR_R14_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_DB_URL")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,s,a=()):return c.execute(s,a).fetchone()[0]
def denied(c,s,a=()):
    c.execute("savepoint negative")
    try:c.execute(s,a).fetchone()
    except psycopg.Error:
        c.execute("rollback to savepoint negative")
        c.execute("release savepoint negative")
        return True
    c.execute("release savepoint negative")
    return False
with psycopg.connect(DSN,autocommit=True,connect_timeout=4) as c:
    c.execute("begin")
    try:
        account,subject,creator=c.execute("""
          select i.account_id,i.provider_subject::uuid,p.creator_profile_id
          from public.auth_identities i
          join public.creator_profiles p on p.owner_account_id=i.account_id
          where i.provider='supabase' and i.identity_state='active'
            and p.handle='isolated_bootstrap_creator'
          limit 1
        """).fetchone()
        viewer,viewer_subject=c.execute("""
          select i.account_id,i.provider_subject::uuid from public.auth_identities i
          where i.account_id<>%s and i.provider='supabase' and i.identity_state='active'
          limit 1
        """,(account,)).fetchone()
        tag="qr-r14-"+str(uuid.uuid4())[:8]
        media=uuid.uuid4()
        c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
        c.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,
           mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
           values(%s,%s,%s,'image/png',1024,1920,1080,%s,'ready','clear')""",
           (media,account,"ci-only/"+tag+".png","c"*64))
        challenge=one(c,"""insert into public.dreamsnap_challenges(
          challenge_key,title,description,lifecycle_state,
          submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
          formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
          allow_post_formal_browse,allow_special_picks,result_algorithm,
          required_aspect_numerator,required_aspect_denominator,minimum_width,minimum_height,is_synthetic)
          values(%s,'R14 Synthetic Round','QA ONLY','submission_open',
          now()-interval '7 hours',now()-interval '6 hours',now()-interval '5 hours',
          now()-interval '4 hours',now()-interval '3 hours',now()+interval '1 hour',
          2,0,3,true,false,'formal_vote_count_v1',16,9,1280,720,true)
          returning challenge_id""",(tag,))
        registered=one(c,"select public.community_register_dreamsnap_work_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (subject,creator,challenge,None,media,"QR R14 safe synthetic",True,True,"register-"+tag))
        work=uuid.UUID(registered["workId"])
        entry_data=one(c,"select public.community_dreamsnap_join_event_v1(%s,%s,%s)",
                       (subject,work,"join-"+tag))
        entry=uuid.UUID(entry_data["entryId"])
        assert denied(c,"select public.community_get_gallery_dreamsnap_public_v1(%s)",(work,))
        assert denied(c,"select public.community_get_public_media_storage_v2(%s)",(media,))
        assert denied(c,"select public.community_get_dreamsnap_results_public_v1(%s)",(challenge,))
        before=one(c,"select public.community_search_gallery_dreamsnaps_public_v1(null,30)")
        assert str(work) not in json.dumps(before),before
        # This challenge is intentionally synthetic and ONLY exercises judge privacy.
        # It never enters public results and has no votes/results/official rewards.
        c.execute("update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",(challenge,))
        pool=one(c,"select public.community_get_dreamsnap_judge_v1(%s,%s,12)",(viewer_subject,challenge))
        assert any(x.get("entryId")==str(entry) for x in pool["candidates"]),pool
        issued=one(c,"select public.community_get_dreamsnap_judge_media_storage_v1(%s,%s)",(viewer_subject,entry))
        assert issued["mediaId"]==str(media)
        c.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(subject,))
        session=uuid.uuid4()
        c.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,subject))
        epoch=one(c,"select extract(epoch from clock_timestamp())::bigint")
        privacy=one(c,"select public.community_tombstone_account(%s,%s,%s,'DELETE')",(subject,session,epoch))
        assert privacy["privacyState"]=="suppressed_cleanup_pending"
        after=one(c,"select public.community_get_dreamsnap_judge_v1(%s,%s,12)",(viewer_subject,challenge))
        assert all(x.get("entryId")!=str(entry) for x in after["candidates"])
        assert denied(c,"select public.community_get_dreamsnap_judge_media_storage_v1(%s,%s)",(viewer_subject,entry,))
        assert denied(c,"select public.community_get_public_media_storage_v2(%s)",(media,))
        assert denied(c,"select public.community_register_dreamsnap_work_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                      (subject,creator,challenge,None,media,"Blocked "+tag,True,True,"blocked-"+tag))
        assert one(c,"select entry_state from public.dreamsnap_entries where entry_id=%s",(entry,))=="entered"
        assert one(c,"select media_id from public.work_revision_media where work_revision_id=%s and role='dreamsnap' limit 1",(uuid.UUID(registered["revisionId"]),))==media
        assert str(work) not in json.dumps(one(c,"select public.community_search_gallery_dreamsnaps_public_v1(null,30)"))
        print(json.dumps({"marker":"QR_R14_DREAMSNAP_JUDGE_MEDIA_BEHAVIOR_SOURCE_PASS",
         "syntheticChallenge":True,"submissionRegistrationAndJoin":"ACTUAL_SOURCE_RPC",
         "activeEmbargoBeforeAndAfter":"DENIED","judgePoolBefore":1,"judgePoolAfter":0,
         "judgeMediaBefore":"ELIGIBLE_SOURCE_METADATA","judgeMediaAfter":"DENIED",
         "publicMediaV2BeforeAndAfter":"DENIED",
         "positiveSubmissionAfterSuppression":"DENIED",
         "archivedRealPublicResults":"NOT_EXECUTED",
         "voteAndOfficialResult":"NOT_CREATED","signedJwt":False,"fixtureRolledBack":True},sort_keys=True))
    finally:
        c.execute("rollback")
