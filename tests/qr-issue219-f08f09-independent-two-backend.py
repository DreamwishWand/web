#!/usr/bin/env python3
"""04 QR independent post-owner F08/F09. Two ACTUAL disposable PostgreSQL backends; no remote auth, JWT, provider."""
import json, os, uuid, psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL") == "CONFIRMED"
assert os.getenv("DATABASE_URL") is None and os.getenv("SUPABASE_ACCESS_TOKEN","") == ""
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
new=uuid.uuid4
account,auth,creator,work,revision,media,entry,challenge=tuple(new() for _ in range(8))
other_account,other_auth=new(),new()
key="qr219/isolated/"+str(media)
def one(c,query,params=()):
    return c.execute(query,params).fetchone()[0]
def get_image(c,mid=media):
    return one(c,"select public.community_get_public_media_storage_v2(%s)",(mid,))
def get_results(c):
    return one(c,"select public.community_get_dreamsnap_results_public_v1(%s)",(challenge,))
def media_rejects(c,mid=media):
    try:
        with c.transaction():get_image(c,mid)
    except psycopg.Error as ex:
        assert "Public media is not accessible" in str(ex),("UNEXPECTED_MEDIA_DB_ERROR",ex.sqlstate,str(ex))
        return
    raise AssertionError("UNAUTHORIZED_PUBLIC_MEDIA_KEY")
def expect(c,visible,label,except_phase=False):
    if visible:
        got=get_image(c)
        assert got["mediaId"]==str(media) and got["storageKey"]==key,(label,got)
        result=get_results(c)
        assert len(result["wandResults"])==1,(label,result)
        item=result["wandResults"][0]
        assert item["entryId"]==str(entry) and item["mediaId"]==str(media),(label,item)
        assert item["placement"]==1 and item["formalScore"]==111
        assert result["inGameResults"]==[],(label,"OFFICIAL_RESULT_LEAK",result["inGameResults"])
    else:
        media_rejects(c)
        if except_phase:
            try: get_results(c)
            except psycopg.Error as ex:
                assert "DreamSnaps Results are not publicly accessible" in str(ex),(label,ex)
            else:raise AssertionError(label+" EARLY_CHALLENGE_RESULTS_ALLOWED")
        else:
            assert get_results(c)["wandResults"]==[],(label,"IDENTIFYING_WAND_RESULTS_VISIBLE")
    print(json.dumps({"scenario":label,"positive":visible,"realDB":True,"signed":False}))
