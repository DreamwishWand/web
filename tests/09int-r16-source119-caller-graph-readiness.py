#!/usr/bin/env python3
"""09 INT R16: exact Owner119 ACTUAL PostgreSQL RPC readiness only.
No R11-R15 concurrency replay, no mutation, no signed staging.
CI success means capability-gap detection, NOT R16 positive acceptance.
"""
import json, os
from pathlib import Path
import psycopg

def main():
    assert os.getenv("DDVRE_R16_ISOLATED_LOCAL") == "CONFIRMED"
    dsn=os.getenv("DDVRE_R16_POSTGRES_DSN")
    assert dsn=="postgresql://postgres:postgres@127.0.0.1:54322/postgres","REFUSE_UNKNOWN_DSN"
    with psycopg.connect(dsn,autocommit=True) as db:
        n=db.execute("select count(*),count(distinct version) from supabase_migrations.schema_migrations").fetchone()
        assert n==(119,119),("EXPECTED_EXACT_SOURCE119",n)
        found=db.execute("""
          select p.oid::regprocedure::text,p.proargnames,pg_get_functiondef(p.oid)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='community_publish_gallery_v4'
        """).fetchall()
        assert len(found)==1,("UNEXPECTED_GALLERY_V4_SIGNATURE_SET",len(found))
        signature,args,body=found[0]
        args=args or []
        assert "p_expected_version" in args and "p_idempotency_key" in args
        has_sha=any("graph" in a.lower() and ("sha" in a.lower() or "digest" in a.lower()) for a in args)
        has_registry=any("registry" in a.lower() and "version" in a.lower() for a in args)
        assert not has_sha and not has_registry,"OWNER_CHANGED: RE-PIN & RUN R16 POSITIVE TESTS"
        assert "private.gallery_v4_atomic_lock_scoped_r14" in body
        internal=db.execute("""
          select p.proname,pg_get_functiondef(p.oid)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='private' and
                p.proname in ('gallery_v4_scoped_graph_r14','gallery_v4_atomic_lock_scoped_r14')
        """).fetchall()
        assert len(internal)==2
        graph=next(source for name,source in internal if name=="gallery_v4_scoped_graph_r14")
        assert "gallery-scene-scoped@r14" in graph and "historicalPresetLinks" in graph
    edge=Path("supabase/functions/community-command/index.ts").read_text()
    begin=edge.index("case 'publishGallery':")
    end=edge.index("case '",begin+len("case 'publishGallery':"))
    dispatch=edge[begin:end]
    assert "p_expected_version" in dispatch and "p_idempotency_key" in dispatch
    assert "expectedGraph" not in dispatch and "p_expected_graph" not in dispatch
    assert "['40P01','55P03','40001']" in edge
    assert "community_authorize_session" in edge
    print(json.dumps({
      "phase":"R16","classification":"SOURCE_CONTRACT_NEGATIVE_ONLY",
      "ownerSourceCommit":"7414e0666a2afa55709b874d3e2dee5fbd970df9",
      "migrations":119,"actualSourceRpc":signature,"sourceRpcArguments":args,
      "callerExpectedGraphAccepted":False,"registryVersionAccepted":False,
      "edgeCallerGraphForwarding":False,"internalScopedGraphExists":True,
      "realTwoSessionStaleFreshReplayExecuted":False,
      "r16CallerGraphAcceptance":"BLOCKED_OWNER_API_NOT_IMPLEMENTED",
      "graphComplete":False,"retirementAuthorized":False,
      "ciPassIsNotPositiveAcceptance":True
    },sort_keys=True))

if __name__=="__main__":
    main()
