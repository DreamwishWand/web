#!/usr/bin/env python3
"""09 INT R8: actual 03 COMM inert paired Scene RPC concurrency on an isolated FULL
113-migration local Supabase database. Strictly NO remote/staging/production DSN.
No HTTP/Storage bytes, signed role, native save-writing or positive Gallery retirement.
"""
import json, os, sys, time, uuid, threading
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

def invoke(c,g):
    return one(c,"""select private.scene_save_revision_paired_candidate_v1(
      %s,%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s,%s::jsonb,%s)""",
      (g["auth"],g["artifact"],g["presetRev"],g["presetVersion"],g["galleryVersion"],
       g["newBlob"],[g["oldMedia"],g["newMedia"]],g["newMedia"],
       "R8 Linked Scene V2","R8 disposable regression",
       json.dumps({"r8":"isolated-full-schema"}),"r8-paired-"+str(g["artifact"])))[0]

def concurrent(url,g):
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        assert apid!=bpid
        before=snapshot(a,g)
        assert before["presetRevisions"]==1
        # Full migration: no external Edge role may invoke candidate.
        sig="private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text)"
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
        assert one(c,"select row_version from public.community_works where work_id=%s",(g["galleryWork"],))[0]==original_gallery_version
        assert one(c,"select row_version from public.community_works where work_id=%s",(g["presetWork"],))[0]==original_preset_version
        baseline=snapshot(c,g)
        c.execute("BEGIN")
        try:
            candidate_response=invoke(c,g)
            assert candidate_response and candidate_response.get("presetRevisionId"),candidate_response
            # No graph fingerprint pin was passed; candidate accepts a stale
            # rowVersion when only SAME Gallery Work gains an extra ref edge.
            print(json.dumps({"case":"R8_HISTORICAL_SAME_GALLERY_EDGE_GRAPH_PIN_NEGATIVE",
              "originalLinkedEdges":original_edges,"newLinkedEdges":edges(c),
              "galleryRowVersionUnchanged":True,"sourceCandidateAcceptedChangedHistoricalGraph":True,
              "allWriterHistoricalFingerprintClosed":False,
              "sourceOwnerOnlyCandidate":True,"positiveRetirementAuthorized":False}))
        finally:
            c.execute("ROLLBACK")
        assert snapshot(c,g)==baseline
        print(json.dumps({"case":"R8_HISTORICAL_GRAPH_NEGATIVE_ROLLBACK",
            "candidateWriteRolledBack":True,"positiveRetirementAuthorized":False}))


def main():
    url=local_dsn()
    with psycopg.connect(url,autocommit=True) as c:
        g=fixture(c)
    concurrent(url,g)
    stale_historical_graph_counterexample(url,g)

if __name__=="__main__":
    main()
