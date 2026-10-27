#!/usr/bin/env python3
"""04 QR independent Source145 legacy public Reader: REAL disposable two-PG.
Separate QA Work/media/Account fixture and actual service_role SQL; no actor, CDN, staging.
PRE144 baseline must reproduce only SEARCH contradiction; native Detail may remain non-positive.
POST145 must admit positive Search AND Detail and suppress both on held identities/accounts.
"""
import os,json,uuid,psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
phase=os.getenv("QR225_SCHEMA")
assert phase in ("PRE144","POST145"),phase
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
new=uuid.uuid4
account,auth,creator,work,revision,media,entry,challenge=tuple(new() for _ in range(8))
other_account,other_auth=new(),new()
key="qr225/isolated/"+str(media)
def one(c,query,params=()):
    return c.execute(query,params).fetchone()[0]
def call(c,query,params=()):
    try:
        with c.transaction():
            return one(c,query,params)
    except psycopg.Error as e:
        return {"error":str(e).split("\n")[0],"sqlstate":e.sqlstate}
def has_work(obj):
    return isinstance(obj,dict) and obj.get("workId")==str(work)
def snapshot(reader,writer,label):
    search=call(reader,"select public.community_search_gallery_dreamsnaps_public_v1(null,30)")
    detail=call(reader,"select public.community_get_gallery_dreamsnap_public_v1(%s)",(work,))
    v2=call(reader,"select public.community_get_public_media_storage_v2(%s)",(media,))
    results=call(reader,"select public.community_get_dreamsnap_results_public_v1(%s)",(challenge,))
    off=one(writer,"select private.dreamsnap_public_official_result(%s)",(entry,))
    guard=one(writer,"select private.dreamsnap_public_work_accessible_r20(%s)",(work,))
    result=dict(case=label,phase=phase,guard=bool(guard),
      search=bool(isinstance(search,list) and any(has_work(z) for z in search)),
      detail=bool(has_work(detail)),
      media=bool(isinstance(v2,dict) and v2.get("mediaId")==str(media)),
      results=bool(isinstance(results,dict) and any(z.get("entryId")==str(entry) for z in results.get("wandResults",[]))),
      officialNumericOff=off is None,backendReader=one(reader,"select pg_backend_pid()"),
      backendWriter=one(writer,"select pg_backend_pid()"))
    print(json.dumps(result),flush=True)
    assert result["backendReader"]!=result["backendWriter"]
    assert result["officialNumericOff"],"SOURCE143_NUMERIC_OFF_REGRESSION"
    return result
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
        writer.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,%s)",(creator,account,"qr225_"+new().hex[:18],"Independent QR F08F09"))
        writer.execute("""insert into public.dreamsnap_challenges(
          challenge_id,challenge_key,title,lifecycle_state,submission_opens_at,submission_closes_at,
          judging_opens_at,judging_closes_at,results_at,closes_at,formal_vote_allowance,
          special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
          values(%s,%s,'QR225 independent challenge','results',now()-interval '8 hours',now()-interval '7 hours',
          now()-interval '6 hours',now()-interval '5 hours',now()-interval '4 hours',now()+interval '1 hour',2,1,1,1,false)""",(challenge,"qr225_"+new().hex[:19]))
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

    reader.execute("set role service_role")
    assert one(reader,"select current_user")=="service_role"
    migration_count=one(writer,"select count(*) from supabase_migrations.schema_migrations")
    assert migration_count==(144 if phase=="PRE144" else 145),("VERSION_MISMATCH",migration_count)
    assert one(writer,"select count(*) from private.dreamsnap_official_result_account_consent_r20 where account_id=%s",(account,))==0
    clean=snapshot(reader,writer,"PUBLIC_OFFICIAL_NUMERIC_OFF")
    assert clean["guard"] and clean["search"] and clean["media"] and clean["results"],clean
    if phase=="POST145":assert clean["detail"],"SOURCE145_DETAIL_POSITIVE_MISSING"
    else: print(json.dumps({"case":"PRE144_DETAIL","classification":"NOT_REPRODUCED" if not clean["detail"] else "POSITIVE_FIXTURE"}),flush=True)
    cases=[
      ("ACCOUNT_RESTRICTED","update public.wand_accounts set status='restricted' where account_id=%s",(account,),
         "update public.wand_accounts set status='active' where account_id=%s",(account,)),
      ("IDENTITY_RETIRED","update public.auth_identities set identity_state='retired' where account_id=%s",(account,),
         "update public.auth_identities set identity_state='active',retired_at=null where account_id=%s",(account,)),
      ("PRIVACY_SUPPRESSED","insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,),
         "delete from private.account_privacy_suppressions where account_id=%s",(account,)),
      ("CREATOR_ENTITY_TOMBSTONE","update public.community_entities set deleted_at=now() where entity_id=%s",(creator,),
         "update public.community_entities set deleted_at=null where entity_id=%s",(creator,))
    ]
    old_exposure=[]
    for name,modify,params,restore,rparams in cases:
        with writer.transaction(): writer.execute(modify,params)
        try:
            observed=snapshot(reader,writer,name)
            assert not observed["guard"] and not observed["media"] and not observed["results"],("SOURCE144_GUARD_REGRESSION",observed)
            if phase=="POST145":
                assert not observed["search"] and not observed["detail"],("SOURCE145_LEGACY_READER_STILL_DISCLOSES",observed)
            else:
                if observed["search"]:old_exposure.append(name)
                if name=="PRIVACY_SUPPRESSED":assert not observed["search"],"PRIVACY_SOURCE144_EXPECTED_DENY"
                if name=="IDENTITY_RETIRED":assert observed["search"],"ORIGINAL_CEX_SEARCH_NOT_REPRODUCED"
        finally:
            with writer.transaction():writer.execute(restore,rparams)
        restored=snapshot(reader,writer,name+"_RESTORED")
        assert restored["guard"] and restored["search"] and restored["media"] and restored["results"],restored
        if phase=="POST145":assert restored["detail"],("POSITIVE_RESTORE_REGRESSION",restored)
    if phase=="PRE144":
        assert "IDENTITY_RETIRED" in old_exposure,old_exposure
        print(json.dumps({"marker":"QR225_INDEPENDENT_PRE144_SEARCH_CEX_CONFIRMED_LOCAL_PG","exposed":old_exposure,
          "detailDisclosure":"NOT_REPRODUCED" if not clean["detail"] else "UNRESOLVED"}),flush=True)
    else:
        for name,change,args,restore,rargs in [
          ("CREATOR_PRIVATE","update public.creator_profiles set profile_visibility='private' where creator_profile_id=%s",(creator,),
              "update public.creator_profiles set profile_visibility='public' where creator_profile_id=%s",(creator,)),
          ("MEDIA_MODERATION","update public.media_assets set moderation_state='restricted' where media_id=%s",(media,),
              "update public.media_assets set moderation_state='clear' where media_id=%s",(media,)),
          ("ENTRY_INELIGIBLE","update public.dreamsnap_entries set eligibility_state='ineligible' where entry_id=%s",(entry,),
              "update public.dreamsnap_entries set eligibility_state='eligible' where entry_id=%s",(entry,)),
          ("GALLERY_UNPUBLISHED","update public.dreamsnap_gallery_publications set publication_state='unpublished' where work_id=%s",(work,),
              "update public.dreamsnap_gallery_publications set publication_state='published' where work_id=%s",(work,)),
          ("CHALLENGE_NOT_RESULTS","update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",(challenge,),
              "update public.dreamsnap_challenges set lifecycle_state='results' where challenge_id=%s",(challenge,)),
        ]:
            with writer.transaction():writer.execute(change,args)
            try:
                obs=snapshot(reader,writer,name)
                assert not obs["search"] and not obs["detail"],("UNAUTHORIZED_PUBLIC_METADATA",obs)
            finally:
                with writer.transaction():writer.execute(restore,rargs)
            assert snapshot(reader,writer,name+"_RESTORED")["detail"]
        assert clean["detail"] and clean["search"]
        print(json.dumps({"marker":"QR225_INDEPENDENT_SOURCE145_POSTFIX_TWO_PG_PASS",
          "source141IncidentGuard":"INHERITED_UNCHANGED_SOURCE_ONLY",
          "realSignedActor":False,"stage116":False,"CDN":False,"Provider":False}),flush=True)
