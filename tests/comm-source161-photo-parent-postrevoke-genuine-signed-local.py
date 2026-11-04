#!/usr/bin/env python3
"""W-COMM-006 Source161: test-only signed Gallery Photo nested legacy RPC.
Two genuinely signed GoTrue sessions + independent PostgreSQL connections,
but only synthetic eligible subject/media METADATA in disposable local DB.
No actual Provider file, real game rights validation or public HTTP exploit.
Do not merge/release from this probe; Photo remains OFF.
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
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==161
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")

        signatures={
          "createGalleryWork":"public.community_create_gallery_work_v1(uuid,uuid,text,text)",
          "publishGalleryPhoto":"public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)"
        }
        assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",
                          (signatures["createGalleryWork"],))
        assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",
                      (signatures["publishGalleryPhoto"],))
        row=pre.execute("select p.prosecdef,p.prosrc from pg_proc p where p.oid=to_regprocedure(%s)",
                        (signatures["publishGalleryPhoto"],)).fetchone()
        assert row and row[0]
        assert "community_create_gallery_work_v1" in row[1]
        assert "community_authorize_signed_session_v2" not in row[1]
        mark("SOURCE161_PHOTO_NESTED_SQL_CATALOG",{
            "directLegacyCreateServiceRoleExecute":False,
            "photoParentServiceRoleExecute":True,
            "photoParentSecurityDefiner":True,
            "nestedCallPresent":True,
            "sameTransactionSignedSessionGuard":False})

        def new_metadata():
            subject,media=uuid.uuid4(),uuid.uuid4()
            with pre.transaction():
                pre.execute("""insert into public.gallery_verified_subjects(
                    subject_id,gallery_kind,subject_type,canonical_target_id,
                    platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
                    values(%s,'outdoor','biome',%s,'switch','1.25.0',
                      '52BD625D9B4E0053',624,'local-synthetic-no-game-rights','verified')""",
                    (subject,"disposable-source161-"+secrets.token_hex(9)))
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

        def publish(subject,media,key):
            try:
                with writer.transaction():
                    writer.execute("set local role service_role")
                    obj=scalar(writer,"""select public.community_publish_gallery_photo_v1(
                        %s,%s,NULL::uuid,NULL::bigint,'outdoor',%s,
                        'Disposable Gallery Photo','Not for public publication',
                        %s::uuid[],%s,true,%s)""",
                        (actor,creator,subject,[media],media,key))
                return "COMMITTED",obj
            except psycopg.Error as e:
                return "REJECTED",str(e.sqlstate or "UNKNOWN")+" "+str(e)[:230]

        # ACTUAL eligible SQL control BEFORE local revoke; this does NOT
        # attest game-image rights or physical Provider object availability.
        subject1,media1=new_metadata()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        old=snapshot()
        status,obj=publish(subject1,media1,"source161-photo-live-"+secrets.token_hex(8))
        updated=snapshot()
        diff=[updated[i]-old[i] for i in range(len(old))]
        mark("SOURCE161_PHOTO_ELIGIBLE_A2_SQL_CONTROL",{
          "status":status,"createdOnePublicGalleryWork":status=="COMMITTED" and diff[0]==1,
          "workRevisionsSearchOutboxIdem":diff,"physicalProviderUsed":False,
          "subjectMediaOnlySyntheticMetadata":True})
        assert status=="COMMITTED" and isinstance(obj,dict) and obj.get("workId")
        assert all(d>=1 for d in diff),("PHOTO_POSITIVE_NOT_ELIGIBLE",status,diff,obj)

        # Honest preflight vs committed revoke in separate transaction:
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status1,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        status2,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status1==401 and status2==200,(status1,status2)
        rs,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert rs==200 and refresh.get("access_token")
        assert claims(refresh["access_token"],1).get("session_id")==str(c1[2])
        rs,_=req("/functions/v1/community-query",{"query":"me","payload":{}},
                 token=refresh["access_token"])
        assert rs==401,("REFRESH_A1_NOT_REVOKED",rs)
        mark("SOURCE161_PHOTO_SIGNED_A1_OLD_REFRESHED_REVOKED",{
          "genuineGoTrueES256":True,"oldA1Http401":True,"refreshedA1Http401":True,
          "healthySiblingA2Http200":True,"twoPostgresBackends":True})

        # Independent SQL connection now attempts PHOTO PARENT; Source161
        # external callee EXECUTE revoke may not prevent nested definer call.
        subject2,media2=new_metadata()
        old=snapshot()
        result,obj=publish(subject2,media2,"source161-photo-postrevoke-"+secrets.token_hex(8))
        new=snapshot()
        delta=[new[i]-old[i] for i in range(len(old))]
        passed=(result=="COMMITTED" and isinstance(obj,dict)
            and obj.get("workId") and all(d>=1 for d in delta))
        mark("SOURCE161_PHOTO_PARENT_POSTREVOKE_DIRECT_SQL",{
          "sqlStatus":result,"committedFullPublicGalleryPhoto":bool(passed),
          "dbDomainCountChanges":delta,"signedA1AlreadyRevoked":True,
          "nestedCreateExecRevokedExternally":True,
          "publicHttpExploitProved":False,"providerObjectUploaded":False})
        assert passed,("PHOTO_POSTREVOKE_NOT_REPRODUCED_OR_ONLY_PARTIAL",result,obj,delta)
        mark("SOURCE161_PHOTO_TRANSITIVE_PARENT_SIGNED_LOCAL_SQL_RED",{
          "classification":"CONFIRMED_DISPOSABLE_SQL_SEPARATE_PREFLIGHT_TRUE_RED",
          "evidenceScope":"synthetic eligible media/subject metadata + actual signed issuer + real service_role SQL",
          "directClientHttpExploitProved":False,"stageOrManagedProviderUsed":False,
          "publicGalleryWorkRevisionMediaSearchOutboxIdemMutated":True})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
