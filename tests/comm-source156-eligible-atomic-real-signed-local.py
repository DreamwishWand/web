#!/usr/bin/env python3
"""Source156: cumulative FULL156 real signed Media/Preset controls and R16 atomic writer race.
No remote credentials, storage URL, production mutation or new acceptance of PR308-316.
"""
import os,sys
from pathlib import Path
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source154-legacy-signed-matrix-local.py")
runner=p.read_text()
source_hook="src=p.read_text()"
assert runner.count(source_hook)==1
# Source156 migrated on top of the true Source155 first-Account migration.
# Change only the legacy Source153 fixture's target migration count in memory;
# the standalone Source154/PR308 tests stay frozen on disk.
runner=runner.replace(source_hook,source_hook+'''\nassert src.count('migration_assert.replace("==153","==154")')==1\nsrc=src.replace('migration_assert.replace("==153","==154")',\n                'migration_assert.replace("==153","==156")',1)\n''',1)

# Existing Source154/155 fixtures remain byte-identical; Source156 is a migration.\n
fixture=r'''
    # Fully owned local metadata: no Storage upload and no URL issue.
    good_media,good_preset,good_work=RANDOM(),RANDOM(),RANDOM()
    good_blob,good_pr,good_wr=RANDOM(),RANDOM(),RANDOM()
    media_key=str(users["A"]["id"])+"/"+str(RANDOM())+".png"
    with db.transaction():
      db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset'),(%s,'preset_artifact'),(%s,'community_work')",(good_media,good_preset,good_work))
      db.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,
        mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
        values(%s,%s,%s,'image/png',1024,128,128,%s,'ready','clear')""",
        (good_media,account["A"],media_key,'b'*64))
      db.execute("""insert into public.community_media_upload_intents(
        storage_key,owner_account_id,auth_subject,mime_type,expected_bytes)
        values(%s,%s,%s,'image/png',1024)""",
        (media_key,account["A"],users["A"]["id"]))
      # Do not forge the immutable finalize journal: use the actual DB
      # transition which assigns finalized_at and validates stored Media.
      db.execute("select public.community_gallery_media_intent_complete_v1(%s,%s,%s)",
        (users["A"]["id"],media_key,good_media))
      db.execute("""insert into public.community_works(
        work_id,owner_account_id,creator_profile_id,work_type,visibility)
        values(%s,%s,%s,'preset','private')""",(good_work,account["A"],creator))
      db.execute("""insert into public.preset_artifacts(
        preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type)
        values(%s,%s,%s,%s,'scene')""",(good_preset,account["A"],creator,good_work))
      db.execute("""insert into public.artifact_blobs(
        blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
        values(%s,%s,%s,1,'application/json',100,%s)""",
        (good_blob,account["A"],'staging/'+str(account["A"])+'/'+str(RANDOM())+'.json','c'*64))
      db.execute("""insert into public.preset_revisions(
        preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
        values(%s,%s,1,%s,'{}'::jsonb,%s)""",(good_pr,good_preset,good_blob,account["A"]))
      db.execute("""insert into public.community_work_revisions(
        revision_id,work_id,revision_number,created_by_account_id)
        values(%s,%s,1,%s)""",(good_wr,good_work,account["A"]))
      db.execute("insert into public.preset_revision_publications(work_revision_id,preset_revision_id) values(%s,%s)",(good_wr,good_pr))
      db.execute("""update public.community_works set lifecycle_state='published',
        current_published_revision_id=%s,published_at=now() where work_id=%s""",(good_wr,good_work))
    good_routes=(
      ("MEDIA","community-media",{"action":"read","mediaId":str(good_media)}),
      ("PRESET","wep-preset-artifact",{"action":"revisionReadiness","presetArtifactId":str(good_preset)})
    )
'''
assert runner.count("    legacy_probes=[")==1
runner=runner.replace("    legacy_probes=[",fixture+"\n    legacy_probes=[",1)
# Record local SQLSTATE and primary SQL exception only, not IDs, JWTs or secrets.
runner=runner.replace('try:exec(compile(src,str(p),"exec"),{"__name__":"__main__"})',
'''src=src.replace('print("SOURCE153_SIGNED_SESSION_TEST_FAILED "+type(exc).__name__,flush=True)',
'print("SOURCE153_SIGNED_SESSION_TEST_FAILED "+type(exc).__name__+" SQLSTATE="+str(getattr(exc,"sqlstate",None))+" PRIMARY="+str(getattr(getattr(exc,"diag",None),"message_primary",""))[:80],flush=True)')
try:exec(compile(src,str(p),"exec"),{"__name__":"__main__"})''',1)