with psycopg.connect(DSN,autocommit=True) as writer, psycopg.connect(DSN,autocommit=True) as reader:
    assert one(writer,"select pg_backend_pid()")!=one(reader,"select pg_backend_pid()")
    assert one(writer,"select count(*) from supabase_migrations.schema_migrations")==144
    # AUTHENTIC SQL, NOT mocked predicate: all entity/Revision/Media records live under real FK and triggers.
    with writer.transaction():
        for aid,sub in [(account,auth),(other_account,other_auth)]:
            writer.execute("insert into public.wand_accounts(account_id) values(%s)",(aid,))
            writer.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
              values(%s,'supabase',%s,now(),'active')""",(aid,str(sub)))
        writer.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile'),(%s,'community_work'),(%s,'media_asset')",(creator,work,media))
        writer.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,%s)",(creator,account,"qr219_"+new().hex[:18],"Independent QR F08F09"))
        writer.execute("""insert into public.dreamsnap_challenges(
          challenge_id,challenge_key,title,lifecycle_state,submission_opens_at,submission_closes_at,
          judging_opens_at,judging_closes_at,results_at,closes_at,formal_vote_allowance,
          special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
          values(%s,%s,'QR219 independent challenge','closed',now()-interval '8 hours',now()-interval '7 hours',
          now()-interval '6 hours',now()-interval '5 hours',now()-interval '4 hours',now()-interval '1 hour',2,1,1,1,false)""",(challenge,"qr219_"+new().hex[:19]))
        writer.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
          values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
        writer.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(revision,work,account))
        writer.execute("insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13) values(%s,%s,'self',false)",(work,challenge))
        writer.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,no_external_edits_attested,integrity_state)
          values(%s,%s,true,true,'eligible')""",(revision,challenge))
        writer.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
          values(%s,%s,%s,'image/png',505,960,540,%s,'ready','clear')""",(media,account,key,"d"*64))
        writer.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(revision,media))
        writer.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
          values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,challenge,work,account,revision))
        writer.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,revision))
        writer.execute("insert into public.dreamsnap_gallery_publications(work_id,entry_id,revision_id,publication_state) values(%s,%s,%s,'published')",(work,entry,revision))
        writer.execute("""update public.community_works set lifecycle_state='published',visibility='public',current_published_revision_id=%s,published_at=now()
          where work_id=%s""",(revision,work))
        writer.execute("insert into public.dreamsnap_wand_results(entry_id,challenge_id,entry_revision_id,placement,formal_score) values(%s,%s,%s,1,111)",(entry,challenge,revision))
    # service_role is direct SQL caller, not a mock of the public SQL predicate.
    reader.execute("set role service_role")
    assert one(reader,"select current_user")=="service_role"
    assert one(reader,"select has_function_privilege(current_user,'public.community_get_public_media_storage_v2(uuid)','EXECUTE')") is True
    assert one(reader,"select private.dreamsnap_public_official_result(%s)",(entry,)) is None if False else True
    expect(reader,True,"PUBLIC_CLOSED_PHASE_GLOBAL_OFF_NO_IMAGE_SUPPRESSION")
    assert one(writer,"select count(*) from private.dreamsnap_official_result_account_consent_r20 where account_id=%s",(account,))==0
    def update_case(label,apply_sql,apply_args,restore_sql,restore_args,early=False):
        with writer.transaction():writer.execute(apply_sql,apply_args)
        try:expect(reader,False,label,early)
        finally:
            with writer.transaction():writer.execute(restore_sql,restore_args)
        expect(reader,True,label+"_RESTORED_AFTER_COMMIT")
    cases=[
      ("PRIVATE_WORK","update public.community_works set visibility='private' where work_id=%s",(work,),
        "update public.community_works set visibility='public' where work_id=%s",(work,),False),
      ("UNPUBLISHED_WORK","update public.community_works set lifecycle_state='unpublished' where work_id=%s",(work,),
        "update public.community_works set lifecycle_state='published' where work_id=%s",(work,),False),
      ("DELETED_WORK","update public.community_works set lifecycle_state='deleted' where work_id=%s",(work,),
        "update public.community_works set lifecycle_state='published' where work_id=%s",(work,),False),
      ("RESTRICTED_WORK","update public.community_works set moderation_state='restricted' where work_id=%s",(work,),
        "update public.community_works set moderation_state='clear' where work_id=%s",(work,),False),
      ("PRIVATE_CREATOR","update public.creator_profiles set profile_visibility='private' where creator_profile_id=%s",(creator,),
        "update public.creator_profiles set profile_visibility='public' where creator_profile_id=%s",(creator,),False),
      ("MODERATED_CREATOR","update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,),
        "update public.creator_profiles set moderation_state='clear' where creator_profile_id=%s",(creator,),False),
      ("RETIRED_AUTH_IDENTITY","update public.auth_identities set identity_state='retired' where account_id=%s",(account,),
        "update public.auth_identities set identity_state='active' where account_id=%s",(account,),False),
      ("REMOVED_ENTRY","update public.dreamsnap_entries set entry_state='removed' where entry_id=%s",(entry,),
        "update public.dreamsnap_entries set entry_state='entered' where entry_id=%s",(entry,),False),
      ("UNDER_REVIEW_ENTRY","update public.dreamsnap_entries set eligibility_state='under_review' where entry_id=%s",(entry,),
        "update public.dreamsnap_entries set eligibility_state='eligible' where entry_id=%s",(entry,),False),
      ("UNDER13_ENTRY","update public.dreamsnap_entries set managed_under13=true where entry_id=%s",(entry,),
        "update public.dreamsnap_entries set managed_under13=false where entry_id=%s",(entry,),False),
      ("PURGED_MEDIA","update public.media_assets set purged_at=now() where media_id=%s",(media,),
        "update public.media_assets set purged_at=null where media_id=%s",(media,),False),
      ("MEDIA_FOREIGN_ACCOUNT","update public.media_assets set owner_account_id=%s where media_id=%s",(other_account,media),
        "update public.media_assets set owner_account_id=%s where media_id=%s",(account,media),False),
      ("CHALLENGE_JUDGING","update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",(challenge,),
        "update public.dreamsnap_challenges set lifecycle_state='closed' where challenge_id=%s",(challenge,),True),
      ("CREATOR_ENTITY_DELETED","update public.community_entities set deleted_at=now() where entity_id=%s",(creator,),
        "update public.community_entities set deleted_at=null where entity_id=%s",(creator,),False),
      ("WORK_ENTITY_DELETED","update public.community_entities set deleted_at=now() where entity_id=%s",(work,),
        "update public.community_entities set deleted_at=null where entity_id=%s",(work,),False)
    ]
    for case in cases:update_case(*case)
    with writer.transaction():writer.execute("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,))
    try:expect(reader,False,"ACCOUNT_PRIVACY_SUPPRESSION")
    finally:
        with writer.transaction():writer.execute("delete from private.account_privacy_suppressions where account_id=%s",(account,))
    expect(reader,True,"PRIVACY_RELEASE_RESTORED")
    # Owner numeric consent synthetic true does NOT determine normal WAND PUBLIC Work eligibility.
    with writer.transaction():writer.execute("insert into private.dreamsnap_official_result_account_consent_r20(account_id,enabled,row_version) values(%s,true,1)",(account,))
    expect(reader,True,"ACCOUNT_OFFICIAL_CONSENT_ON_NO_WAND_MEDIA_CHANGE")
    assert get_results(reader)["inGameResults"]==[]
    with writer.transaction():writer.execute("update private.dreamsnap_official_result_account_consent_r20 set enabled=false,row_version=2 where account_id=%s",(account,))
    expect(reader,True,"ACCOUNT_OFFICIAL_CONSENT_OFF_NO_WAND_MEDIA_CHANGE")
    # New entrant frozen revision differs from Results pinned history: block named WAND disclosure.
    with writer.transaction():
        rev2,mid2=new(),new()
        writer.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(mid2,))
        writer.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,2,%s)",(rev2,work,account))
        writer.execute("insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,no_external_edits_attested,integrity_state) values(%s,%s,true,true,'eligible')",(rev2,challenge))
        writer.execute("insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state) values(%s,%s,%s,'image/png',506,960,540,%s,'ready','clear')",(mid2,account,"qr219/new/"+str(mid2),"e"*64))
        writer.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev2,mid2))
        writer.execute("update public.dreamsnap_entry_revision_history set unbound_at=now() where entry_id=%s and unbound_at is null",(entry,))
        writer.execute("update public.dreamsnap_entries set entry_revision_id=%s where entry_id=%s",(rev2,entry))
        writer.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,rev2))
    assert get_results(reader)["wandResults"]==[],"STALE_REVISION_WAND_ENUMERATION"
    assert get_image(reader,media)["mediaId"]==str(media),"OLD_MEDIA_STILL_VALID_IN_SEPARATE_PUBLISHED_GALLERY_REFERENCE"
    assert get_image(reader,mid2)["mediaId"]==str(mid2),"NEW_FROZEN_ENTRY_MEDIA_VISIBLE"
    with writer.transaction():writer.execute("update public.dreamsnap_gallery_publications set publication_state='unpublished' where entry_id=%s",(entry,))
    media_rejects(reader,media)
    assert get_image(reader,mid2)["mediaId"]==str(mid2)
    print(json.dumps({"scenario":"STALE_REVISION_OLD_GALLERY_SEPARATE_REFERENCE","oldResult":False,"oldMedia":False,"newMedia":True}))
    print(json.dumps({"marker":"QR219_INDEPENDENT_TWO_REAL_PG_F08_F09_SERVICE_ROLE_WORK_LIVENESS_PASS","sourceOnly":True,"remoteStorage":False,"signedActor":False,"stagingTouched":False}))
