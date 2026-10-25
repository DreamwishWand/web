#!/usr/bin/env python3
"""09 INT R16 new coverage: cross-Artifact roster growth and unsupported Facet.
Real Owner Source124 preflight/pinned RPC, disposable two-PG synthetic data.
Prior H0/H1 Gallery historical edge acceptance is NOT repeated here.
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

def state(c,work,key,owner):
    return tuple(c.execute("""select
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.search_documents where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s),
      (select row_version from public.community_works where work_id=%s),
      (select current_published_revision_id from public.community_works where work_id=%s)""",
      (work,work,work,owner,key,work,work)).fetchone())
def actual(c,g,work,revision,sha,key,version):
    return one(c,"""select public.community_publish_gallery_pinned_r15(
       %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
       (g["auth"],work,version,"R16 cross-Art roster fail closed","never persisted",
        [g["media"]],[revision],[],[],None,key,sha))
def add_artifact(c,g,target,kind):
    aid,pwid,blob,rid=(uuid.uuid4() for _ in range(4))
    token=uuid.uuid4().hex
    with c.transaction():
        for i,t in ((aid,"preset_artifact"),(pwid,"community_work")):
            execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(i,t))
        execsql(c,"""insert into public.community_works(
             work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
             values(%s,%s,%s,'preset','public','clear')""",
             (pwid,g["owner"],g["creator"]))
        execsql(c,"""insert into public.artifact_blobs(
             blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
             values(%s,%s,%s,1,'application/json',128,%s)""",
             (blob,g["owner"],"ci-only/r16-art-"+token+".json","a"*64))
        execsql(c,"""insert into public.preset_artifacts(
             preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,
             preset_type,associated_gallery_work_id) values(%s,%s,%s,%s,%s,%s)""",
             (aid,g["owner"],g["creator"],pwid,kind,target))
        execsql(c,"""insert into public.preset_revisions(
             preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
             metadata,created_by_account_id) values(%s,%s,1,%s,'{}'::jsonb,%s)""",
             (rid,aid,blob,g["owner"]))
    return {"artifact":aid,"work":pwid,"revision":rid}
def add_gallery(c,g):
    wid=uuid.uuid4()
    with c.transaction():
        execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(wid,))
        execsql(c,"""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'gallery','public','clear')""",(wid,g["owner"],g["creator"]))
        execsql(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(wid,))
        execsql(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(wid,))
    return wid
def main():
    g=seed_fixture()
    with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
        assert one(a,"select pg_backend_pid()") != one(b,"select pg_backend_pid()")
        assert one(a,"select count(*) from supabase_migrations.schema_migrations")==124
        old=one(b,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
                (g["auth"],g["target"],[g["presetRev"]]))
        assert len(old["expectedArtifactIds"])==1
        before=state(b,g["target"],"r16-roster-growth",g["owner"])
        assert before[:4]==(0,0,0,0)
        extra=add_artifact(a,g,g["target"],"scene")
        assert extra["artifact"]!=g["artifact"]
        assert state(b,g["target"],"r16-roster-growth",g["owner"])==before
        try:
            one(b,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
                (g["auth"],g["target"],[g["presetRev"]]))
        except psycopg.Error as e:
            assert "R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED" in str(e),str(e)
        else:raise AssertionError("MULTI_ARTIFACT_PREFLIGHT_BYPASS")
        try:
            actual(b,g,g["target"],g["presetRev"],old["expectedGraphSha256"],"r16-roster-growth",before[4])
        except psycopg.Error as e:
            assert "R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED" in str(e),str(e)
        else:raise AssertionError("MULTI_ARTIFACT_PINNED_WRITER_BYPASS")
        assert state(a,g["target"],"r16-roster-growth",g["owner"])==before
        print(json.dumps({"case":"R16_NEW_ASSOCIATED_SCENE_ARTIFACT_ROSTER_GROWTH",
            "separatePGConnections":True,"oneArtifactPreflightPrecededGrowth":True,
            "freshPreflightFailClosed":True,"originalPinnedWriterFailClosed":True,
            "noGalleryRevisionSearchOutboxIdempotencyChanges":True}))

    other=seed_fixture()
    with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
        assert one(a,"select pg_backend_pid()") != one(b,"select pg_backend_pid()")
        isolated=add_gallery(a,other)
        bad=add_artifact(a,other,isolated,"biome")
        before=state(b,isolated,"r16-unsupported-biome",other["owner"])
        assert before[:4]==(0,0,0,0)
        try:
            one(b,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
                (other["auth"],isolated,[bad["revision"]]))
        except psycopg.Error as e:
            assert "R15_UNENROLLED_PRESET_OR_CREATOR" in str(e),str(e)
        else:raise AssertionError("BIOME_FACET_PREFLIGHT_AUTHORIZED")
        try:
            actual(b,other,isolated,bad["revision"],"f"*64,"r16-unsupported-biome",before[4])
        except psycopg.Error as e:
            assert ("R14_PRESET_KIND_OR_OWNER_NOT_ENROLLED" in str(e) or
                    "R15_UNENROLLED_PRESET_OR_CREATOR" in str(e)),str(e)
        else:raise AssertionError("BIOME_FACET_WRITER_AUTHORIZED")
        assert state(b,isolated,"r16-unsupported-biome",other["owner"])==before
        print(json.dumps({"case":"R16_BIOME_PRESET_FACET_FAIL_CLOSED",
            "realSourcePreflightDenied":True,"realPinnedWriterDenied":True,
            "zeroGallerySideEffects":True}))
    print(json.dumps({"result":"09INT_R16_OWNER124_ROSTER_GROWTH_AND_UNSUPPORTED_FACET_SOURCE_PASS",
         "ownerSourceExact":"41fbbaf6aba8326fe9935955879218f8b9c35a91",
         "graphComplete":False,"sourceFullyEnrolled":False,"signedStaging":False}))
if __name__=="__main__":main()