assert runner.count('"mediaId":str(mp)')==1
runner=runner.replace('"mediaId":str(mp)','"mediaId":str(good_media)',1)
assert runner.count('"presetArtifactId":str(uuid.uuid4())')==1
runner=runner.replace('"presetArtifactId":str(uuid.uuid4())','"presetArtifactId":str(good_preset)',1)

cases=r'''
    for name,edge,body in good_routes:
      def probe(token):
        st,h,d=http("/functions/v1/"+edge,body=body,token=token)
        if token is not None: assert safe_edge_headers(h),"S155_FOUR_CACHE_HEADERS_"+name
        return st,d
      ok,result=probe(a2)
      assert ok==200 and result.get("ok") is True,"S155_A2_NOT_ELIGIBLE_"+name
      if name=="MEDIA":
        assert result["media"]["rawStorageSignedUrlIssued"] is False
        assert "signedUrl" not in result["media"]
      else:
        assert result["readiness"]["ownerEligible"] is True
        assert result["readiness"]["presetType"]=="scene"
      bad,_=probe(a1)
      foreign=[probe(users[k]["token"])[0] for k in ("B","M")]
      anonymous,_=probe(None)
      assert bad==401 and all(x!=200 for x in foreign) and anonymous!=200
      marker("S155-ELIGIBLE-"+name,"A2_200_A1_401_B_M_ANON_DENY_PRIVATE_HEADERS",ok)

    w,rev=RANDOM(),RANDOM()
    with db.transaction():
      db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(w,))
      db.execute("""insert into public.community_works(
        work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
        values(%s,%s,%s,'gallery','public','clear')""",(w,account["A"],creator))
      db.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(w,))
      db.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(w,))
      db.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
        values(%s,%s,1,%s)""",(rev,w,account["A"]))
      db.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'S155 local')",(rev,))
      db.execute("""update public.community_works set lifecycle_state='published',
        current_published_revision_id=%s,published_at=now() where work_id=%s""",(rev,w))
      db.execute("""insert into public.search_documents(
        entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at)
        values(%s,%s,'gallery',%s,'S155 local','',array[]::text[],
        '{"galleryKind":"outdoor","commentsEnabled":true}'::jsonb,now(),now())""",(w,w,creator))
    pin=scalar("select row_version from public.community_works where work_id=%s",(w,))
    assert not scalar("select has_function_privilege('service_role','public.community_set_gallery_comments_enabled_atomic_r16(uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')")
    assert scalar("select has_function_privilege('service_role','public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')")
    def state():
      return db.execute("""select
        (select comments_enabled from public.gallery_work_settings where work_id=%s),
        (select facets->>'commentsEnabled' from public.search_documents where work_id=%s),
        (select count(*) from public.audit_events where target_entity_id=%s and action_type='gallery.comments_enabled'),
        (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like 's155-%%'),
        (select count(*) from public.community_work_revisions where work_id=%s),
        (select row_version from public.community_works where work_id=%s)""",
        (w,w,w,account["A"],w,w)).fetchone()
    def signed_claims(token):
      j=jwt_payload(token)
      return (users["A"]["id"],int(j["iat"]),uuid.UUID(j["session_id"]))
    def writer(conn,claims,key):
      return conn.execute("""select public.community_set_gallery_comments_enabled_atomic_signed_v1(
        %s,%s,%s,%s,%s,%s,%s,%s)""",
        (*claims,w,pin,rev,False,key)).fetchone()[0]
    old=state()
    newtok,_=a_login()
    old_claims=signed_claims(newtok)
    good_claims=signed_claims(a2)
    db.execute("select public.community_authorize_signed_session_v2(%s,%s,%s)",old_claims)
    with psycopg.connect(DSN,autocommit=True) as r,psycopg.connect(DSN,autocommit=True) as c:
      assert r.execute("select pg_backend_pid()").fetchone()[0]!=c.execute("select pg_backend_pid()").fetchone()[0]
      # Revoker has the identity UPDATE lock after Edge preflight.
      r.execute("begin")
      r.execute("""select auth_identity_id from public.auth_identities
        where provider='supabase' and provider_subject=%s for update""",(str(users["A"]["id"]),))
      c.execute("begin")
      c.execute("set local lock_timeout='300ms'")
      try:
        writer(c,old_claims,"s155-racing")
        raise AssertionError("WRITER_BYPASSED_REVOKER_LOCK")
      except psycopg.Error as e:
        assert e.sqlstate=="55P03",e.sqlstate
      c.execute("rollback")
      r.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",old_claims)
      r.execute("commit")
      assert state()==old
      try:
        writer(c,old_claims,"s155-racing")
        raise AssertionError("REVOKED_WRITER_COMMITTED")
      except psycopg.Error as e:
        assert "SIGNED_SESSION_TERMINALLY_REVOKED" in str(e)
      assert state()==old
      marker("S155-LOCAL-REVOKER-FIRST","PREFLIGHT_200_55P03_REVOKED_DENIED_ALL_DB_UNCHANGED")
      # Reverse lock order: revocation cannot complete before Writer commit.
      c.execute("begin")
      response=writer(c,good_claims,"s155-positive")
      assert response["commentsEnabled"] is False
      r.execute("begin")
      r.execute("set local lock_timeout='300ms'")
      try:
        r.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",good_claims)
        raise AssertionError("REVOKE_PASSED_INFLIGHT_WRITER")
      except psycopg.Error as e:
        assert e.sqlstate=="55P03",e.sqlstate
      r.execute("rollback")
      c.execute("commit")
    after=state()
    assert after[0:2]==(False,'false') and after[2]==old[2]+1
    assert after[3]==old[3]+1 and after[4]==old[4] and after[5]>old[5]
    marker("S155-LOCAL-WRITER-FIRST","IDENTITY_SHARE_LOCK_REVOKE_BLOCKED_ATOMIC_COMMIT_AUDIT_IDEMPOTENCY")
    request={"command":"setGalleryCommentsAtomicR16","payload":{
      "workId":str(w),"expectedVersion":pin,"expectedCurrentRevisionId":str(rev),
      "enabled":False,"idempotencyKey":"s155-positive"}}
    status,h,result=http("/functions/v1/community-command",body=request,token=a2)
    assert status==200 and safe_edge_headers(h) and result.get("ok") is True
    assert state()==after,"IDEMPOTENCY_REPLAY_SIDE_EFFECT"
    for tok in (users["B"]["token"],users["M"]["token"],None):
      denied,headers,_=http("/functions/v1/community-command",body=request,token=tok)
      assert denied!=200
      if tok is not None: assert safe_edge_headers(headers)
    assert state()==after
    marker("S155-REAL-SIGNED-HTTP","A2_200_IDEMPOTENT_B_M_ANON_DENIED_FOUR_HEADERS",200)
'''
anchor="    # Direct authenticated PostgREST must be assessed separately from the"
assert runner.count(anchor)==1
runner=runner.replace(anchor,cases+"\n"+anchor,1)

