#!/usr/bin/env python3
"""Independent 04 QR: genuine signed isolated FULL161, deny two old Gallery draft Writers.
Never connect to Stage116, managed, Provider or real users. Source161 ONLY.
"""
import base64, json, os, secrets, subprocess, urllib.request, urllib.error, uuid
from contextlib import closing
import psycopg

assert os.environ.get("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert all(not os.environ.get(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
LOCAL="http://127.0.0.1:54321"
PG="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
env={}
for s in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in s:
        k,v=s.split("=",1)
        env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")
def request(path,body=None,auth=None,admin=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if admin else env["ANON_KEY"]
    headers={"apikey":key,"Accept":"application/json"}
    if admin: headers["Authorization"]="Bearer "+key
    if auth: headers["Authorization"]="Bearer "+auth
    if body is not None: headers["Content-Type"]="application/json"
    req=urllib.request.Request(LOCAL+path,headers=headers,method=method,
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=40) as h:
            return h.status,json.loads(h.read(100000) or b'null')
    except urllib.error.HTTPError as e:
        try: return e.code,json.loads(e.read(100000))
        except Exception: return e.code,{}
def claims(token,i=1):
    v=token.split(".")[i]
    return json.loads(base64.urlsafe_b64decode(v+"="*(-len(v)%4)))
def scalar(c,sql,args=()):
    return c.execute(sql,args).fetchone()[0]
def ok(s): print("QR_161_"+s+"_PASS",flush=True)
DENIED={
  "createGalleryDraft":"public.community_create_gallery_draft(uuid,uuid,text,text,text)",
  "createGalleryWork":"public.community_create_gallery_work_v1(uuid,uuid,text,text)"
}
RETAIN={
 "R16":"public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
 "WorkspaceDelete":"public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
 "WorkspaceRead":"public.community_get_ddv_profile_workspaces_v1(uuid)"
}
PRIOR=[
 "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
 "public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)",
 "public.community_create_ddv_profile_workspace_v1(uuid,text)",
 "public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)",
 "public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)",
]
actor=None
try:
    email="qr161-"+secrets.token_hex(9)+"@example.invalid"
    pw=secrets.token_urlsafe(23)+"A1!"
    code,created=request("/auth/v1/admin/users",{"email":email,"password":pw,"email_confirm":True},admin=True)
    assert code in (200,201) and created.get("id")
    actor=uuid.UUID(created["id"])
    def sign_in():
        status,issued=request("/auth/v1/token?grant_type=password",{"email":email,"password":pw})
        assert status==200 and issued.get("access_token") and issued.get("refresh_token")
        token=issued["access_token"];h=claims(token,0);p=claims(token)
        assert h["alg"]=="ES256" and p["sub"]==str(actor) and p.get("session_id")
        return token,issued["refresh_token"],(actor,int(p["iat"]),uuid.UUID(p["session_id"]))
    old,refresh_old,old_session=sign_in()
    active,_,active_session=sign_in()
    assert old_session[2]!=active_session[2]
    code,res=request("/functions/v1/community-command",{"command":"ensureAccountCreator",
       "payload":{"handle":"qr161_"+secrets.token_hex(6),"displayName":"QA161 local creator"}},auth=active)
    assert code==200 and res.get("ok"),(code,res.get("error"))
    account=uuid.UUID(res["data"]["accountId"])
    creator=uuid.UUID(res["data"]["creatorProfileId"])
    with closing(psycopg.connect(PG,autocommit=True)) as control,closing(psycopg.connect(PG,autocommit=True)) as worker:
        assert scalar(control,"select count(*) from supabase_migrations.schema_migrations")==161
        assert scalar(control,"select pg_backend_pid()")!=scalar(worker,"select pg_backend_pid()")
        for signature in DENIED.values():
            for role in ("anon","authenticated","service_role"):
                assert not scalar(control,"select has_function_privilege(%s,%s,'EXECUTE')",(role,signature)),(role,signature)
        for signature in RETAIN.values():
            assert scalar(control,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
        for signature in PRIOR:
            assert not scalar(control,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
        ok("EXACT_GALLERY_TWO_RPC_THREE_ROLE_ACL_PRIOR160_INVARIANT")
        def snapshot():
            return control.execute("""select
                (select count(*) from public.community_works where owner_account_id=%s and work_type='gallery'),
                (select count(*) from public.gallery_works g join public.community_works w on w.work_id=g.work_id where w.owner_account_id=%s),
                (select count(*) from public.community_entities e join public.community_works w on w.work_id=e.entity_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.outbox_events o join public.community_works w on w.work_id=o.aggregate_id where w.owner_account_id=%s and w.work_type='gallery'),
                (select count(*) from public.idempotency_keys where account_id=%s and command_name in ('create_gallery_draft','create_gallery_work_v1')),
                (select count(*) from public.search_documents s join public.community_works w on w.work_id=s.work_id where w.owner_account_id=%s and w.work_type='gallery')
                """,(account,)*6).fetchone()
        before=snapshot()
        def sql_try(op,role,key):
            if op=="createGalleryDraft":
                statement="select public.community_create_gallery_draft(%s,%s,'private','outdoor',%s)"
            else:
                statement="select public.community_create_gallery_work_v1(%s,%s,'outdoor',%s)"
            try:
                with worker.transaction():
                    worker.execute("set local role "+role)
                    worker.execute(statement,(actor,creator,key)).fetchone()
            except psycopg.Error as e:
                assert e.sqlstate=="42501",(op,role,e.sqlstate)
                return
            raise AssertionError("SQL_WRITER_COMMITTED_AFTER_SOURCE161_"+op)
        def edge(token,op):
            return request("/functions/v1/community-command",{"command":op,"payload":{
                "creatorProfileId":str(creator),"visibility":"private","galleryKind":"outdoor",
                "idempotencyKey":"qr161-"+secrets.token_hex(13)}},auth=token)
        scalar(control,"select public.community_authorize_signed_session_v2(%s,%s,%s)",active_session)
        for op in DENIED:
            status,response=edge(active,op)
            assert status==409 and response.get("error")=="SOURCE161_GALLERY_DRAFT_WRITER_NOT_ENROLLED",(op,status,response)
            for role in ("anon","authenticated","service_role"):
                sql_try(op,role,"qr161-legacy-"+secrets.token_hex(12))
        assert snapshot()==before
        ok("VALID_A2_BOTH_EDGE409_SIX_DIRECT_SQL42501_GALLERY_DB_NO_DIFF")
        scalar(control,"select public.community_authorize_signed_session_v2(%s,%s,%s)",old_session)
        scalar(control,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",old_session)
        assert request("/functions/v1/community-query",{"query":"me","payload":{}},auth=old)[0]==401
        assert request("/functions/v1/community-query",{"query":"me","payload":{}},auth=active)[0]==200
        status,ref=request("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh_old})
        assert status==200 and ref.get("access_token") and claims(ref["access_token"])["session_id"]==str(old_session[2])
        assert request("/functions/v1/community-query",{"query":"me","payload":{}},auth=ref["access_token"])[0]==401
        for token in (old,ref["access_token"]):
            for op in DENIED: assert edge(token,op)[0]==401
        for op in DENIED:
            for _ in range(4): sql_try(op,"service_role","qr161-replay-"+secrets.token_hex(12))
        assert snapshot()==before
        ok("REVOKED_OLD_AND_REFRESH_A1_401_LIVE_A2_200_REPLAY_SQL_DENY")
        with control.transaction(force_rollback=True):
            for sig in DENIED.values():
                control.execute("grant execute on function "+sig+" to service_role")
                assert scalar(control,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
                assert not scalar(worker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        for sig in DENIED.values():
            assert not scalar(control,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
            assert not scalar(worker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        assert snapshot()==before
        ok("INDEPENDENT_TWO_PG_GRANT_ROLLBACK_UNCHANGED_GALLERY")
        ok("SIGNED_ES256_FULL161_DIRECT_RPC_OFF_SCOPED_NOT_PHOTO_PARENT")
finally:
    if actor:
        try: request("/auth/v1/admin/users/"+str(actor),admin=True,method="DELETE")
        except Exception: pass
