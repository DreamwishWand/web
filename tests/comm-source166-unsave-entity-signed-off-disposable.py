#!/usr/bin/env python3
"""03 COMM Source166 Unsave Entity only effective failclosed; synthetic disposable only.
Superuser legacy Question is a FIXTURE of an already-published Work, not a supported new Question Writer.
Real ES256 A1/A2 + two distinct PostgreSQL backends, service SQL is NOT public HTTP exploit proof.
"""
import base64
import json
import os
import secrets
import subprocess
import urllib.error
import urllib.request
import uuid
from contextlib import closing
import psycopg
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert all(not os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
API="http://127.0.0.1:54321"; DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
env={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k,v=line.split("=",1);env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")
def req(path,body=None,token=None,service=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
    headers={"apikey":key,"Accept":"application/json"}
    if service: headers["Authorization"]="Bearer "+key
    elif token: headers["Authorization"]="Bearer "+token
    if body is not None:headers["Content-Type"]="application/json"
    request=urllib.request.Request(API+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=35) as res:
            return res.status,json.loads(res.read(100000) or b"null")
    except urllib.error.HTTPError as ex:
        try: result=json.loads(ex.read(100000) or b"{}")
        except Exception: result={}
        return ex.code,result
def claims(jwt,part=1):
    data=jwt.split(".")[part]
    return json.loads(base64.urlsafe_b64decode(data+"="*(-len(data)%4)))
def scalar(c,sql,p=()):return c.execute(sql,p).fetchone()[0]
def mark(key,**data):print(json.dumps({"case":key,**data},sort_keys=True),flush=True)
actor=None
try:
    email="comm-unsave-"+secrets.token_hex(6)+"@example.invalid"
    pw=secrets.token_urlsafe(23)+"A1!"
    status,user=req("/auth/v1/admin/users",{"email":email,"password":pw,"email_confirm":True},service=True)
    assert status in (200,201) and user.get("id")
    actor=uuid.UUID(user["id"])
    def login():
        status,body=req("/auth/v1/token?grant_type=password",{"email":email,"password":pw})
        assert status==200 and body.get("access_token")
        jwt=body["access_token"];head=claims(jwt,0);cl=claims(jwt)
        assert head.get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
        return jwt,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"])),body["refresh_token"]
    a1,c1,refresh1=login();a2,c2,_=login();assert c1[2]!=c2[2]
    status,boot=req("/functions/v1/community-command",{
        "command":"ensureAccountCreator","payload":{
          "handle":"qa_"+secrets.token_hex(7),"displayName":"Local Unsave166 OFF Probe"}},token=a1)
    assert status==200 and boot.get("ok"),("A0_BOOTSTRAP_INVALID",status)
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])
    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==166
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signature="public.community_unsave_entity(uuid,uuid)"
        roles={role:scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,signature))
             for role in ("anon","authenticated","service_role")}
        assert roles=={"anon":False,"authenticated":False,"service_role":False},roles
        for sig in [
          "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
          "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
          "public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)",
          "public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)",
          "public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)",
          "public.community_add_reaction(uuid,uuid,text)",
          "public.community_save_entity(uuid,uuid)"
        ]:
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)),sig
        for sig in [
          "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
          "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
          "public.community_get_ddv_profile_workspaces_v1(uuid)"
        ]:
            assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)),sig
        mark("SOURCE166_UNSAVE_ENTITY_THREE_ROLE_SQL_EXECUTE_OFF",
            signedR16AndWorkspacePositiveGrantsIntact=True,
            oldSource157_163RetiredWritersRemainOff=True)
        # Source160 Question public Writer remains OFF. Previous published
        # Question fixture is created by disposable local DB owner ONLY.
        q=scalar(pre,"""select public.community_ask_question_v1(
            %s,%s,'Disposable reaction negative Question','Not actual user content',
            %s::text[],'switch','1.25.0',%s)""",
            (actor,creator,["local_fixture"],"fixture-"+secrets.token_hex(8)))
        assert isinstance(q,dict) and q.get("questionId"),"LOCAL_POSITIVE_FIXTURE_INVALID"
        target=uuid.UUID(q["questionId"])
        assert scalar(pre,"select private.can_access_entity(%s,%s)",(target,account))
        # DB owner seeds one already-saved, synthetic local Question.
        # Source165 externally callable Save Entity remains OFF.
        assert not scalar(pre,"select has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')")
        seeded=scalar(pre,"select public.community_save_entity(%s,%s)",(actor,target))
        assert isinstance(seeded,dict) and seeded.get("saved") is True
        def snapshot():
            return scalar(pre,"select count(*) from public.saved_items where account_id=%s and target_entity_id=%s",(account,target))
        def direct(role):
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    scalar(writer,"select public.community_unsave_entity(%s,%s)",(actor,target))
                return "UNEXPECTED_COMMIT"
            except psycopg.Error as error:
                return str(error.sqlstate or "UNKNOWN")
        def edge(token):
            return req("/functions/v1/community-command",{"command":"unsaveEntity",
                "payload":{"targetEntityId":str(target)}},token=token)
        baseline=snapshot()
        assert baseline==1,"SEED_SAVED_ITEM_MISSING"
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,"SIGNED_A2_NOT_HEALTHY"
        status,body=edge(a2)
        assert status==409 and body.get("error")=="SOURCE166_UNSAVE_ENTITY_WRITER_NOT_ENROLLED",(status,body)
        for role in ("anon","authenticated","service_role"):
            assert direct(role)=="42501",role
        assert snapshot()==baseline,"ELIGIBLE_A2_SAVED_ITEM_CHANGED"
        mark("SOURCE166_ELIGIBLE_SIGNED_A2_EDGE409_SQL42501_NO_DIFF",
             realGoTrueES256=True,twoDifferentPG=True,noSavedItemsMutation=True)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        jwt=refresh["access_token"]
        assert claims(jwt)["session_id"]==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=jwt)
        assert status==401
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200
        for token in (a1,jwt):
            status,_=edge(token)
            assert status==401,("REVOKED_UNSAVE_EDGE_NOT_401",status)
        for _ in range(5):
            assert direct("service_role")=="42501"
        assert snapshot()==baseline,"REVOKED_SQL_CHANGED_SAVED_ITEMS"
        mark("SOURCE166_REVOKED_A1_ORIGINAL_REFRESH401_TWO_PG_REPLAY_NO_DIFF",
             healthySiblingA2_200=True,noSavedItemsMutation=True,
             serviceRoleFiveSqlReplay42501=True)
        pre.execute("begin")
        try:
            pre.execute("grant execute on function "+signature+" to service_role")
            assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
            assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
        finally:
            pre.execute("rollback")
        assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
        assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
        assert snapshot()==baseline
        mark("SOURCE166_TEMP_GRANT_TWO_PG_ROLLBACK_DENIED",
             uncommittedGrantInvisible=True,sqlWriterStillOff=True,noSavedItemsDiff=True)
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
