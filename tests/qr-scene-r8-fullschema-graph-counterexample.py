# 04 QR R11 refreshed acceptance adapted from independent 09 INT exact source 9e1e714fa495aadfdf5b8190866150aa34d34ced.
# RUN AGAINST 03 COMM PR134 LATEST d2e4576830bb7e37e4f7981c5777912e7b3be85c; local PG only.
#!/usr/bin/env python3
"""09 INT R8: actual 03 COMM inert paired Scene RPC concurrency on an isolated FULL
113-migration local Supabase database. Strictly NO remote/staging/production DSN.
No HTTP/Storage bytes, signed role, native save-writing or positive Gallery retirement.
"""
import json, os, sys, time, uuid, threading, hashlib
from urllib.parse import urlsplit
import psycopg

def one(c, q, args=()):
    with c.cursor() as cur:
        cur.execute(q,args)
        return cur.fetchone()

def execute(c,q,args=()):
    with c.cursor() as cur:
        cur.execute(q,args)
        return cur.rowcount

def local_dsn():
    assert os.getenv("DDVRE_R8_ISOLATED_LOCAL")=="CONFIRMED", "LOCAL_ONLY_CONFIRMATION_REQUIRED"
    url=os.getenv("DDVRE_R8_POSTGRES_DSN","")
    p=urlsplit(url)
    assert p.hostname in ("127.0.0.1","localhost") and p.port==54322 and p.path=="/postgres", "REMOTE_DSN_REJECTED"
    assert p.username=="postgres", "DB_OWNER_LOCAL_ONLY"
    return url

