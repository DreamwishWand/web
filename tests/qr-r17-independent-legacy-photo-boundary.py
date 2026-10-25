import os
import uuid
import json
import psycopg

assert os.environ.get("DDVRE_QR_R17_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.environ.get("DATABASE_URL")
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u = uuid.uuid4
def one(c, sql, values=()):
    return c.execute(sql, values).fetchone()[0]
def expect_denial(c, invoke, allowed):
    try:
        invoke()
    except psycopg.Error as err:
        first = str(err).splitlines()[0]
        assert any(marker in first for marker in allowed), (allowed, err.sqlstate, first)
        return err.sqlstate
    raise AssertionError("R17_UNSAFE_WRITER_ACCEPTED")
def snapshot(c, work, owner, key):
    return tuple(c.execute("""select
      (select comments_enabled from public.gallery_work_settings where work_id=%s),
      (select facets from public.search_documents where work_id=%s),
      (select count(*) from public.audit_events where target_entity_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like %s),
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select current_published_revision_id from public.community_works where work_id=%s),
      (select row_version from public.community_works where work_id=%s)
    """, (work,work,work,owner,key+"%",work,work,work,work)).fetchone())
with psycopg.connect(DSN, autocommit=True) as seed:
    assert one(seed,"select count(*) from supabase_migrations.schema_migrations")==130
    owner,auth,creator,foreign_owner,foreign_auth,foreign_creator=(u() for _ in range(6))
    token=u().hex
    galleries={}
    with seed.transaction():
        for account,subject,prof in [(owner,auth,creator),(foreign_owner,foreign_auth,foreign_creator)]:
            seed.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
            seed.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
                 values(%s,'supabase',%s,clock_timestamp(),'active')""",(account,str(subject)))
            seed.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(prof,))
            seed.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
                values(%s,%s,%s,'QR R17 synthetic')""",(prof,account,"qr17_"+u().hex[:14]))
        for label in ["direct","historical","both","clean","restricted"]:
            work,rev=u(),u()
            seed.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
            seed.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
                values(%s,%s,%s,'gallery','public','clear')""",(work,owner,creator))
            seed.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
            seed.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(work,))
            seed.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                values(%s,%s,1,%s)""",(rev,work,owner))
            seed.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'QA synthetic')",(rev,))
            seed.execute("""update public.community_works
                set lifecycle_state='published',current_published_revision_id=%s,published_at=now()
                where work_id=%s""",(rev,work))
            seed.execute("""insert into public.search_documents(
                entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at)
                values(%s,%s,'gallery',%s,'QA synthetic','',array[]::text[],
                '{"galleryKind":"outdoor","commentsEnabled":true}'::jsonb,now(),now())""",(work,work,creator))
            galleries[label]=(work,rev)
        pre_work_history,pre_work_direct,pre_work_both,scene_direct,scene_history,scene_both,blob,preset_revision,preset_work_rev=(u() for _ in range(9))
        for entity,kind in [(pre_work_history,"community_work"),(pre_work_direct,"community_work"),(pre_work_both,"community_work"),(scene_direct,"preset_artifact"),
                            (scene_history,"preset_artifact"),(scene_both,"preset_artifact")]:
            seed.execute("insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(entity,kind))
        for preset_work in [pre_work_history,pre_work_direct,pre_work_both]:
            seed.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
                values(%s,%s,%s,'preset','public','clear')""",(preset_work,owner,creator))
        seed.execute("""insert into public.artifact_blobs(
            blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
            values(%s,%s,%s,1,'application/json',128,%s)""",(blob,owner,"qr17/"+token+".json","b"*64))
        for artifact,direct,work_ref in [(scene_direct,galleries["direct"][0],pre_work_direct),(scene_history,None,pre_work_history),(scene_both,galleries["both"][0],pre_work_both)]:
            seed.execute("""insert into public.preset_artifacts(
                preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type,associated_gallery_work_id)
                values(%s,%s,%s,%s,'scene',%s)""",(artifact,owner,creator,work_ref,direct))
        seed.execute("""insert into public.preset_revisions(
            preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
            values(%s,%s,1,%s,'{}'::jsonb,%s)""",(preset_revision,scene_history,blob,owner))
        seed.execute("""insert into public.community_work_revisions(
            revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)""",
            (preset_work_rev,pre_work_history,owner))
        seed.execute("""insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
            values(%s,%s)""",(preset_work_rev,preset_revision))
        for label in ["historical","both"]:
            seed.execute("""insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
                values(%s,%s)""",(galleries[label][1],preset_revision))
        seed.execute("""update public.community_works set lifecycle_state='published',
            current_published_revision_id=%s,published_at=now() where work_id=%s""",
            (preset_work_rev,pre_work_history))
    for name in ["direct","historical","both"]:
        w,r=galleries[name]
        d=one(seed,"select count(*) from public.preset_artifacts where associated_gallery_work_id=%s",(w,))
        h=one(seed,"""select count(*) from public.gallery_revision_presets gp
            join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
            where wr.work_id=%s""",(w,))
        assert (d>0,h>0)==({"direct":(True,False),"historical":(False,True),"both":(True,True)}[name]),(name,d,h)
    versions={name:one(seed,"select row_version from public.community_works where work_id=%s",(w,))
              for name,(w,_) in galleries.items()}

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select pg_backend_pid()") != one(b,"select pg_backend_pid()")
    for name in ["direct","historical","both"]:
        w,revision=galleries[name]
        before=snapshot(b,w,owner,"qr17-"+name)
        for legacy in ["v1","v2"]:
            expect_denial(b,lambda:one(b,"select public.community_set_gallery_comments_enabled_"+legacy+"(%s,%s,false)",
                (auth,w)),["R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED"])
            assert snapshot(b,w,owner,"qr17-"+name)==before,(name,legacy)
        expect_denial(b,lambda:one(b,"""select public.community_set_gallery_comments_enabled_atomic_r16(
            %s,%s,%s,%s,false,%s)""",(auth,w,versions[name],revision,"qr17-"+name+"-atomic")),
            ["R16_DEPENDENT_GALLERY_METADATA_NOT_ENROLLED"])
        assert snapshot(b,w,owner,"qr17-"+name)==before,name
        print(json.dumps({"case":"QR_R17_COMMENTS_"+name.upper()+"_ALL_ROUTES_DENIED",
            "oldV1":True,"oldV2":True,"newAtomic":True,"zeroPartialState":True}))
    clean,clean_rev=galleries["clean"]
    clean_before=snapshot(b,clean,owner,"qr17-clean")
    expect_denial(b,lambda:one(b,"""select public.community_set_gallery_comments_enabled_atomic_r16(
        %s,%s,%s,%s,false,%s)""",(auth,clean,versions["clean"]-1,clean_rev,"qr17-clean-version")),
        ["R16_STALE_WORK_TERMINAL"])
    expect_denial(b,lambda:one(b,"""select public.community_set_gallery_comments_enabled_atomic_r16(
        %s,%s,%s,%s,false,%s)""",(auth,clean,versions["clean"],u(),"qr17-clean-revision")),
        ["R16_STALE_WORK_TERMINAL"])
    assert snapshot(b,clean,owner,"qr17-clean")==clean_before
    restricted,restricted_rev=galleries["restricted"]
    b.execute("update public.community_works set moderation_state='restricted' where work_id=%s",(restricted,))
    restricted_before=snapshot(b,restricted,owner,"qr17-restricted")
    expect_denial(b,lambda:one(b,"""select public.community_set_gallery_comments_enabled_atomic_r16(
        %s,%s,%s,%s,false,%s)""",(auth,restricted,
        one(b,"select row_version from public.community_works where work_id=%s",(restricted,)),
        restricted_rev,"qr17-restricted-atomic")),["R16_WORK_NOT_PUBLIC_CLEAR"])
    assert snapshot(b,restricted,owner,"qr17-restricted")==restricted_before
    print(json.dumps({"case":"QR_R17_COMMENTS_STALE_AND_MODERATED","zeroPartialState":True}))

with psycopg.connect(DSN,autocommit=True) as c:
    ds_work,challenge,ds_revision,ds_entry=(u() for _ in range(4))
    with c.transaction():
        c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(ds_work,))
        c.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
            values(%s,%s,%s,'dreamsnap','public','clear')""",(ds_work,owner,creator))
        c.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
            submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
            formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,is_synthetic)
            values(%s,%s,'QR R17 normal','results',now()-interval '7 days',now()-interval '6 days',
            now()-interval '5 days',now()-interval '4 days',now()-interval '3 days',now()+interval '1 day',
            5,0,1,true)""",(challenge,"qr17-"+u().hex[:14]))
        c.execute("""insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13)
            values(%s,%s,'self',false)""",(ds_work,challenge))
        c.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
            values(%s,%s,1,%s)""",(ds_revision,ds_work,owner))
        c.execute("""insert into public.dreamsnap_work_revisions(
            revision_id,challenge_id,game_screenshot_attested,no_external_edits_attested,integrity_state)
            values(%s,%s,true,true,'eligible')""",(ds_revision,challenge))
        c.execute("""insert into public.dreamsnap_entries(
            entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,origin_kind)
            values(%s,%s,%s,%s,false,%s,'synthetic')""",(ds_entry,challenge,ds_work,owner,ds_revision))
        c.execute("""insert into public.dreamsnap_gallery_publications(
            work_id,entry_id,revision_id,publication_state,comments_enabled)
            values(%s,%s,%s,'published',true)""",(ds_work,ds_entry,ds_revision))
        c.execute("""update public.community_works set lifecycle_state='published',
            current_published_revision_id=%s,published_at=now() where work_id=%s""",(ds_revision,ds_work))
    for value in [False,True]:
        result=one(c,"select public.community_set_gallery_comments_enabled_v2(%s,%s,%s)",(auth,ds_work,value))
        assert result["commentsEnabled"] is value
        assert one(c,"select comments_enabled from public.dreamsnap_gallery_publications where work_id=%s",
                   (ds_work,)) is value
    print(json.dumps({"case":"QR_R17_DREAMSNAPS_NORMAL_V2_ENABLED_DISABLED",
        "under13InheritedOwnerSource":True,"normalBranchExecuted":True}))

