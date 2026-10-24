#!/usr/bin/env python3
"""R13 actual two-backend SOURCE test. Local disposable Postgres ONLY.
Separates COMMITTED identity retirement from old JWT-shaped synthetic claims;
does not claim HTTP/JWT actor or in-flight pre-retirement transaction closure.
"""
import json, os, uuid
import psycopg

assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL"), "Refuse remote DATABASE_URL"
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def scalar(c,sql,params=()):
    return c.execute(sql,params).fetchone()[0]

with psycopg.connect(DSN, autocommit=True, connect_timeout=3) as setup:
    owner,active,work=setup.execute("""
        select i.account_id,i.provider_subject::uuid,w.work_id
        from public.auth_identities i
        join public.creator_profiles c on c.owner_account_id=i.account_id
        join public.community_works w on w.owner_account_id=i.account_id
        where c.handle='isolated_bootstrap_creator'
          and i.provider='supabase' and w.work_type='gallery'
        limit 1
    """).fetchone()
    retired=uuid.uuid4()
    session=uuid.uuid4()
    setup.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(owner,str(retired)))
    setup.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(retired,))
    setup.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,retired))
    assert scalar(setup,"select private.resolve_active_account(%s)",(retired,))==owner
    assert scalar(setup,"select private.resolve_active_account(%s)",(active,))==owner
    before_version=scalar(setup,"select row_version from public.community_works where work_id=%s",(work,))
    before_outbox=scalar(setup,"select count(*) from public.outbox_events")
with psycopg.connect(DSN, autocommit=True) as a, psycopg.connect(DSN, autocommit=True) as b:
    assert scalar(a,"select pg_backend_pid()")!=scalar(b,"select pg_backend_pid()")
    # Commit retirement on backend A. B executes its new transaction from
    # CURRENT database identity state rather than trusting stale caller input.
    a.execute("begin")
    a.execute("""update public.auth_identities
      set identity_state='retired',retired_at=clock_timestamp()
      where provider='supabase' and provider_subject=%s""",(str(retired),))
    a.execute("commit")
    issued=scalar(b,"select extract(epoch from clock_timestamp())::bigint")
    probes=[
      ("resolver","select private.resolve_active_account(%s)",(retired,)),
      ("session","select public.community_authorize_session(%s,%s,null)",(retired,issued)),
      ("gallery_writer","select public.community_change_work_visibility(%s,%s,%s,'public',%s)",
        (retired,work,before_version,"r13-two-"+str(uuid.uuid4()))),
      ("gallery_media","select public.community_gallery_owner_media_read_v1(%s,%s)",
        (retired,uuid.uuid4())),
      ("scene_owner","select public.community_scene_revision_readiness_v1(%s,%s)",
        (retired,uuid.uuid4())),
    ]
    for tag,sql,params in probes:
        b.execute("begin")
        try:
            b.execute(sql,params)
            raise AssertionError("R13_RETIRED_ACTOR_AUTHORIZED_"+tag)
        except psycopg.Error as e:
            assert "Active AuthIdentity not found" in str(e),(tag,str(e))
        b.execute("rollback")
    assert scalar(b,"select row_version from public.community_works where work_id=%s",(work,))==before_version
    assert scalar(b,"select count(*) from public.outbox_events")==before_outbox
    assert scalar(b,"select private.resolve_active_account(%s)",(active,))==owner
    # A legitimate current session may still request privacy suppression;
    # a retired history identity cannot request a privacy-deletion action.
    try:
        b.execute("begin")
        b.execute("select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",
                 (retired,session,issued))
        raise AssertionError("R13_RETIRED_PRIVACY_DELETE_AUTHORIZED")
    except psycopg.Error as e:
        assert "Active AuthIdentity not found" in str(e),str(e)
    b.execute("rollback")
    assert scalar(b,"select count(*) from private.account_privacy_suppressions where account_id=%s",(owner,))==0
    print(json.dumps({
      "result":"03COMM_R13_RETIRED_IDENTITY_TWO_BACKEND_SOURCE_PASS",
      "twoDistinctPostgresBackends":True,
      "committedRetirementDeniesResolverAndRegularWriters":True,
      "liveAccountUnchanged":True,
      "currentIdentityStillValid":True,
      "retiredActorCannotRequestPrivacySuppression":True,
      "signedJWTExecuted":False,
      "inflightRetirementGraphLockProved":False,
      "allWriterAtomicityAccepted":False
    }))