def historical_edge_hash(c,g):
    """Exact R9 local fixture historical edge digest; NOT a globally complete graph."""
    edges=one(c,"""select coalesce(array_agg(e.edge order by e.edge),array[]::text[])
      from (select distinct gp.gallery_revision_id::text||'/'||
        gp.preset_revision_id::text as edge
      from public.gallery_revision_presets gp
      join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
      where pr.preset_artifact_id=%s) e""",(g["artifact"],))[0]
    raw="scene-historical-edges-v1|"+str(g["artifact"])+"|"+str(g["galleryWork"])+"|"+"|".join(edges)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def fixture(c):
    ownerrow=one(c,"""select ai.provider_subject::uuid,c.owner_account_id,c.creator_profile_id
      from public.creator_profiles c
      join public.auth_identities ai on ai.account_id=c.owner_account_id
      where c.handle='isolated_bootstrap_creator' and ai.provider='supabase' limit 1""")
    subjectrow=one(c,"""select subject_id from public.gallery_verified_subjects
      where subject_type='floating_island' and gallery_kind='outdoor'
        and verification_state='verified' limit 1""")
    assert ownerrow and subjectrow, "LOCAL_SYNTHETIC_OWNER_OR_SUBJECT_MISSING"
    auth,owner,creator=ownerrow;subject=subjectrow[0]
    vals={k:uuid.uuid4() for k in ("galleryWork","galleryRev","presetWork","artifact","presetRev","presetWorkRev","oldBlob","newBlob","oldMedia","newMedia")}
    g=vals
    tag="ci-r8-"+str(uuid.uuid4())
    c.execute("BEGIN")
    try:
        execute(c,"update public.creator_profiles set profile_visibility='public',moderation_state='clear' where creator_profile_id=%s",(creator,))
        for name in ("oldMedia","newMedia"):
            mid=g[name]
            execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(mid,))
            execute(c,"""insert into public.media_assets(
              media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
              checksum_sha256,processing_state,moderation_state)
              values(%s,%s,%s,'image/png',256,20,20,%s,'ready','clear')""",
              (mid,owner,f"ci-only/{tag}-{name}.png",'a'*64))
        execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'community_work'),(%s,'preset_artifact')",
                (g["galleryWork"],g["presetWork"],g["artifact"]))
        execute(c,"""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'gallery','public','clear'),(%s,%s,%s,'preset','public','clear')""",
          (g["galleryWork"],owner,creator,g["presetWork"],owner,creator))
        execute(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(g["galleryWork"],))
        execute(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(g["galleryWork"],))
        execute(c,"insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id) values(%s,%s,%s,%s)",
          (g["galleryWork"],subject,owner,creator))
        execute(c,"""insert into public.community_work_revisions
          (revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
          values(%s,%s,1,%s,%s::jsonb)""",
          (g["galleryRev"],g["galleryWork"],owner,json.dumps({"title":"R8 disposable Gallery"})))
        execute(c,"insert into public.gallery_work_revisions(revision_id,title,description,metadata) values(%s,'R8 Gallery',null,'{}'::jsonb)",(g["galleryRev"],))
        execute(c,"insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')",
          (g["galleryRev"],g["oldMedia"]))
        execute(c,"insert into public.gallery_photo_revision_fields(revision_id,subject_id,cover_media_id,originality_attested) values(%s,%s,%s,true)",
          (g["galleryRev"],subject,g["oldMedia"]))
        execute(c,"""insert into public.preset_artifacts
          (preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type,associated_gallery_work_id)
          values(%s,%s,%s,%s,'scene',%s)""",
          (g["artifact"],owner,creator,g["presetWork"],g["galleryWork"]))
        for name in ("oldBlob","newBlob"):
            execute(c,"""insert into public.artifact_blobs(
              blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
              values(%s,%s,%s,1,'application/json',512,%s)""",
              (g[name],owner,f"ci-only/{tag}-{name}.json",'e'*64))
        execute(c,"""insert into public.preset_revisions
          (preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
          values(%s,%s,1,%s,'{}'::jsonb,%s)""",
          (g["presetRev"],g["artifact"],g["oldBlob"],owner))
        execute(c,"""insert into public.community_work_revisions
          (revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
          values(%s,%s,1,%s,'{"title":"R8 Scene","description":"fixture"}'::jsonb)""",
          (g["presetWorkRev"],g["presetWork"],owner))
        execute(c,"insert into public.preset_revision_publications(work_revision_id,preset_revision_id) values(%s,%s)",
          (g["presetWorkRev"],g["presetRev"]))
        execute(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",
          (g["galleryRev"],g["presetRev"]))
        execute(c,"""update public.community_works set current_published_revision_id=%s,
          lifecycle_state='published',published_at=now() where work_id=%s""",
          (g["galleryRev"],g["galleryWork"]))
        execute(c,"""update public.community_works set current_published_revision_id=%s,
          lifecycle_state='published',published_at=now() where work_id=%s""",
          (g["presetWorkRev"],g["presetWork"]))
        g["presetVersion"]=one(c,"select row_version from public.community_works where work_id=%s",(g["presetWork"],))[0]
        g["galleryVersion"]=one(c,"select row_version from public.community_works where work_id=%s",(g["galleryWork"],))[0]
        pub=one(c,"select public.community_get_scene_preset_public_v1(%s)",(g["presetWork"],))[0]
        assert pub["presetRevisionId"]==str(g["presetRev"]),pub
        c.execute("COMMIT")
    except:
        c.execute("ROLLBACK")
        raise
    g["auth"]=auth
    g["expectedHistoricalEdgeSha256"]=historical_edge_hash(c,g)
    return g

