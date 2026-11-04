#!/usr/bin/env python3
"""03 COMM W-COMM-006: Source162 genuine signed Gallery Photo parent OFF.
Source161 PR426 prior direct privileged SQL post-revoke RED retained.
Local-only synthetic verified subject + synthetic READY media metadata, no
physical file, Provider or real source rights. Direct SQL and actual JWT are
different trust boundaries. Owner gate is NOT independent QA.
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
assert all(not os.getenv(k) for k in
           ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
env={}
for s in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in s:
        k,v=s.split("=",1)
        env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")

def req(path,body=None,token=None,service=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
    h={"apikey":key,"Accept":"application/json"}
    if service:h["Authorization"]="Bearer "+key
    elif token:h["Authorization"]="Bearer "+token
    if body is not None:h["Content-Type"]="application/json"
    r=urllib.request.Request(API+path,headers=h,method=method,
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(r,timeout=35) as res:
            return res.status,json.loads(res.read(100000) or b"null")
    except urllib.error.HTTPError as err:
        raw=err.read(100000)
        try:payload=json.loads(raw)
        except Exception:payload={}
        return err.code,payload

def claims(token,index=1):
    part=token.split(".")[index]
    return json.loads(base64.urlsafe_b64decode(part+"="*(-len(part)%4)))

def mark(key,value):
    print(json.dumps({"case":key,**value},sort_keys=True),flush=True)

def scalar(c,sql,p=()):return c.execute(sql,p).fetchone()[0]

actor=None
try:
    e="comm-gallerydraft-"+secrets.token_hex(7)+"@example.invalid"
    pw=secrets.token_urlsafe(25)+"A1!"
    st,u=req("/auth/v1/admin/users",{"email":e,"password":pw,"email_confirm":True},service=True)
    assert st in (200,201) and u.get("id"),"LOCAL_CREATE_USER_FAILED"
    actor=uuid.UUID(u["id"])
    def login():
        s,x=req("/auth/v1/token?grant_type=password",{"email":e,"password":pw})
        assert s==200 and x.get("access_token")
        jwt=x["access_token"];head=claims(jwt,0);cl=claims(jwt,1)
        assert head.get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
        return jwt,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"])),x.get("refresh_token")
    a1,c1,refresh1=login()
    a2,c2,refresh2=login()
    assert c1[2]!=c2[2]
    st,boot=req("/functions/v1/community-command",{"command":"ensureAccountCreator","payload":{
        "handle":"qa_"+secrets.token_hex(7),"displayName":"Gallery Draft isolated owner"}},token=a1)
    assert st==200 and boot.get("ok"),"A0_REAL_SIGNED_BOOTSTRAP_FAILED"
    data=boot["data"]
    account=uuid.UUID(data["accountId"])
    creator=uuid.UUID(data["creatorProfileId"])






    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==162
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        photo="public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)"
        direct_old=[
          "public.community_create_gallery_work_v1(uuid,uuid,text,text)",
          "public.community_create_gallery_draft(uuid,uuid,text,text,text)",
          "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
          "public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)"
        ]
        for sig in [photo]+direct_old:
            for role in ("anon","authenticated","service_role"):
                assert not scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig,)),(sig,role)
        for preserve in [
          "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
          "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
          "public.community_get_ddv_profile_workspaces_v1(uuid)"]:
            assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(preserve,))
        mark("SOURCE162_PHOTO_DIRECT_SQL_CATALOG_ROLES_OFF",{
           "photoParentThreeRoleExecuteDenied":True,
           "source161GalleryDraftCreateDirectOff":True,
           "help160OffAndSignedR16DeleteReadIntact":True})

        def metadata():
            subject,media=uuid.uuid4(),uuid.uuid4()
            with pre.transaction():
                pre.execute("""insert into public.gallery_verified_subjects(
                    subject_id,gallery_kind,subject_type,canonical_target_id,
                    platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
                    values(%s,'outdoor','biome',%s,'switch','1.25.0',
                      '52BD625D9B4E0053',624,'local-synthetic-no-game-rights','verified')""",
                    (subject,"disposable-source162-"+secrets.token_hex(9)))
                pre.execute("""insert into public.community_entities(entity_id,entity_type)
                    values(%s,'media_asset')""",(media,))
                pre.execute("""insert into public.media_assets(
                    media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
                    checksum_sha256,processing_state,moderation_state)
                    values(%s,%s,%s,'image/png',100,10,10,%s,'ready','clear')""",
                    (media,account,"local/no-provider/imaginary-photo/"+str(media),"a"*64))
            return subject,media

        def snapshot():
            return pre.execute("""select
              (select count(*) from public.community_works where owner_account_id=%s and work_type='gallery'),
              (select count(*) from public.gallery_works g join public.community_works w
                on w.work_id=g.work_id where w.owner_account_id=%s),
              (select count(*) from public.community_work_revisions r join public.community_works w
                on w.work_id=r.work_id where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.gallery_work_revisions r join public.community_work_revisions cr
                on cr.revision_id=r.revision_id join public.community_works w
                on w.work_id=cr.work_id where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.gallery_photo_subjects where owner_account_id=%s),
              (select count(*) from public.work_revision_media m join public.community_work_revisions r
                on r.revision_id=m.work_revision_id join public.community_works w
                on w.work_id=r.work_id where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.search_documents d join public.community_works w
                on w.work_id=d.work_id where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.outbox_events o join public.community_works w
                on w.work_id=o.aggregate_id where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.idempotency_keys where account_id=%s
                and command_name in ('community_publish_gallery_photo_v1','community_create_gallery_work_v1','community_publish_gallery_v4')),
              (select count(*) from public.gallery_photo_revision_fields f join public.community_work_revisions r
                on r.revision_id=f.revision_id join public.community_works w
                on w.work_id=r.work_id where w.owner_account_id=%s and w.work_type='gallery')
            """,(account,)*10).fetchone()

        def direct(subject,media,role):
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    scalar(writer,"""select public.community_publish_gallery_photo_v1(
                        %s,%s,NULL::uuid,NULL::bigint,'outdoor',%s,
                        'Disposable Photo','Not published',
                        %s::uuid[],%s,true,%s)""",
                        (actor,creator,subject,[media],media,
                         "source162-photo-"+secrets.token_hex(8)))
                return "UNEXPECTED_COMMIT"
            except psycopg.Error as ex:
                return str(ex.sqlstate or "UNKNOWN")

        def edge(token,subject,media):
            return req("/functions/v1/community-command",{"command":"publishGalleryPhoto",
             "payload":{"creatorProfileId":str(creator),"galleryKind":"outdoor",
               "subjectId":str(subject),"title":"Disposable Photo",
               "description":"Not published","mediaIds":[str(media)],
               "coverMediaId":str(media),"originalityAttested":True,
               "idempotencyKey":"source162-photo-"+secrets.token_hex(8)}},
             token=token)

        subject,media=metadata()
        before=snapshot()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,result=edge(a2,subject,media)
        assert status==409 and result.get("error")=="SOURCE162_GALLERY_PHOTO_WRITER_NOT_ENROLLED",(status,result)
        for role in ("anon","authenticated","service_role"):
            assert direct(subject,media,role)=="42501",("SOURCE162_ACL_FAILED",role)
        assert snapshot()==before,("LIVE_A2_PHOTO_DB_CHANGED",before,snapshot())
        mark("SOURCE162_PHOTO_A2_EDGE409_THREE_ROLE_SQL42501_NO_DIFF",{
          "realGenuineSignedA2":True,"allThreeRolesDenied":True,
          "photoPublicGraphUnchanged":True,"syntheticMetadataOnly":True})

        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("A1_NOT_REVOKED",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("A2_SIBLING_NOT_HEALTHY",status)
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        assert claims(refresh["access_token"],1)["session_id"]==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=refresh["access_token"])
        assert status==401,("A1_REFRESH_NOT_REVOKED",status)
        for token in (a1,refresh["access_token"]):
            status,_=edge(token,subject,media)
            assert status==401,("REVOKED_PHOTO_EDGE_NOT_401",status)
        for _ in range(2):
            assert direct(subject,media,"service_role")=="42501"
        assert snapshot()==before,"SOURCE162_POSTREVOKE_PUBLIC_PHOTO_DB_CHANGED"
        mark("SOURCE162_PHOTO_A1_OLD_REFRESHED_401_TWO_PG_REPLAY42501_NO_DIFF",{
          "oldAndRefreshedA1Edge401":True,"healthySignedA2Http200":True,
          "twoActualPostgresqlBackends":True,"repeatedDirectSQL42501":True,
          "galleryRevisionMediaSearchOutboxIdemUnchanged":True})

        # Explicit uncommitted local temporary Grant must stay invisible
        # to writer in a second PG backend, then rollback leaves OFF.
        pre.execute("begin")
        try:
            pre.execute("grant execute on function "+photo+" to service_role")
            assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(photo,))
            assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(photo,))
        finally:
            pre.execute("rollback")
        assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(photo,))
        assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(photo,))
        assert snapshot()==before
        mark("SOURCE162_PHOTO_TEMP_GRANT_ROLLBACK_STILL_OFF",{
          "noOtherPgGrantLeak":True,"effectivePhotoParentServiceRoleOff":True,
          "noPublicGalleryWorkOrMediaDiff":True})
        mark("SOURCE162_PHOTO_SIGNED_LOCAL_OWNER_ONLY_COMPLETE",{
          "source154_161SQLImmutable":True,"providerPhysicalObjectUsed":False,
          "productWriterEnabled":False,"independentQa":"NOT_RUN"})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
