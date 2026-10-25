#!/usr/bin/env python3
"""09 INT R17 independent Source127 Gallery Comments route-contract regression.
Actual PostgreSQL source functions and disposable synthetic rows. No signed HTTP.
"""
import os,uuid,json,psycopg
assert os.getenv("DDVRE_R17_LOCAL")=="YES"
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,q,x=()):return c.execute(q,x).fetchone()[0]
def main():
 with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
  assert one(a,"select count(*) from supabase_migrations.schema_migrations")==127
  assert one(a,"select pg_backend_pid()") != one(b,"select pg_backend_pid()")
  owner,auth,creator,gallery,gr,preset,art,blob,pres=(uuid.uuid4() for _ in range(9))
  with a.transaction():
   a.execute("insert into public.wand_accounts(account_id) values(%s)",(owner,))
   a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,
      last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')""",(owner,str(auth)))
   for eid,typ in ((creator,"creator_profile"),(gallery,"community_work"),(preset,"community_work"),(art,"preset_artifact")):
    a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(eid,typ))
   a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'R17 Local')",(creator,owner,"r17_"+uuid.uuid4().hex[:18]))
   for work,kind in ((gallery,"gallery"),(preset,"preset")):
    a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
      values(%s,%s,%s,%s,'public','clear')""",(work,owner,creator,kind))
   a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(gallery,))
   a.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(gallery,))
   a.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(gr,gallery,owner))
   a.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'R17')",(gr,))
   a.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s",(gr,gallery))
   a.execute("""insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at)
      values(%s,%s,'gallery',%s,'R17','',array[]::text[],'{"commentsEnabled":true}'::jsonb,now(),now())""",(gallery,gallery,creator))
   a.execute("insert into public.artifact_blobs(blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256) values(%s,%s,%s,1,'application/json',128,%s)",(blob,owner,"ci-only/"+uuid.uuid4().hex,"a"*64))
   a.execute("""insert into public.preset_artifacts(preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type,associated_gallery_work_id)
       values(%s,%s,%s,%s,'scene',%s)""",(art,owner,creator,preset,gallery))
   a.execute("""insert into public.preset_revisions(preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
       values(%s,%s,1,%s,'{}'::jsonb,%s)""",(pres,art,blob,owner))
  ver=one(a,"select row_version from public.community_works where work_id=%s",(gallery,))
  assert one(a,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id where r.work_id=%s",(gallery,))==0
  assert one(a,"select enrollment_state from private.community_writer_routes_r16 where writer_key='gallery-photo-publish'")=="SOURCE_PRESENT_UNENROLLED"
  a.execute("BEGIN")
  try:
   one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(art,))
   try:
    one(b,"select public.community_set_gallery_comments_enabled_atomic_r16(%s,%s,%s,%s,%s,%s)",(auth,gallery,ver,gr,False,"r17-new"))
   except psycopg.Error as e:
    assert "R16_DEPENDENT_GALLERY_METADATA_NOT_ENROLLED" in str(e),str(e)
   else:raise AssertionError("NEW_WRITER_REFERENCED_GALLERY_ALLOWED")
   assert one(b,"select comments_enabled from public.gallery_work_settings where work_id=%s",(gallery,)) is True
   assert one(b,"select count(*) from public.idempotency_keys where account_id=%s and idempotency_key='r17-new'",(owner,))==0
   # Existing separately routed Gallery comments command still has no CAS arguments.
   res=one(b,"select public.community_set_gallery_comments_enabled_v2(%s,%s,%s)",(auth,gallery,False))
   assert res["commentsEnabled"] is False
   assert one(b,"select comments_enabled from public.gallery_work_settings where work_id=%s",(gallery,)) is False
   assert one(b,"select row_version from public.community_works where work_id=%s",(gallery,))==ver
   print(json.dumps({"case":"R17_SOURCE127_OLD_COMMENTS_ROUTE_NOT_ENROLLED",
     "twoBackends":True,"newWriterRejectedDirectScene":True,
     "oldGalleryRouteUpdatedWithoutCAS":True,
     "linkedArtifactHeldDuringOldRoute":True,
     "graphComplete":False,"positiveAuthorization":False}))
  finally:a.execute("ROLLBACK")
  print(json.dumps({"result":"09INT_R17_COMMENTS_SOURCE_GAP_CONFIRMED",
    "sourcePin":"d7367c88af4368d127f05bd9b9079df78857cb8f",
    "signedStaging":False}))
if __name__=="__main__":main()