def snapshot(c,g):
    return {
      "work":one(c,"""select w1.row_version,w1.lifecycle_state,w1.current_published_revision_id,
        w2.row_version,w2.lifecycle_state,w2.current_published_revision_id
        from public.community_works w1 cross join public.community_works w2
        where w1.work_id=%s and w2.work_id=%s""",(g["presetWork"],g["galleryWork"])),
      "presetRevisions":one(c,"select count(*) from public.preset_revisions where preset_artifact_id=%s",(g["artifact"],))[0],
      "galleryRevisions":one(c,"select count(*) from public.community_work_revisions where work_id=%s",(g["galleryWork"],))[0],
      "presetWorkRevisions":one(c,"select count(*) from public.community_work_revisions where work_id=%s",(g["presetWork"],))[0],
      "search":one(c,"select count(*) from public.search_documents where work_id in (%s,%s)",(g["presetWork"],g["galleryWork"]))[0],
      "outbox":one(c,"select count(*) from public.outbox_events where aggregate_id in (%s,%s)",(g["presetWork"],g["galleryWork"]))[0],
      "idem":one(c,"select count(*) from public.idempotency_keys where idempotency_key=%s",("r8-paired-"+str(g["artifact"]),))[0],
      "mediaLinks":one(c,"""select count(*) from public.work_revision_media wrm
        join public.community_work_revisions r on r.revision_id=wrm.work_revision_id
        where r.work_id=%s""",(g["galleryWork"],))[0],
    }

def invoke(c,g,expected_edge_sha256=None):
    return one(c,"""select private.scene_save_revision_paired_candidate_v1(
      %s,%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s,%s::jsonb,%s,%s)""",
      (g["auth"],g["artifact"],g["presetRev"],g["presetVersion"],g["galleryVersion"],
       g["newBlob"],[g["oldMedia"],g["newMedia"]],g["newMedia"],
       "R8 Linked Scene V2","R8 disposable regression",
       json.dumps({"r8":"isolated-full-schema"}),"r8-paired-"+str(g["artifact"]),
       expected_edge_sha256 or g["expectedHistoricalEdgeSha256"]))[0]

def concurrent(url,g):
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        assert apid!=bpid
        before=snapshot(a,g)
        assert before["presetRevisions"]==1
        # Full migration: no external Edge role may invoke candidate.
        sig="private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text,text)"
        for role in ("anon","authenticated","service_role"):
            assert one(a,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig))[0] is False
        started=threading.Event()
        done=threading.Event()
        result={}
        a.execute("BEGIN")
        try:
            assert one(a,"select work_id from public.community_works where work_id=%s for update",
                       (g["galleryWork"],))==(g["galleryWork"],)
            def writer():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='1900ms'")
                    b.execute("set local statement_timeout='8s'")
                    assert one(b,"select pg_backend_pid()")[0]==bpid
                    result["start"]=time.monotonic()
                    started.set()
                    try:
                        invoke(b,g)
                        result["unexpectedCommit"]=True
                    except psycopg.Error as e:
                        result["sqlstate"]=e.sqlstate
                        result["error"]=str(e).splitlines()[0]
                except Exception as e:
                    result["unexpected"]=repr(e)
                finally:
                    b.execute("ROLLBACK")
                    done.set()
            t=threading.Thread(target=writer,daemon=True)
            t.start()
            assert started.wait(5),"R8_WRITER_NOT_STARTED"
            blocked=False;last_wait=None
            deadline=time.monotonic()+3
            while time.monotonic()<deadline and not done.is_set():
                pids,wtype=one(a,"""select pg_blocking_pids(%s),
                    (select wait_event_type from pg_stat_activity where pid=%s)""",(bpid,bpid))
                if apid in (pids or []):
                    blocked=True;last_wait=wtype;break
                time.sleep(.025)
            assert done.wait(8),"R8_WRITER_TIMEOUT_NOT_OBSERVED"
            t.join(1)
            assert result.get("sqlstate")=="55P03" and not result.get("unexpectedCommit") and "unexpected" not in result,result
            assert blocked,(result,"NO_REAL_BLOCKER")
            assert snapshot(a,g)==before,"R8_TIMEOUT_PARTIAL_MUTATION"
            print(json.dumps({"case":"R8_REAL_03COMM_FULLSOURCE_PAIRED_RPC_CONCURRENT_LOCK",
                "holderPid":apid,"writerPid":bpid,"blockedByHolder":blocked,
                "waitEventType":last_wait,"sqlstate":result["sqlstate"],
                "allTransactionSideEffectsUnchanged":True,
                "full113MigrationSource":True,"actualSignedStagingActor":False}))
        finally:
            a.execute("ROLLBACK")
        assert snapshot(a,g)==before,"R8_POST_RELEASE_BASELINE_CHANGED"
        b.execute("BEGIN")
        try:
            b.execute("set local statement_timeout='10s'")
            response=invoke(b,g)
            assert response and "presetRevisionId" in response,response
            after=snapshot(b,g)
            assert after["presetRevisions"]==before["presetRevisions"]+1
            assert after["galleryRevisions"]==before["galleryRevisions"]+1
            assert after["presetWorkRevisions"]==before["presetWorkRevisions"]+1
            assert after["outbox"]==before["outbox"]+2
            assert after["idem"]==before["idem"]+1
            assert after["mediaLinks"]==before["mediaLinks"]+2
            assert after["search"]==2
            print(json.dumps({"case":"R8_PAIRED_RPC_RETRY_AFTER_GALLERY_RELEASE",
                "successWithinNewTransaction":True,
                "immutableRevisionsBothWorks":True,
                "outboxAndIdempotencyInTransaction":True,
                "physicalStorageBytesWritten":False}))
        finally:
            b.execute("ROLLBACK")
        assert snapshot(a,g)==before,"R8_RETRY_ROLLBACK_FAILED"
        print(json.dumps({"result":"R8_ISOLATED_FULL_SCHEMA_PAIRED_SCENE_2_SESSION_PASS",
            "sourcePairedRPCInvoked":True,
            "stagingConcurrencyAccepted":False,
            "productionActorRlsOrStorageAccepted":False,
            "allCrossProductWritersEnrolled":False,
            "graphComplete":False,"retirementAuthorized":False}))