refresh_anchor="refreshed=r'''\n    if st==200:\n"
assert runner.count(refresh_anchor)==1
refreshed_cases=r"""      for name,edge,body in good_routes:
        active,ah,ar=http("/functions/v1/"+edge,body=body,token=a2)
        denied,dh,_=http("/functions/v1/"+edge,body=body,token=t)
        assert active==200 and ar.get("ok") is True and denied==401
        assert safe_edge_headers(ah) and safe_edge_headers(dh)
        marker("S155-REFRESHED-"+name,"A2_200_REFRESHED_A1_401",denied)
"""
runner=runner.replace(refresh_anchor,refresh_anchor+refreshed_cases,1)

global_case=r'''
    # Real new A3 was live after R08. Global revoke after preflight, then
    # correct-current-CAS Writer must not mutate anything.
    a3status=auth_read(a3)
    marker("S155-GLOBAL-A3-PREFLIGHT","ACTIVE_POSTCUTOFF",a3status)
    assert a3status==200,"S155_GLOBAL_A3_INACTIVE"
    global_pin=scalar("select row_version from public.community_works where work_id=%s",(w,))
    gc=signed_claims(a3)
    db.execute("select public.community_authorize_signed_session_v2(%s,%s,%s)",gc)
    baseline=state()
    status,result=e2_http(a3,{"operation":"session-revoke","scope":"global"})
    marker("S155-GLOBAL-REVOKE-HTTP","STATE_"+str(result.get("state","MISSING")),status)
    assert status==200 and result.get("state")=="revoked","S155_GLOBAL_REVOKE_EDGE_FAILED"
    with psycopg.connect(DSN,autocommit=True) as conn:
      try:
        conn.execute("""select public.community_set_gallery_comments_enabled_atomic_signed_v1(
          %s,%s,%s,%s,%s,%s,%s,%s)""",
          (*gc,w,global_pin,rev,True,"s155-global-racing"))
        raise AssertionError("GLOBAL_REVOKED_WRITER_COMMITTED")
      except psycopg.Error as e:
        assert any(x in str(e).upper() for x in (
          "SIGNED_SESSION_TERMINALLY_REVOKED","SESSION","SIGNED_IDENTITY"
        )),"S155_GLOBAL_REVOCATION_DENIAL_NOT_SESSION"
    assert state()==baseline,"S155_GLOBAL_WRITE_SIDE_EFFECT"
    marker("S155-GLOBAL-REVOKER-FIRST","PREFLIGHT_200_GLOBAL_REVOKED_CAS_VALID_WRITER_NO_DB_DIFF",401)
'''
insert_anchor='try:exec(compile(src,str(p),"exec"),{"__name__":"__main__"})'
assert runner.count(insert_anchor)==1
# Append only after the already-frozen Source153 end-of-fixture assertions;
# do not disturb or reaccept the inherited expected terminal revoke count.
patch="final_marker='    marker(\"SOURCE153_SERVER_ENFORCED_SIGNED_SESSION_PASS\",\\n      \"REAL_SIGNED_EDGE_SQL_NOT_TEMP_GATE_NOT_MANAGED_RUNTIME\")'\n"
patch+="assert src.count(final_marker)==1\n"
patch+="src=src.replace(final_marker,final_marker+'\\n'+"+repr(global_case)+",1)\n"
patch+="extra="+repr('(users["A"]["id"],))==2')+"\n"
patch+="assert src.count(extra)==1, 'SOURCE155_TERMINAL_COUNT_ANCHOR_CHANGED'\n"
patch+="src=src.replace(extra,extra.replace('==2','==3'),1)\n"
runner=runner.replace(insert_anchor,patch+insert_anchor,1)

try:
  exec(compile(runner,str(p),"exec"),{"__name__":"__main__"})
except BaseException as e:
  print("SOURCE155_SIGNED_FIXTURE_FAILED "+type(e).__name__,flush=True)
  sys.exit(1)
