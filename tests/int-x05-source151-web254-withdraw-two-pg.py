#!/usr/bin/env python3
"""09 INT combined candidate only, after immutable Source151 full151 synthetic fixture.
Validates real PG -> normalized Source150 envelope -> WEB adapter safety, then withdraw.
No real bearer, approved policy, media or provider is used.
"""
import json,os,time,uuid,psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(db,sql,args=()):
    return db.execute(sql,args).fetchone()[0]
def caller(db,subject,query,args=()):
    with db.transaction():
        db.execute("set local role authenticated")
        claims={"role":"authenticated","sub":str(subject),"session_id":str(uuid.uuid4()),
                "iat":int(time.time()),"is_anonymous":False}
        db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
        db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
        db.execute("select set_config('request.jwt.claim.role',%s,true)",("authenticated",))
        try:
            with db.transaction():
                value=one(db,query,args)
            return ("ok",value)
        except psycopg.Error as exc:
            return ("blocked",exc.sqlstate,str(exc).split("\n")[0][:140])
with psycopg.connect(DSN,autocommit=True) as db, psycopg.connect(DSN,autocommit=True) as other:
    assert one(db,"select count(*) from supabase_migrations.schema_migrations")==151
    assert one(db,"select pg_backend_pid()") != one(other,"select pg_backend_pid()")
    entries=db.execute("""select ctl.work_id, ai.provider_subject
       from private.dreamsnap_x05_work_control_v1 ctl
       join public.auth_identities ai on ai.account_id=ctl.owner_account_id
       where ai.provider='supabase' and ai.identity_state='active'""").fetchall()
    assert len(entries)==1, len(entries)
    work,subject=entries[0]
    assert one(db,"select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(work,))==1
    before=one(db,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))
    query="""select public.community_dreamsnap_x05_owner_action_v1(
       %s,%s,%s,'withdraw',null,null,null,null,null,null,null)"""
    result=caller(other,subject,query,(work,1,1))
    assert result[0]=='ok', result
    action=result[1]
    assert action["publicActivationAllowed"] is False
    assert action["result"]["rowVersion"]==2
    assert action["result"]["authorizationEpoch"]==2
    current=action["owner"]
    assert current["contractVersion"]=="wand.dreamsnaps.owner-management-service@1"
    assert current["rowVersion"]==2 and current["authorizationEpoch"]==2
    assert current["imageGrant"]["consentRevision"]==1
    assert current["imageGrant"]["state"]=="withdrawn"
    assert current["erasure"]["state"]=="PUBLIC_DISABLED"
    assert current["erasure"]["physicalPurgeVerified"] is False
    assert current["capabilities"]["publicMedia"] is False
    assert one(db,"select visibility from public.community_works where work_id=%s",(work,))=="private"
    assert one(db,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))==before+1
    assert caller(other,subject,query,(work,1,1))[0]=="blocked"
    assert one(db,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))==before+1
    assert caller(other,uuid.uuid4(),"select public.community_dreamsnap_x05_owner_read_v1(%s)",(work,))[0]=="blocked"
    assert caller(other,subject,"select public.community_dreamsnap_x05_pregrant_read_v1(%s)",(work,))[0]=="blocked"
    envelope={"ok":True,"operation":"read",
              "contractVersion":"wand.dreamsnaps.owner-management-service@1",
              "data":current}
    with open("/tmp/int-x05-source151-web254-pg-bridge.json","w",encoding="utf8") as file:
        json.dump({"workId":str(work),"envelope":envelope},file)
    print("INT_X05_COMBINED_SYNTHETIC_PG_WITHDRAW_CAS_AND_READ_PASS",flush=True)
    print("INT_X05_COMBINED_PG_TO_WEB_OWNER_ENVELOPE_READY",flush=True)