def stale_historical_graph_counterexample(url,g):
    """Prove R8 writer's rowVersion+distinct Gallery Work set is not a complete
    fingerprint of immutable historical GalleryRevision->PresetRevision edges.
    All commits here are ephemeral local Supabase only, no Staging/Production.
    """
    def edges(c):
        return one(c,"""select count(*) from public.gallery_revision_presets gp
            join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
            join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
            where pr.preset_artifact_id=%s and wr.work_id=%s""",
            (g["artifact"],g["galleryWork"]))[0]
    with psycopg.connect(url,autocommit=True) as c:
        original_gallery_version=one(c,"select row_version from public.community_works where work_id=%s",(g["galleryWork"],))[0]
        original_preset_version=one(c,"select row_version from public.community_works where work_id=%s",(g["presetWork"],))[0]
        original_edges=edges(c)
        assert original_edges==1,original_edges
        # A new UNSEALED Gallery WorkRevision references the same immutable
        # PresetRevision. Its GalleryWork identity is unchanged and rowVersion
        # does NOT change, but its historical dependency graph is different.
        new_gallery_revision=uuid.uuid4()
        owner=one(c,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))[0]
        c.execute("BEGIN")
        try:
            execute(c,"""insert into public.community_work_revisions
                (revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
                values(%s,%s,2,%s,'{"r8":"extra_unsealed_historical_link"}'::jsonb)""",
                (new_gallery_revision,g["galleryWork"],owner))
            execute(c,"insert into public.gallery_work_revisions(revision_id,title,description,metadata) values(%s,'R8 Extra Historic Ref',null,'{}'::jsonb)",
                (new_gallery_revision,))
            execute(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",
                (new_gallery_revision,g["presetRev"]))
            c.execute("COMMIT")
        except:
            c.execute("ROLLBACK");raise
        assert edges(c)==2
        injected_edge_count=edges(c)
        assert one(c,"select row_version from public.community_works where work_id=%s",(g["galleryWork"],))[0]==original_gallery_version
        assert one(c,"select row_version from public.community_works where work_id=%s",(g["presetWork"],))[0]==original_preset_version
        baseline=snapshot(c,g)
        # Old request graph pin is now stale, although both Work rowVersions
        # and the current PresetRevision are unchanged.
        c.execute("BEGIN")
        try:
            try:
                invoke(c,g)
                raise AssertionError("R9_STALE_GRAPH_PIN_UNEXPECTED_SUCCESS")
            except psycopg.Error as error:
                assert "SCENE_REVISION_CALLER_EDGE_FINGERPRINT_STALE" in str(error),str(error)
                print(json.dumps({"case":"R9_CALLER_PIN_HISTORICAL_EDGE_STALE_REJECTED",
                    "originalLinkedEdges":original_edges,
                    "preInvokeLinkedEdges":injected_edge_count,
                    "bothWorkRowVersionsUnchanged":True,
                    "sourceIsIsolatedCandidateFork":True,
                    "positiveRetirementAuthorized":False}))
        finally:
            c.execute("ROLLBACK")
        assert snapshot(c,g)==baseline,"R9_STALE_FAILURE_PARTIAL_MUTATION"
        # Freshly authorized graph pin may proceed, but the fixture transaction
        # MUST rollback: no production publication or durable media.
        fresh_pin=historical_edge_hash(c,g)
        assert fresh_pin!=g["expectedHistoricalEdgeSha256"]
        c.execute("BEGIN")
        try:
            response=invoke(c,g,expected_edge_sha256=fresh_pin)
            assert response and response.get("presetRevisionId"),response
            assert edges(c)==injected_edge_count+1
            print(json.dumps({"case":"R9_FRESH_CALLER_PIN_PAIRED_SCENE_TRANSACTION_CANDIDATE",
                "freshCallerAuthorizedHistoricalEdges":True,
                "provisionalAndLockedEdgesCompared":True,
                "publicOrSignedRpcEnabled":False}))
        finally:
            c.execute("ROLLBACK")
        assert snapshot(c,g)==baseline
        print(json.dumps({"result":"R9_ISOLATED_SCENE_CALLER_PIN_CANDIDATE_PASS",
            "allWriterGraphRegistryComplete":False,
            "stagingSignedRolesOrMediaAccepted":False,
            "retirementAuthorized":False}))



