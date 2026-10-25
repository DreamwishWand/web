#!/usr/bin/env python3
"""09 INT R16 independent actual Source124 two-backend Caller SHA stale/fresh/replay.

Owner original fixture setup is reused as synthetic data ONLY, not its tests.
Real community_gallery_graph_preflight_r15 / community_publish_gallery_pinned_r15
are invoked directly. No validation wrapper, no signed staging, no Storage bytes.
"""
import os,json,uuid,psycopg
assert os.getenv("DDVRE_R16_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL")
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
def execsql(c,q,args=()):return c.execute(q,args)
def seed_fixture():
    with psycopg.connect(dsn,autocommit=True,connect_timeout=4) as c:
        # R12 phase1 intentionally commits suppression of its own fixture Owner.
        # R14 MUST use a new independent synthetic account, never share seed data.
        owner,auth,creator=uuid.uuid4(),uuid.uuid4(),uuid.uuid4()
        with c.transaction():
            execsql(c,"insert into public.wand_accounts(account_id) values(%s)",(owner,))
            execsql(c,"""insert into public.auth_identities(
              account_id,provider,provider_subject,last_verified_at,identity_state
            ) values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(auth)))
            execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
            execsql(c,"""insert into public.creator_profiles(
              creator_profile_id,owner_account_id,handle,display_name
            ) values(%s,%s,%s,%s)""",(creator,owner,"isolated_r14_"+uuid.uuid4().hex[:12],"R14 Local Test Creator"))
        g={"owner":owner,"auth":auth,"creator":creator,
           "artifact":uuid.uuid4(),"presetWork":uuid.uuid4(),
           "oldGallery":uuid.uuid4(),"target":uuid.uuid4(),
           "presetRev":uuid.uuid4(),"presetWorkRev":uuid.uuid4(),
           "oldGalleryRev":uuid.uuid4(),"blob":uuid.uuid4(),"media":uuid.uuid4()}
        c.execute("begin")
        try:
            for entity,kind in [(g["artifact"],"preset_artifact"),
                 (g["presetWork"],"community_work"),(g["oldGallery"],"community_work"),
                 (g["target"],"community_work"),(g["media"],"media_asset")]:
                execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(entity,kind))
            for work,kind in [(g["presetWork"],"preset"),(g["oldGallery"],"gallery"),(g["target"],"gallery")]:
                execsql(c,"""insert into public.community_works(
                  work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
                  values(%s,%s,%s,%s,'public','clear')""",(work,owner,creator,kind))
            for work in [g["oldGallery"],g["target"]]:
                execsql(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
                execsql(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(work,))
            execsql(c,"""insert into public.preset_artifacts(
              preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,
              preset_type,associated_gallery_work_id) values(%s,%s,%s,%s,'scene',%s)""",
              (g["artifact"],owner,creator,g["presetWork"],g["oldGallery"]))
            execsql(c,"""insert into public.artifact_blobs(
              blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256
              ) values(%s,%s,%s,1,'application/json',256,%s)""",
              (g["blob"],owner,"ci-only/r14-"+str(g["blob"])+".json","e"*64))
            execsql(c,"""insert into public.preset_revisions(
              preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
              metadata,created_by_account_id) values(%s,%s,1,%s,'{}'::jsonb,%s)""",
              (g["presetRev"],g["artifact"],g["blob"],owner))
            execsql(c,"""insert into public.community_work_revisions(
              revision_id,work_id,revision_number,created_by_account_id)
              values(%s,%s,1,%s),(%s,%s,1,%s)""",
              (g["presetWorkRev"],g["presetWork"],owner,g["oldGalleryRev"],g["oldGallery"],owner))
            execsql(c,"insert into public.gallery_work_revisions(revision_id,title) values(%s,'Historical R14')",(g["oldGalleryRev"],))
            execsql(c,"""insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
              values(%s,%s)""",(g["presetWorkRev"],g["presetRev"]))
            execsql(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(g["oldGalleryRev"],g["presetRev"]))
            execsql(c,"""update public.community_works set lifecycle_state='published',
              current_published_revision_id=%s,published_at=now() where work_id=%s""",
              (g["presetWorkRev"],g["presetWork"]))
            execsql(c,"""insert into public.media_assets(
              media_id,owner_account_id,storage_key,mime_type,
              byte_size,width,height,checksum_sha256,processing_state,moderation_state
              ) values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
              (g["media"],owner,"ci-only/r14-"+str(g["media"])+".png","f"*64))
            c.execute("commit")
        except:
            c.execute("rollback")
            raise
        g["version"]=one(c,"select row_version from public.community_works where work_id=%s",(g["target"],))
        baseline=tuple(c.execute("""select
          (select count(*) from public.community_work_revisions where work_id=%s),
          (select count(*) from public.search_documents where work_id=%s),
          (select count(*) from public.outbox_events where aggregate_id=%s),
          (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like 'r14-source%%')""",
          (g["target"],g["target"],g["target"],owner)).fetchone())
        before=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(g["target"],[g["presetRev"]]))
        assert before["registry"]=="gallery-scene-scoped@r14",before
        assert len(before["artifactIds"])==1 and len(before["galleryWorkIds"])==2,before

    return g

def preflight(c,g,work):
    return one(c,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
               (g["auth"],work,[g["presetRev"]]))
