#!/usr/bin/env python3
"""04 QR: independent 162 Photo SECURITY DEFINER direct parent OFF.
Disposable ES256 GoTrue + two real PostgreSQL backends only.
NO Stage116, Provider, public deployment, source P1G or real media bytes.
"""
import base64,json,os,secrets,subprocess,urllib.request,urllib.error,uuid
from contextlib import closing
import psycopg

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert all(not os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
env={}
for s in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in s:
        k,v=s.split("=",1);env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")
URL="http://127.0.0.1:54321"; DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PHOTO="public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)"
OFF={
 "GalleryDraft":"public.community_create_gallery_draft(uuid,uuid,text,text,text)",
 "GalleryWork":"public.community_create_gallery_work_v1(uuid,uuid,text,text)",
 "HelpQ":"public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
 "HelpTip":"public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)",
 "CommentsLegacy":"public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)",
 "WorkspaceLegacy":"public.community_create_ddv_profile_workspace_v1(uuid,text)",
 "PinnedR15":"public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)"
}
ON={
 "R16Signed":"public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
 "WorkspaceSignedDelete":"public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
 "WorkspaceRead":"public.community_get_ddv_profile_workspaces_v1(uuid)"
}
def http(path,payload=None,jwt=None,admin=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if admin else env["ANON_KEY"]
    h={"apikey":key,"Accept":"application/json"}
    if jwt:h["Authorization"]="Bearer "+jwt
    if admin:h["Authorization"]="Bearer "+key
    if payload is not None:h["Content-Type"]="application/json"
    q=urllib.request.Request(URL+path,headers=h,method=method,
        data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(q,timeout=35) as x:
            return x.status,json.loads(x.read(180000) or b"null")
    except urllib.error.HTTPError as ex:
        try:return ex.code,json.loads(ex.read(180000))
        except Exception:return ex.code,{}
def claims(jwt,i=1):
    v=jwt.split(".")[i]
    return json.loads(base64.urlsafe_b64decode(v+"="*(-len(v)%4)))
def value(pg,query,params=()):return pg.execute(query,params).fetchone()[0]
def passed(s):print("QR162_"+s+"_PASS",flush=True)

actor=None
try:
    usermail="qr162-"+secrets.token_hex(9)+"@example.invalid";pw=secrets.token_urlsafe(25)+"A1!"
    code,u=http("/auth/v1/admin/users",{"email":usermail,"password":pw,"email_confirm":True},admin=True)
    assert code in (200,201) and u.get("id")
    actor=uuid.UUID(u["id"])
    def login():
        c,z=http("/auth/v1/token?grant_type=password",{"email":usermail,"password":pw})
        assert c==200 and z.get("access_token") and z.get("refresh_token")
        t=z["access_token"];h=claims(t,0);j=claims(t)
        assert h["alg"]=="ES256" and j["sub"]==str(actor) and j.get("session_id")
        return t,z["refresh_token"],(actor,int(j["iat"]),uuid.UUID(j["session_id"]))
    a1,old_refresh,s1=login()
    a2,_,s2=login()
    assert s1[2]!=s2[2]
    code,b=http("/functions/v1/community-command",{"command":"ensureAccountCreator",
        "payload":{"handle":"qr162_"+secrets.token_hex(7),"displayName":"Independent Photo QA local"}},jwt=a2)
    assert code==200 and b.get("ok"),(code,b.get("error"))
    account=uuid.UUID(b["data"]["accountId"])
    creator=uuid.UUID(b["data"]["creatorProfileId"])
    with closing(psycopg.connect(DSN,autocommit=True)) as monitor,closing(psycopg.connect(DSN,autocommit=True)) as invoker:
        assert value(monitor,"select count(*) from supabase_migrations.schema_migrations")==162
        assert value(monitor,"select pg_backend_pid()")!=value(invoker,"select pg_backend_pid()")
        for name,signature in {"PhotoParent":PHOTO,**OFF}.items():
            for role in ("anon","authenticated","service_role"):
                assert not value(monitor,"select has_function_privilege(%s,%s,'EXECUTE')",(role,signature)),(name,role)
        for name,signature in ON.items():
            assert value(monitor,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,)),name
        passed("SOURCE162_PARENT_3ROLE_DENY_PRIOR157_161_SIGNED_GRANTS_PRESERVED")
        # Synthetic metadata to ensure this test is not falsely passing only
        # because Gallery Photo subject/media dependencies do not exist.
        subject=uuid.uuid4();media=uuid.uuid4()
        with monitor.transaction():
            monitor.execute("""insert into public.gallery_verified_subjects
            (subject_id,gallery_kind,subject_type,canonical_target_id,platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
            values (%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',624,'SYNTHETIC-QA-NOT-RIGHTS','verified')""",
            (subject,"qr162-subj-"+secrets.token_hex(9)))
            monitor.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
            monitor.execute("""insert into public.media_assets
            (media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
            values(%s,%s,%s,'image/png',101,10,10,%s,'ready','clear')""",
            (media,account,"synthetic/qr162/not-real-provider/"+str(media),"f"*64))
        def footprint():
            return monitor.execute("""select
                (select count(*) from public.community_works where owner_account_id=%s and work_type='gallery'),
                (select count(*) from public.gallery_works g join public.community_works w on g.work_id=w.work_id where w.owner_account_id=%s),
                (select count(*) from public.community_work_revisions r join public.community_works w on r.work_id=w.work_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.gallery_work_revisions r join public.community_work_revisions cr on r.revision_id=cr.revision_id join public.community_works w on cr.work_id=w.work_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.gallery_photo_subjects where owner_account_id=%s),
                (select count(*) from public.work_revision_media m join public.community_work_revisions r on m.work_revision_id=r.revision_id join public.community_works w on r.work_id=w.work_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.search_documents s join public.community_works w on s.work_id=w.work_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.outbox_events o join public.community_works w on o.aggregate_id=w.work_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.idempotency_keys where account_id=%s and command_name in ('community_publish_gallery_photo_v1','community_create_gallery_work_v1','community_publish_gallery_v4')),
                (select count(*) from public.gallery_photo_revision_fields f join public.community_work_revisions r on f.revision_id=r.revision_id join public.community_works w on r.work_id=w.work_id where w.owner_account_id=%s and w.work_type='gallery')
                """,(account,)*10).fetchone()
        baseline=footprint()
        def edge(jwt):
            return http("/functions/v1/community-command",{"command":"publishGalleryPhoto","payload":{
                "creatorProfileId":str(creator),"galleryKind":"outdoor","subjectId":str(subject),
                "title":"QA Photo Not Published","description":"synthetic only","mediaIds":[str(media)],
                "coverMediaId":str(media),"originalityAttested":True,
                "idempotencyKey":"qr162-http-"+secrets.token_hex(9)}},jwt=jwt)
        def direct(role):
            sql="""select public.community_publish_gallery_photo_v1(
            %s,%s,NULL::uuid,NULL::bigint,'outdoor',%s,'QA Photo Not Published',
            'synthetic only',%s::uuid[],%s,true,%s)"""
            try:
                with invoker.transaction():
                    invoker.execute("set local role "+role)
                    invoker.execute(sql,(actor,creator,subject,[media],media,"qr162-replay-"+secrets.token_hex(11))).fetchone()
            except psycopg.Error as e:
                assert e.sqlstate=="42501",(role,e.sqlstate)
                return
            raise AssertionError("PHOTO_PARENT_DIRECT_SQL_COMMIT_AFTER_162")
        value(monitor,"select public.community_authorize_signed_session_v2(%s,%s,%s)",s2)
        code,res=edge(a2)
        assert code==409 and res.get("error")=="SOURCE162_GALLERY_PHOTO_WRITER_NOT_ENROLLED",(code,res)
        for role in ("anon","authenticated","service_role"):direct(role)
        assert footprint()==baseline
        passed("SIGNED_LIVE_A2_409_PHOTO_3ROLE_SQL42501_GRAPH_DB_NO_DIFF")
        value(monitor,"select public.community_authorize_signed_session_v2(%s,%s,%s)",s1)
        value(monitor,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",s1)
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},jwt=a1)[0]==401
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},jwt=a2)[0]==200
        code,rr=http("/auth/v1/token?grant_type=refresh_token",{"refresh_token":old_refresh})
        assert code==200 and rr.get("access_token") and claims(rr["access_token"])["session_id"]==str(s1[2])
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},jwt=rr["access_token"])[0]==401
        for t in (a1,rr["access_token"]):assert edge(t)[0]==401
        for _ in range(5):direct("service_role")
        assert footprint()==baseline
        passed("REVOKED_ORIGINAL_REFRESHED_A1_401_SIBLING_A2_200_5REPLAY_NO_DIFF")
        with monitor.transaction(force_rollback=True):
            monitor.execute("grant execute on function "+PHOTO+" to service_role")
            assert value(monitor,"select has_function_privilege('service_role',%s,'EXECUTE')",(PHOTO,))
            assert not value(invoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(PHOTO,))
        assert not value(monitor,"select has_function_privilege('service_role',%s,'EXECUTE')",(PHOTO,))
        assert not value(invoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(PHOTO,))
        direct("service_role")
        assert footprint()==baseline
        passed("TWO_PG_TEMP_GRANT_ROLLBACK_PHOTO_R16_UNCHANGED")
        passed("INDEPENDENT_TRUE_ES256_FULL162_PARENT_ONLY_NOT_MANAGED")
finally:
    if actor:
        try:http("/auth/v1/admin/users/"+str(actor),admin=True,method="DELETE")
        except Exception:pass
