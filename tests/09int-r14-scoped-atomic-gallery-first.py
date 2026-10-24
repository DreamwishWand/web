#!/usr/bin/env python3
"""R14: local disposable Source Gallery v4 with explicit ordered lock preflight.
Does NOT provide all-kind graph completeness or production API authority.
R11 module imported for synthetic fixture ONLY; prior cases never run.
"""
import importlib.util,json,hashlib,threading,time,uuid,sys
from pathlib import Path
import psycopg
p=Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py")
spec=importlib.util.spec_from_file_location("r14fixture",p)
f=importlib.util.module_from_spec(spec);sys.modules[spec.name]=f;spec.loader.exec_module(f)
url=f.local_dsn()
def one(c,q,args=()):return f.one(c,q,args)[0]
def execute(c,q,args=()):return f.execute(c,q,args)

def pin(c,g):
    # Scope is EXACTLY one known Scene artifact, its publications and Gallery.
    # Other kinds or unexplored reference namespaces remain UNKNOWN/blocked.
    art=f.one(c,"""select preset_artifact_id,owner_account_id,creator_profile_id,
      community_work_id,associated_gallery_work_id,preset_type
      from public.preset_artifacts where preset_artifact_id=%s""",(g["artifact"],))
    assert art and art[5]=="scene"
    edges=c.execute("""select wr.work_id,gp.gallery_revision_id,gp.preset_revision_id
      from public.gallery_revision_presets gp
      join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
      join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
      where pr.preset_artifact_id=%s order by wr.work_id,gp.gallery_revision_id""",
      (g["artifact"],)).fetchall()
    galleries=sorted({g["draftGallery"],art[4],*[x[0] for x in edges]},key=str)
    works=c.execute("""select work_id,owner_account_id,creator_profile_id,row_version,
      current_published_revision_id,lifecycle_state,visibility,moderation_state
      from public.community_works where work_id=any(%s) order by work_id""",
      ([art[3]]+galleries,)).fetchall()
    pubs=c.execute("""select pp.work_revision_id,pp.preset_revision_id
      from public.preset_revision_publications pp
      join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
      where pr.preset_artifact_id=%s order by pp.work_revision_id""",(g["artifact"],)).fetchall()
    assert len(works)==len(galleries)+1
    items=[[str(v) for v in row] for row in [art,*edges,*works,*pubs]]
    digest=hashlib.sha256(json.dumps(items,separators=(',',':')).encode()).hexdigest()
    return digest,art,galleries