def actual_publish(c,g,work,version,sha,key):
    return one(c,"""select public.community_publish_gallery_pinned_r15(
        %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
        (g["auth"],work,version,"09 INT R16 shared-scene actor pinned",
         "independent live caller digest evidence",
         [g["media"]],[g["presetRev"]],[],[],None,key,sha))
def count(c,g,key):
    w=g["target"]
    return tuple(c.execute("""select
       (select count(*) from public.community_work_revisions where work_id=%s),
       (select count(*) from public.search_documents where work_id=%s),
       (select count(*) from public.outbox_events where aggregate_id=%s),
       (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s),
       (select row_version from public.community_works where work_id=%s),
       (select current_published_revision_id from public.community_works where work_id=%s)""",
       (w,w,w,g["owner"],key,w,w)).fetchone())
def main():
    g=seed_fixture()
    with psycopg.connect(dsn,autocommit=True) as a, psycopg.connect(dsn,autocommit=True) as b:
        pid_a=one(a,"select pg_backend_pid()")
        pid_b=one(b,"select pg_backend_pid()")
        assert pid_a!=pid_b
        mig=one(a,"select count(*) from supabase_migrations.schema_migrations")
        assert mig==124,("OWNER_NEW_SOURCE_MIGRATION_COUNT",mig)
        old=preflight(b,g,g["target"])
        ahead=preflight(a,g,g["oldGallery"])
        assert old["schemaVersion"]==1 and old["registryVersion"]=="gallery-scene-scoped@r15"
        assert old["graphComplete"] is False
        initial=count(b,g,"r16-B-fresh")
        assert initial[:4]==(0,0,0,0),initial
        before_version=initial[4]
        a_ver=one(a,"select row_version from public.community_works where work_id=%s",(g["oldGallery"],))
        a_result=actual_publish(a,g,g["oldGallery"],a_ver,ahead["expectedGraphSha256"],"r16-A-first")
        assert a_result["revisionId"]
        fresh=preflight(b,g,g["target"])
        assert fresh["expectedGraphSha256"]!=old["expectedGraphSha256"],"HISTORIC_GRAPH_NO_CHANGE"
        assert one(b,"select row_version from public.community_works where work_id=%s",(g["target"],))==before_version
        # New attempt with the client's OLD pin must fail even though target B
        # rowVersion was unchanged; no partial Revision/Search/Outbox/idempotency.
        try:
            actual_publish(b,g,g["target"],before_version,old["expectedGraphSha256"],"r16-B-stale")
        except psycopg.Error as e:
            assert "R15_STALE_GRAPH_TERMINAL" in str(e),("WRONG_TERMINAL_STALE_CAUSE",str(e))
        else:
            raise AssertionError("R16_STALE_PRECOMMIT_GRAPH_WRITER_BYPASS")
        assert count(b,g,"r16-B-stale")==initial,"STALE_ATTEMPT_LEFT_PARTIAL_STATE"
        assert count(a,g,"r16-B-fresh")==initial
        # Explicitly *fresh* authorized Caller H1 must publish once.
        committed=actual_publish(b,g,g["target"],before_version,fresh["expectedGraphSha256"],"r16-B-fresh")
        assert committed["revisionId"]
        after_b=count(a,g,"r16-B-fresh")
        assert after_b[:4]==(1,1,1,1),after_b
        assert after_b[5]==uuid.UUID(committed["revisionId"])
        assert after_b[4]>before_version
        # Graph already changed by B's own published revision. Old EXACTLY
        # committed key + immutable pin must replay without creating a second write.
        later=preflight(a,g,g["target"])
        assert later["expectedGraphSha256"] != fresh["expectedGraphSha256"]
        replay=actual_publish(b,g,g["target"],before_version,fresh["expectedGraphSha256"],"r16-B-fresh")
        assert replay==committed,"COMPLETED_REPLAY_NOT_IDENTICAL"
        assert count(b,g,"r16-B-fresh")==after_b
        # Same key with a different current-graph pin must conflict, never
        # publish new or silently replace the Caller pin.
        try:
            actual_publish(a,g,g["target"],before_version,later["expectedGraphSha256"],"r16-B-fresh")
        except psycopg.Error as e:
            assert "R15_IDEMPOTENCY_REQUEST_CONFLICT" in str(e),str(e)
        else:
            raise AssertionError("COMMITTED_IDEMPOTENCY_MIXED_GRAPH_ACCEPTED")
        assert count(a,g,"r16-B-fresh")==after_b
        # Legacy unpinned Scene Writer is fail-closed on the exact same source.
        try:
            one(a,"""select public.community_publish_gallery_v4(
               %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
               (g["auth"],g["target"],before_version,"legacy","blocked",
                [g["media"]],[g["presetRev"]],[],[],None,"r16-legacy"))
        except psycopg.Error as e:
            assert "R15_PINNED_GRAPH_REQUIRED" in str(e),str(e)
        else:
            raise AssertionError("LEGACY_UNPINNED_SCENE_WRITER_ACCEPTED")
        print(json.dumps({
           "case":"R16_INDEPENDENT_SOURCE124_TWO_BACKEND_CALLER_GRAPH",
           "ownerPinned":"f5e32905e734323fb5f482ab756dcc378a54e24f",
           "twoIndependentPostgresBackends":True,
           "actualPinnedPreflightAndWriter":True,
           "sourceMigrations":124,
           "clientOldGraphChangedAfterACommit":True,
           "targetBVersionUnchangedBeforeOldCaller":True,
           "oldCallerTerminalStaleWithZeroBEffects":True,
           "freshCallerCommittedOnce":True,
           "completedReplayAfterLiveGraphChanged":True,
           "sameKeyChangedPinDenied":True,
           "legacyUnpinnedWriterBlocked":True,
           "fullGraphComplete":False,
           "signedJWTOrStorageCDNTested":False,
           "retirementAuthorized":False,
           "result":"PASS"
        },sort_keys=True))
if __name__=="__main__":
    main()
