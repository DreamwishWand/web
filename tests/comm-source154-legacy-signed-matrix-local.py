#!/usr/bin/env python3
"""REAL GoTrue ES256 FULL154 legacy-route matrix, never a mock JWT. Isolated only.

Inherits frozen PR308 R01-R10 setup as a *fixture*, not a new acceptance.
Sanitized markers contain statuses/booleans only; no JWT, IDs, URL, private data.
RED is a verified owner-capable old signed session crossing a legacy route.
"""
import os,sys
from pathlib import Path
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source153-server-session-signed-e2.py")
src=p.read_text()
needle='    marker("R02-LOCAL-A1-REVOKE","REAL_SOURCE153_A1_401_A2_200_B_M_403_CUTOFF_UNCHANGED",401)'
assert src.count(needle)==1, "FROZEN_SOURCE154_FIXTURE_CHANGED"
added=r'''
    # Exact legacy Edge paths; use ONLY local signed Access JWTs. A1 was
    # terminally revoked. A2 remains authorized, B/M are independent actors.
    # Every probe includes independent ACL/positive-control classification.
    # No response body, signed URL, user ID, secret or raw DB row is logged.
    with db.transaction():
      db.execute("insert into public.account_roles(account_id,role) values(%s,'moderator') on conflict do nothing",(account["A"],))
    legacy_probes=[
      ("query-me","community-query",{"query":"me","payload":{}}),
      ("query-myDreamsnaps","community-query",{"query":"myDreamsnaps","payload":{"limit":10}}),
      ("command-workspace-writer","community-command",{"command":"createDdvProfileWorkspace",
         "payload":{"relationshipKind":"self"}}),
      ("media-owner-read","community-media",{"action":"read","mediaId":str(mp)}),
      ("admin-moderator-read","community-admin",{"operation":"listOperationsAlerts","payload":{"limit":10}}),
      ("preset-revision-readiness","wep-preset-artifact",{"action":"revisionReadiness",
         "presetArtifactId":str(uuid.uuid4())}),
      ("scene-product-failclosed","wep-scene-preset-product",{"action":"publish"})
    ]
    bypass=[]
    for name,edge,body in legacy_probes:
      def call(tok):
        state,headers,payload=http("/functions/v1/"+edge,body=body,token=tok)
        # Cache headers are independently reported, never hide route results.
        # Missing headers are a second issue, not reason to stop the matrix.
        private_header="no-store" in {k.lower():v for k,v in headers.items()}.get("cache-control","").lower()
        if not private_header:marker("L-HEADER-"+edge,"PRIVATE_NO_STORE_MISSING",state)
        return state,payload
      baseline_workspace=scalar("select count(*) from public.ddv_profile_workspaces where account_id=%s",(account["A"],)) if name=="command-workspace-writer" else None
      active,ar=call(a2)
      after_active_workspace=scalar("select count(*) from public.ddv_profile_workspaces where account_id=%s",(account["A"],)) if name=="command-workspace-writer" else None
      revoked,rr=call(a1)
      after_revoked_workspace=scalar("select count(*) from public.ddv_profile_workspaces where account_id=%s",(account["A"],)) if name=="command-workspace-writer" else None
      if name=="command-workspace-writer":
        marker("L-WRITER-DB","A2_INSERTED_"+str(after_active_workspace==baseline_workspace+1)+
          "_REVOKED_A1_INSERTED_"+str(after_revoked_workspace==after_active_workspace+1))
      foreign_b,br=call(users["B"]["token"])
      foreign_m,mr=call(users["M"]["token"])
      active_private=active==200 and isinstance(ar,dict) and ar.get("ok") is True
      revoked_private=revoked==200 and isinstance(rr,dict) and rr.get("ok") is True
      # 409 on deliberately OFF scene product, or 400/403 from unrelated
      # work validation, is NOT proof of a real privilege bypass.
      marker("L-A-"+name,"A2_"+str(active)+"_REVOKED_A1_"+str(revoked)+
        "_B_"+str(foreign_b)+"_M_"+str(foreign_m)+
        "_ACTIVE_ELIGIBLE_"+str(active_private)+
        "_REVOKED_PRIVATE_"+str(revoked_private))
      if active_private and revoked_private:
        bypass.append(name)
    # Direct authenticated PostgREST must be assessed separately from the
    # service-role Edge. A 403 ACL is NOT an accepted global revocation proof.
    for rpc,args in (
       ("community_get_me",{"p_auth_subject":str(users["A"]["id"])}),
       ("community_get_my_dreamsnaps_v1",{"p_auth_subject":str(users["A"]["id"]),"p_limit":10}),
    ):
      ac,_,aa=http("/rest/v1/rpc/"+rpc,body=args,token=a2)
      rv,_,ra=http("/rest/v1/rpc/"+rpc,body=args,token=a1)
      active=(ac==200 and aa is not None)
      revoked_private=(rv==200 and ra is not None)
      marker("L-DIRECT-"+rpc,"A2_"+str(ac)+"_A1_"+str(rv)+
             "_ACTIVE_ELIGIBLE_"+str(active)+"_REVOKED_PRIVATE_"+str(revoked_private))
      if active and revoked_private:bypass.append("direct:"+rpc)
    # Fully local and disposable; no Stage116 mutations. A 200 on an eligible
    # owner/private route is a confirmed legacy gate defect in this fixture.
    marker("SOURCE154_LEGACY_PROBE_SUMMARY",
       "CONFIRMED_BYPASS_COUNT_"+str(len(bypass))+
       "_SCENE_409_IS_NOT_ACCEPTED_WRITER_PRIVILEGE")
    assert not bypass,"REAL_SIGNED_REVOKED_SESSION_PRIVATE_LEGACY_ROUTE_BYPASS"
'''
src=src.replace(needle,needle+"\n"+added,1)
try:exec(compile(src,str(p),"exec"),{"__name__":"__main__"})
except BaseException as e:
    print("SOURCE154_LEGACY_SIGNED_MATRIX_FAILURE "+type(e).__name__,flush=True)
    sys.exit(1)