def scoped_publish(c,g,expected):
    digest,art,galleries=pin(c,g)
    owner=art[1]
    # Order: Account BEFORE Artifact BEFORE Preset Work BEFORE Gallery Work.
    one(c,"select account_id from public.wand_accounts where account_id=%s for share",(owner,))
    one(c,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(g["artifact"],))
    one(c,"select work_id from public.community_works where work_id=%s for update",(g["presetWork"],))
    for gallery in galleries:
        one(c,"select work_id from public.community_works where work_id=%s for update",(gallery,))
    fresh,locked_art,locked_galleries=pin(c,g)
    assert locked_galleries==galleries and locked_art==art,"R14_LOCK_ROSTER_CHANGED_RESTART"
    assert fresh==digest==expected,"R14_STALE_CALLER_GRAPH"
    active=one(c,"""select count(*) from public.auth_identities i
       join public.wand_accounts a on a.account_id=i.account_id
       where i.provider='supabase' and i.provider_subject=%s
       and i.identity_state='active' and i.account_id=%s
       and a.status='active' and a.deleted_at is null
       and not exists(select 1 from private.account_privacy_suppressions s
                     where s.account_id=a.account_id)""",
       (str(g["auth"]),owner))
    assert active==1,"R14_ACTIVE_ACTOR_OR_PRIVACY_DENIED"
    v=one(c,"select row_version from public.community_works where work_id=%s",(g["draftGallery"],))
    assert v==g["draftVersion"],"R14_GALLERY_VERSION_STALE"
    response=one(c,"""select public.community_publish_gallery_v4(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],g["draftGallery"],g["draftVersion"],"R14 isolated photo",
       "Rollback only",[g["oldMedia"]],[g["presetRev"]],[],[],None,
       "r14-gallery-"+str(uuid.uuid4())))
    assert response.get("revisionId"),response
    assert one(c,"select count(*) from public.search_documents where work_id=%s",(g["draftGallery"],))==1
    assert one(c,"select count(*) from public.outbox_events where aggregate_id=%s",(g["draftGallery"],))>=1
    return response

def prepare(c,g):
    d=uuid.uuid4()
    owner,creator=f.one(c,"select owner_account_id,creator_profile_id from public.community_works where work_id=%s",(g["galleryWork"],))
    c.execute("BEGIN")
    try:
        execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(d,))
        execute(c,"""insert into public.community_works
           (work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
           values(%s,%s,%s,'gallery','public','clear')""",(d,owner,creator))
        execute(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(d,))
        execute(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(d,))
        c.execute("COMMIT")
    except:
        c.execute("ROLLBACK");raise
    g["draftGallery"]=d
    g["draftVersion"]=one(c,"select row_version from public.community_works where work_id=%s",(d,))

def state(c,g):
    d=g["draftGallery"]
    return f.one(c,"""select (select count(*) from public.community_work_revisions where work_id=%s),
     (select count(*) from public.search_documents where work_id=%s),
     (select count(*) from public.outbox_events where aggregate_id=%s),
     (select current_published_revision_id from public.community_works where work_id=%s)""",(d,d,d,d))

def two_session(url,g,kind):
    with psycopg.connect(url,autocommit=True) as a,psycopg.connect(url,autocommit=True) as b:
        before=state(a,g);expected=pin(a,g)[0]
        holder=one(a,"select pg_backend_pid()");contender=one(b,"select pg_backend_pid()")
        started=threading.Event();finished=threading.Event();res={}
        a.execute("BEGIN")
        try:
            if kind=="artifact":
                one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(g["artifact"],))
            else:
                owner=one(a,"select owner_account_id from public.community_works where work_id=%s",(g["presetWork"],))
                one(a,"select account_id from public.wand_accounts where account_id=%s for update",(owner,))
            def writer():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='950ms'")
                    started.set()
                    try:scoped_publish(b,g,expected);res["unexpected"]=True
                    except psycopg.Error as e:res["sqlstate"]=e.sqlstate
                finally:
                    b.execute("ROLLBACK");finished.set()
            th=threading.Thread(target=writer,daemon=True);th.start()
            assert started.wait(5)
            blocked=False;deadline=time.monotonic()+3
            while time.monotonic()<deadline and not finished.is_set():
                if holder in (one(a,"select pg_blocking_pids(%s)",(contender,)) or []):
                    blocked=True;break
                time.sleep(.025)
            assert finished.wait(6) and blocked and res.get("sqlstate")=="55P03",res
            th.join(1)
            assert state(a,g)==before
            print(json.dumps({"case":"R14_ORDERED_ROOT_LOCK_2SESSION",
             "held":kind,"pgBlockingPids":True,"sqlstate":"55P03","wholeRollback":True}))
        finally:a.execute("ROLLBACK")
        assert state(a,g)==before
        # Actual new BEGIN rechecks current actor & caller graph; not a savepoint.
        b.execute("BEGIN")
        try:
            scoped_publish(b,g,pin(b,g)[0])
            print(json.dumps({"case":"R14_FRESH_WHOLE_TRANSACTION_RETRY_AFTER_55P03",
                 "held":kind,"newTransaction":True,"sourceV4Ran":True,"commitAuthorized":False}))
        finally:b.execute("ROLLBACK")
        assert state(b,g)==before

def main():
    with psycopg.connect(url,autocommit=True) as c:
        g=f.fixture(c);prepare(c,g)
        base=state(c,g)
    two_session(url,g,"artifact")
    two_session(url,g,"account")
    with psycopg.connect(url,autocommit=True) as c:
        stale=pin(c,g)[0]
        owner=one(c,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))
        extra=uuid.uuid4()
        c.execute("BEGIN")
        try:
            n=one(c,"select max(revision_number)+1 from public.community_work_revisions where work_id=%s",(g["galleryWork"],))
            execute(c,"""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                       values(%s,%s,%s,%s)""",(extra,g["galleryWork"],n,owner))
            execute(c,"insert into public.gallery_work_revisions(revision_id,title) values(%s,'R14 history')",(extra,))
            execute(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",
                    (extra,g["presetRev"]))
            c.execute("COMMIT")
        except:
            c.execute("ROLLBACK");raise
        assert pin(c,g)[0]!=stale
        c.execute("BEGIN")
        try:
            try:scoped_publish(c,g,stale);raise AssertionError("STALENESS_BYPASS")
            except AssertionError as e:assert str(e)=="R14_STALE_CALLER_GRAPH",str(e)
        finally:c.execute("ROLLBACK")
        assert state(c,g)==base
        c.execute("BEGIN")
        try:scoped_publish(c,g,pin(c,g)[0])
        finally:c.execute("ROLLBACK")
        assert state(c,g)==base
        print(json.dumps({"case":"R14_NEW_HISTORICAL_EDGE_STALE_CALLER_REJECTED",
          "newEdgeChangedFingerprint":True,"sameWorkVersion":True,
          "freshPinSourceV4RollbackOnly":True}))
    print(json.dumps({"result":"R14_SCOPED_GALLERY_FIRST_ORDERED_PREFLIGHT_LOCAL_PASS",
      "globalGraphComplete":False,"allKindsEnrolled":False,"releaseAuthorization":False,
      "productionRetryImplemented":False,"signedStagingTested":False}))

if __name__=="__main__":main()
