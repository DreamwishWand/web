#!/usr/bin/env python3
"""FULL156 cumulative same-Account A0→A2 private owner→Media/Preset→R16.
Runs frozen Source155 first-account script in memory with only migration-count
adjustment and a NEW post-B11 bridge before disposable test users are deleted.
No Stage, real storage object, provider signed URL, product or native writer.
"""
import os,sys
from pathlib import Path
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source155-first-account-real-signed-local.py")
s=p.read_text()
count='assert scalar("select count(*) from supabase_migrations.schema_migrations")==155'
assert s.count(count)==1,"SOURCE155_FROZEN_COUNT_ANCHOR_CHANGED"
s=s.replace(count,count.replace("==155","==156"),1)
anchor="    for who in actors:\n        try:http("
assert s.count(anchor)==1,"SOURCE155_FINAL_CLEANUP_ANCHOR_CHANGED"
bridge=r'''
    # Cumulative path on exactly ONE initially unlinked real GoTrue D user.
    # Original B11 generated TWO genuine separate signed D sessions, both
    # completed one PRIVATE Account/Creator. Reuse that SAME owner below.
    assert jwt(d0,1)["session_id"]!=jwt(d1,1)["session_id"]
    assert scalar("select profile_visibility from public.creator_profiles where creator_profile_id=%s",(d_creator,))=="private"
    gm,pw,preset,blob,pres,prev=(*(uuid.uuid4() for _ in range(6)),)
    gw,grev=uuid.uuid4(),uuid.uuid4()
    key=str(D["id"])+"/"+str(uuid.uuid4())+".png"
    with db.transaction():
      db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset'),(%s,'community_work'),(%s,'preset_artifact'),(%s,'community_work')",
        (gm,pw,preset,gw))
      db.execute("""insert into public.media_assets(
        media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
        values(%s,%s,%s,'image/png',1024,128,128,%s,'ready','clear')""",
        (gm,d_account,key,'b'*64))
      db.execute("""insert into public.community_media_upload_intents(
        storage_key,owner_account_id,auth_subject,mime_type,expected_bytes)
        values(%s,%s,%s,'image/png',1024)""",(key,d_account,D["id"]))
      db.execute("select public.community_gallery_media_intent_complete_v1(%s,%s,%s)",
        (D["id"],key,gm))
      db.execute("""insert into public.community_works(
        work_id,owner_account_id,creator_profile_id,work_type,visibility)
        values(%s,%s,%s,'preset','private')""",(pw,d_account,d_creator))
      db.execute("""insert into public.preset_artifacts(
        preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type)
        values(%s,%s,%s,%s,'scene')""",(preset,d_account,d_creator,pw))
      db.execute("""insert into public.artifact_blobs(
        blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
        values(%s,%s,%s,1,'application/json',100,%s)""",
        (blob,d_account,'staging/'+str(d_account)+'/'+str(uuid.uuid4())+'.json','c'*64))
      db.execute("""insert into public.preset_revisions(
        preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
        values(%s,%s,1,%s,'{}'::jsonb,%s)""",(pres,preset,blob,d_account))
      db.execute("""insert into public.community_work_revisions(
        revision_id,work_id,revision_number,created_by_account_id)
        values(%s,%s,1,%s)""",(prev,pw,d_account))
      db.execute("insert into public.preset_revision_publications(work_revision_id,preset_revision_id) values(%s,%s)",(prev,pres))
      db.execute("""update public.community_works set lifecycle_state='published',
        current_published_revision_id=%s,published_at=now() where work_id=%s""",(prev,pw))
      db.execute("""insert into public.community_works(
        work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
        values(%s,%s,%s,'gallery','public','clear')""",(gw,d_account,d_creator))
      db.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(gw,))
      db.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(gw,))
      db.execute("""insert into public.community_work_revisions(
        revision_id,work_id,revision_number,created_by_account_id)
        values(%s,%s,1,%s)""",(grev,gw,d_account))
      db.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'Composite R16')",(grev,))
      db.execute("""update public.community_works set lifecycle_state='published',
        current_published_revision_id=%s,published_at=now() where work_id=%s""",(grev,gw))
      db.execute("""insert into public.search_documents(
        entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at)
        values(%s,%s,'gallery',%s,'Composite R16','',array[]::text[],
        '{"galleryKind":"outdoor","commentsEnabled":true}'::jsonb,now(),now())""",
        (gw,gw,d_creator))
    pin=scalar("select row_version from public.community_works where work_id=%s",(gw,))
    routes=[
      ("MEDIA","community-media",{"action":"read","mediaId":str(gm)}),
      ("PRESET","wep-preset-artifact",{"action":"revisionReadiness","presetArtifactId":str(preset)})
    ]
    for name,edge,body in routes:
      st,h,r=http("/functions/v1/"+edge,body=body,token=d0)
      assert st==200 and private_headers(h) and r.get("ok") is True,("COMPOSITE_ELIGIBLE_A0_OWNER_"+name,st)
      if name=="MEDIA":
        assert r["media"]["rawStorageSignedUrlIssued"] is False and "signedUrl" not in r["media"]
      else:
        assert r["readiness"]["ownerEligible"] is True and r["readiness"]["saveRevisionAuthorized"] is False
    marker("C04-SAME-ACCOUNT-MEDIA-PRESET","A0_BOOTSTRAPPED_OWNER_SIGNED_TWO_PRIVATE_200_NO_PROVIDER_URL",200)
    request={"command":"setGalleryCommentsAtomicR16","payload":{
      "workId":str(gw),"expectedVersion":pin,
      "expectedCurrentRevisionId":str(grev),
      "enabled":False,"idempotencyKey":"cumulative-"+secrets.token_hex(8)}}
    def gallery_state():
      return db.execute("""select
        (select comments_enabled from public.gallery_work_settings where work_id=%s),
        (select facets->>'commentsEnabled' from public.search_documents where work_id=%s),
        (select count(*) from public.audit_events where target_entity_id=%s and action_type='gallery.comments_enabled'),
        (select count(*) from public.idempotency_keys where account_id=%s and command_name='gallery_comments_r16'),
        (select count(*) from public.community_work_revisions where work_id=%s),
        (select row_version from public.community_works where work_id=%s)""",
        (gw,gw,gw,d_account,gw,gw)).fetchone()
    before=gallery_state()
    st,h,r=http("/functions/v1/community-command",body=request,token=d0)
    assert st==200 and private_headers(h) and r.get("ok") is True,("COMPOSITE_R16_WRITER_DENIED",st)
    after=gallery_state()
    assert after[:2]==(False,'false') and after[2]==before[2]+1 and after[3]==before[3]+1
    assert after[4]==before[4] and after[5]>before[5]
    st,_,_=http("/functions/v1/community-command",body=request,token=d0)
    assert st==200 and gallery_state()==after,"COMPOSITE_IDEMPOTENCY_REPLAY_MODIFIED"
    marker("C05-SAME-ACCOUNT-SIGNED-R16","TRUE_A0_BOOTSTRAP_GALLERY_CAS_ONE_SEARCH_AUDIT_IDEMPOTENCY",200)
    st,h,rv=http("/functions/v1/community-dreamsnap-owner",body={"operation":"session-revoke","scope":"local"},token=d0)
    assert st==200 and rv.get("state")=="revoked","COMPOSITE_LOCAL_REVOKE_FAILED"
    for name,edge,body in routes:
      bad,bh,_=http("/functions/v1/"+edge,body=body,token=d0)
      assert bad==401 and private_headers(bh),"COMPOSITE_REVOKED_MEDIA_PRESET_"+name
      good,gh,gr=http("/functions/v1/"+edge,body=body,token=d1)
      assert good==200 and private_headers(gh) and gr.get("ok") is True
    revoked_writer,wh,_=http("/functions/v1/community-command",body=request,token=d0)
    assert revoked_writer==401 and private_headers(wh) and gallery_state()==after
    for edge,body in (
      ("community-query",{"query":"me","payload":{}}),
      ("community-query",{"query":"myDreamsnaps","payload":{"limit":10}}),
      ("community-command",{"command":"createDdvProfileWorkspace","payload":{"relationshipKind":"self"}}),
    ):
      invalid,ih,_=http("/functions/v1/"+edge,body=body,token=d0)
      assert invalid==401 and private_headers(ih),("PR314_RED_REAPPEARED",invalid)
    assert scalar("select count(*) from public.ddv_profile_workspaces where account_id=%s",(d_account,))==0
    positive,phead,pres=http("/functions/v1/community-command",
       body={"command":"createDdvProfileWorkspace","payload":{"relationshipKind":"self"}},token=d1)
    assert positive==200 and private_headers(phead) and pres.get("ok") is True
    assert scalar("select count(*) from public.ddv_profile_workspaces where account_id=%s",(d_account,))==1
    marker("C03-C08-SAME-ACCOUNT-REVOCATION","A0_LOCAL_REVOKED_ALL_OLD_ROUTES_401_SIBLING_200_NO_UNAUTHORIZED_WORKSPACE",401)
'''
s=s.replace(anchor,bridge+"\n"+anchor,1)
try:
  exec(compile(s,str(p),"exec"),{"__name__":"__main__"})
except BaseException as exc:
  print("SOURCE156_CUMULATIVE_SIGNED_FAILURE "+type(exc).__name__+" "+str(exc)[:125],flush=True)
  sys.exit(1)