def concurrent_known_reference_edge_insert(url,g):
    """R10: source trigger vs GalleryWork row lock in ACTUAL local 113-migration DB.

    The new unsealed GalleryRevision is precreated before the lock, so the
    waiting operation is the GalleryRevisionPreset INSERT (known-writer trigger),
    not a previous parent-Work FK insertion. No row deletion/revocation.
    """
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        assert apid!=bpid
        assert one(a,"""select count(*) from pg_trigger
            where tgname='gallery_revision_presets_known_reference_fence'
              and tgenabled='O'""")[0]==1, "R10_EXPECTED_DEPLOYED_REFERENCE_FENCE_MISSING"
        orig_edge_hash=historical_edge_hash(a,g)
        orig_work_versions=one(a,"""select p.row_version,g.row_version
            from public.community_works p cross join public.community_works g
            where p.work_id=%s and g.work_id=%s""",
            (g["presetWork"],g["galleryWork"]))
        owner=one(a,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))[0]
        newrev=uuid.uuid4()
        a.execute("BEGIN")
        try:
            rev_number=one(a,"""select coalesce(max(revision_number),0)+1
                from public.community_work_revisions where work_id=%s""",(g["galleryWork"],))[0]
            execute(a,"""insert into public.community_work_revisions
                (revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
                values(%s,%s,%s,%s,'{"r10":"isolated_pending_link"}'::jsonb)""",
                (newrev,g["galleryWork"],rev_number,owner))
            execute(a,"""insert into public.gallery_work_revisions(revision_id,title,description,metadata)
                values(%s,'R10 pending no-public edge',null,'{}'::jsonb)""",(newrev,))
            a.execute("COMMIT")
        except:
            a.execute("ROLLBACK")
            raise
        # Work rowVersion itself is not a seal of unlinked historical revisions.
        assert historical_edge_hash(a,g)==orig_edge_hash
        assert one(a,"""select p.row_version,g.row_version
            from public.community_works p cross join public.community_works g
            where p.work_id=%s and g.work_id=%s""",
            (g["presetWork"],g["galleryWork"]))==orig_work_versions
        started=threading.Event()
        done=threading.Event()
        result={}
        a.execute("BEGIN")
        try:
            assert one(a,"select work_id from public.community_works where work_id=%s for update",
                (g["galleryWork"],))==(g["galleryWork"],)
            def edge_writer():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='1900ms'")
                    b.execute("set local statement_timeout='8s'")
                    started.set()
                    try:
                        execute(b,"""insert into public.gallery_revision_presets
                            (gallery_revision_id,preset_revision_id) values(%s,%s)""",
                            (newrev,g["presetRev"]))
                        result["unexpectedSuccess"]=True
                    except psycopg.Error as error:
                        result["sqlstate"]=error.sqlstate
                        result["error"]=str(error).splitlines()[0]
                except Exception as error:
                    result["unexpected"]=repr(error)
                finally:
                    b.execute("ROLLBACK")
                    done.set()
            t=threading.Thread(target=edge_writer,daemon=True)
            t.start()
            assert started.wait(5), "R10_EDGE_INSERT_NOT_STARTED"
            blocked=False
            wait_event_type=None
            deadline=time.monotonic()+3
            while time.monotonic()<deadline and not done.is_set():
                blocking_pids, event=one(a,"""select pg_blocking_pids(%s),
                    (select wait_event_type from pg_stat_activity where pid=%s)""",
                    (bpid,bpid))
                if apid in (blocking_pids or []):
                    blocked=True
                    wait_event_type=event
                    break
                time.sleep(.025)
            assert done.wait(8),"R10_EDGE_TIMEOUT_NOT_OBSERVED"
            t.join(1)
            assert blocked and result.get("sqlstate")=="55P03",result
            assert not result.get("unexpectedSuccess") and not result.get("unexpected"),result
            assert historical_edge_hash(a,g)==orig_edge_hash,"R10_FAILED_EDGE_INSERT_LEFT_REFERENCE"
            print(json.dumps({"case":"R10_ACTUAL_GALLERY_REVISION_PRESET_INSERT_TRIGGER_TWO_SESSIONS",
                "holderPid":apid,"writerPid":bpid,"waitEventType":wait_event_type,
                "writerBlockedByGalleryWorkLock":True,"sqlstate":result["sqlstate"],
                "timedOutInsertRolledBack":True,"presetAndGalleryRowVersionsUnchanged":True,
                "full113SourceMigrations":True,"actualStagingOrSignedActor":False}))
        finally:
            a.execute("ROLLBACK")
        assert historical_edge_hash(a,g)==orig_edge_hash
        # Reference INSERT is admitted only after Gallery lock release; however
        # roll back it here so the ephemeral fixture has no durable new edge.
        b.execute("BEGIN")
        try:
            execute(b,"""insert into public.gallery_revision_presets
                (gallery_revision_id,preset_revision_id) values(%s,%s)""",
                (newrev,g["presetRev"]))
            assert historical_edge_hash(b,g)!=orig_edge_hash
            print(json.dumps({"case":"R10_REFERENCE_WRITER_AFTER_GALLERY_LOCK_RELEASE",
                "newEdgeVisibleInSameTransaction":True,
                "sameWorkRowVersionsWithoutRevisionPointerChange":True,
                "commitAuthorized":False}))
        finally:
            b.execute("ROLLBACK")
        assert historical_edge_hash(a,g)==orig_edge_hash
        print(json.dumps({"result":"R10_KNOWN_REFERENCE_TRIGGER_TWO_SESSION_LOCAL_PASS",
            "unknownReferenceWriterGraphComplete":False,
            "retirementAuthorized":False}))