with psycopg.connect(DSN,autocommit=True) as setup:
    subj,media,foreign_media=(u() for _ in range(3))
    with setup.transaction():
        for m,account in [(media,owner),(foreign_media,foreign_owner)]:
            setup.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(m,))
            setup.execute("""insert into public.media_assets(
                media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
                checksum_sha256,processing_state,moderation_state)
                values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
                (m,account,"qr17/local-only/"+str(m)+".png","c"*64))
        setup.execute("""insert into public.gallery_verified_subjects(
            subject_id,gallery_kind,subject_type,canonical_target_id,platform,game_version,
            build_id,profile_schema,evidence_ref,verification_state)
            values(%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',
            624,'synthetic-qr17-source-only','verified')""",(subj,"qr17-"+token))
    def photo(c,actor,who,work,version,chosen_media,chosen_subject,key):
        return one(c,"""select public.community_publish_gallery_photo_v1(
          %s,%s,%s,%s,'outdoor',%s,'QR R17 isolated Photo','Synthetic local media metadata',
          %s::uuid[],%s,true,%s)""",(actor,who,work,version,chosen_subject,[chosen_media],chosen_media,key))
    created=photo(setup,auth,creator,None,None,media,subj,"qr17-photo-create-"+token)
    photo_work=uuid.UUID(created["workId"])
    photo_ver=one(setup,"select row_version from public.community_works where work_id=%s",(photo_work,))
    photo_before=snapshot(setup,photo_work,owner,"qr17-photo-negative")
    for label,args,fragments in [
        ("nonowner",(foreign_auth,foreign_creator,photo_work,photo_ver,media,subj,"qr17-photo-negative-other"),["R17_PHOTO_WORK_OWNER_INVALID"]),
        ("wrongcreator",(auth,foreign_creator,photo_work,photo_ver,media,subj,"qr17-photo-negative-creator"),["R17_PHOTO_WORK_OWNER_INVALID"]),
        ("othermedia",(auth,creator,photo_work,photo_ver,foreign_media,subj,"qr17-photo-negative-media"),["GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED"]),
        ("unknownsubject",(auth,creator,photo_work,photo_ver,media,u(),"qr17-photo-negative-subject"),["GALLERY_VERIFIED_SUBJECT_REQUIRED"]),
        ("staleversion",(auth,creator,photo_work,photo_ver-1,media,subj,"qr17-photo-negative-stale"),["GALLERY_ROW_VERSION_CONFLICT"])
    ]:
        expect_denial(setup,lambda args=args:photo(setup,*args),fragments)
        assert snapshot(setup,photo_work,owner,"qr17-photo-negative")==photo_before,label
    print(json.dumps({"case":"QR_R17_PHOTO_OWNER_CREATOR_MEDIA_SUBJECT_STALE_DENIAL","zeroPartialState":True}))
with psycopg.connect(DSN,autocommit=True) as holder,psycopg.connect(DSN,autocommit=True) as caller:
    assert one(holder,"select pg_backend_pid()")!=one(caller,"select pg_backend_pid()")
    before=snapshot(caller,photo_work,owner,"qr17-photo-held")
    holder.execute("begin")
    one(holder,"select account_id from public.wand_accounts where account_id=%s for update",(owner,))
    caller.execute("begin")
    caller.execute("set local lock_timeout='250ms'")
    try:
        photo(caller,auth,creator,photo_work,photo_ver,media,subj,"qr17-photo-held")
        raise AssertionError("PHOTO_ACCOUNT_LOCK_NOT_ENROLLED")
    except psycopg.Error as e:
        assert e.sqlstate=="55P03",(e.sqlstate,str(e))
    finally:
        caller.execute("rollback")
        holder.execute("rollback")
    assert snapshot(caller,photo_work,owner,"qr17-photo-held")==before
    print(json.dumps({"case":"QR_R17_PHOTO_HELD_ACCOUNT_55P03_NO_PARTIAL_STATE","twoRealPgSessions":True}))

with psycopg.connect(DSN,autocommit=True) as c:
    c.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(auth,))
    session=u()
    c.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,auth))
    epoch=one(c,"select extract(epoch from clock_timestamp())::bigint")
    resp=one(c,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",
             (auth,session,epoch))
    assert resp["privacyState"]=="suppressed_cleanup_pending"
    before=snapshot(c,photo_work,owner,"qr17-suppressed")
    expect_denial(c,lambda:photo(c,auth,creator,photo_work,photo_ver,media,subj,
                        "qr17-suppressed-photo"),["R17_PHOTO_ACTOR_INVALID","ACCOUNT_PRIVACY_SUPPRESSED"])
    clean,clean_rev=galleries["clean"]
    expect_denial(c,lambda:one(c,"""select public.community_set_gallery_comments_enabled_atomic_r16(
        %s,%s,%s,%s,false,%s)""",(auth,clean,versions["clean"],clean_rev,
        "qr17-suppressed-comments")),["R16_ACTOR_NOT_ACTIVE","ACCOUNT_PRIVACY_SUPPRESSED"])
    assert snapshot(c,photo_work,owner,"qr17-suppressed")==before
    print(json.dumps({"case":"QR_R17_PRIVACY_SUPPRESSION_DENIES_NEW_PHOTO_AND_ATOMIC_COMMENTS",
                      "fullErasureAccepted":False}))
print(json.dumps({"result":"QR_R17_INDEPENDENT_POSTFIX_SOURCE_BOUNDARY_PASS",
                  "source":"local-ephemeral-full-130-migrations",
                  "normalSignedJwt":False,"realStorageBytes":False,
                  "releaseAuthority":False,"globalGraphComplete":False}))