def concurrent_other_known_reference_writers(url,g):
    """09 INT R11: actual PR134 known trigger #2/#3 against independent Gallery lock.

    All records/transactions are synthetic and confined to local full-schema DB.
    """
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        owner=one(a,"select owner_account_id from public.community_works where work_id=%s",(g["presetWork"],))[0]
        # Source triggers must be installed AND enabled. This does not guarantee
        # global writer completeness beyond these three known trigger tables.
        expected_triggers=(
           "gallery_revision_presets_known_reference_fence",
           "preset_artifacts_known_gallery_reference_fence",
           "preset_revision_publications_known_gallery_reference_fence")
        enabled=one(a,"""select count(*) from pg_trigger
           where tgenabled='O' and tgname=any(%s)""",(list(expected_triggers),))[0]
        assert enabled==3,("R11_KNOWN_FENCE_TRIGGER_INSTALLATION",enabled)
        before_digest=historical_edge_hash(a,g)
        before_versions=one(a,"""select pw.row_version,gw.row_version
          from public.community_works pw cross join public.community_works gw
          where pw.work_id=%s and gw.work_id=%s""",
          (g["presetWork"],g["galleryWork"]))
        # A new unsealed PresetWorkRevision must exist BEFORE A's lock. This
        # avoids falsely attributing parent FK locking to the reference trigger.
        prepared_pub_rev=uuid.uuid4()
        a.execute("BEGIN")
        try:
            next_number=one(a,"select coalesce(max(revision_number),0)+1 from public.community_work_revisions where work_id=%s",
                 (g["presetWork"],))[0]
            execute(a,"""insert into public.community_work_revisions
             (revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
             values(%s,%s,%s,%s,'{"r11":"precreated_publication_parent"}'::jsonb)""",
             (prepared_pub_rev,g["presetWork"],next_number,owner))
            a.execute("COMMIT")
        except:
            a.execute("ROLLBACK")
            raise

        cases=[
          ("associated_gallery_work_id_update",
            """update public.preset_artifacts
                set associated_gallery_work_id=associated_gallery_work_id
                where preset_artifact_id=%s""",
            (g["artifact"],)),
          ("preset_revision_publications_insert",
            """insert into public.preset_revision_publications
                (work_revision_id,preset_revision_id) values(%s,%s)""",
            (prepared_pub_rev,g["presetRev"]))
        ]
        for name,statement,args in cases:
            apid=one(a,"select pg_backend_pid()")[0]
            bpid=one(b,"select pg_backend_pid()")[0]
            assert apid!=bpid
            started=threading.Event()
            done=threading.Event()
            result={}
            a.execute("BEGIN")
            try:
                assert one(a,"""select work_id from public.community_works
                    where work_id=%s for update""",(g["galleryWork"],))==(g["galleryWork"],)
                def writer():
                    try:
                        b.execute("BEGIN")
                        b.execute("set local lock_timeout='1900ms'")
                        b.execute("set local statement_timeout='8s'")
                        started.set()
                        try:
                            execute(b,statement,args)
                            result["unexpectedSuccess"]=True
                        except psycopg.Error as error:
                            result["sqlstate"]=error.sqlstate
                            result["error"]=str(error).splitlines()[0]
                    except Exception as error:
                        result["unexpected"]=repr(error)
                    finally:
                        b.execute("ROLLBACK")
                        done.set()
                th=threading.Thread(target=writer,daemon=True)
                th.start()
                assert started.wait(5),("R11_NOT_STARTED",name)
                blocked=False
                wait_type=None
                deadline=time.monotonic()+3
                while time.monotonic()<deadline and not done.is_set():
                    pids,event=one(a,"""select pg_blocking_pids(%s),
                        (select wait_event_type from pg_stat_activity where pid=%s)""",
                        (bpid,bpid))
                    if apid in (pids or []):
                        blocked=True
                        wait_type=event
                        break
                    time.sleep(.025)
                assert done.wait(8),("R11_TIMEOUT_NOT_REPORTED",name)
                th.join(1)
                assert blocked,("R11_BYPASS_GALLERY_WORK_LOCK",name,result)
                assert result.get("sqlstate")=="55P03" and not result.get("unexpectedSuccess") and not result.get("unexpected"),(name,result)
                assert historical_edge_hash(a,g)==before_digest,(name,"R11_PARTIAL_GRAPH_CHANGE")
                assert one(a,"""select pw.row_version,gw.row_version
                    from public.community_works pw cross join public.community_works gw
                    where pw.work_id=%s and gw.work_id=%s""",
                    (g["presetWork"],g["galleryWork"]))==before_versions, (name,"R11_PARTIAL_VERSION_CHANGE")
                print(json.dumps({"case":"R11_ACTUAL_PR134_REFERENCE_WRITER_TRIGGER",
                    "writer":name,"holderPid":apid,"writerPid":bpid,
                    "blockedByHolder":blocked,"waitEventType":wait_type,
                    "sqlstate":result["sqlstate"],"rollbackBeforeCommit":True,
                    "stagingSignedActors":False}))
            finally:
                a.execute("ROLLBACK")
            assert historical_edge_hash(a,g)==before_digest
            # Allow this *actual* writer only after release; rollback all
            # mutations to avoid durable effects even in disposable local DB.
            b.execute("BEGIN")
            try:
                execute(b,statement,args)
                if name=="preset_revision_publications_insert":
                    assert one(b,"""select count(*) from public.preset_revision_publications
                        where work_revision_id=%s and preset_revision_id=%s""",
                        (prepared_pub_rev,g["presetRev"]))[0]==1
                print(json.dumps({"case":"R11_KNOWN_REFERENCE_AFTER_LOCK_RELEASE",
                    "writer":name,"candidateTransactionSucceeded":True,
                    "willRollback":True}))
            finally:
                b.execute("ROLLBACK")
            assert historical_edge_hash(a,g)==before_digest
        print(json.dumps({"result":"R11_ALL_THREE_KNOWN_REFERENCE_TRIGGER_LOCKS_LOCAL_PASS",
            "schemaSource":"03COMM_PR134_QR_LATEST_D2E45768",
            "allWriterGraphComplete":False,"retirementAuthorized":False}))


def gallery_row_version_stale_rejected(url,g):
    """04 QR independent: a caller with wrong paired Gallery Work rowVersion
    must be denied before any persistent media/search/outbox writes.
    All data is synthetic in the 113-migration local PG instance.
    """
    with psycopg.connect(url,autocommit=True) as c:
        actual_gallery_version=one(c,
            "select row_version from public.community_works where work_id=%s",
            (g["galleryWork"],))[0]
        actual_preset_version=one(c,
            "select row_version from public.community_works where work_id=%s",
            (g["presetWork"],))[0]
        before=snapshot(c,g)
        wrong=dict(g)
        wrong["galleryVersion"]=actual_gallery_version+1
        wrong["presetVersion"]=actual_preset_version
        wrong["expectedHistoricalEdgeSha256"]=historical_edge_hash(c,g)
        c.execute("BEGIN")
        try:
            try:
                invoke(c,wrong)
                raise AssertionError("QR_GALLERY_ROWVERSION_UNEXPECTED_SUCCESS")
            except psycopg.Error as error:
                assert "SCENE_REVISION_ROW_VERSION_CONFLICT" in str(error),str(error)
                print(json.dumps({"case":"QR_LATEST_SCENE_GALLERY_ROWVERSION_STALE_REJECTED",
                    "wrongVersionWasCallerSupplied":True,"galleryWorkVersionUnchanged":True,
                    "sourcePairingAuthorizationAbsent":True,"realSignedStagingActor":False}))
        finally:
            c.execute("ROLLBACK")
        assert snapshot(c,g)==before,"QR_ROWVERSION_REJECTION_PARTIAL_CHANGE"


def main():
    url=local_dsn()
    with psycopg.connect(url,autocommit=True) as c:
        g=fixture(c)
    concurrent(url,g)
    stale_historical_graph_counterexample(url,g)
    concurrent_known_reference_edge_insert(url,g)
    concurrent_other_known_reference_writers(url,g)
    gallery_row_version_stale_rejected(url,g)

if __name__=="__main__":
    main()
