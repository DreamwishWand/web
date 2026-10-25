#!/usr/bin/env python3
"""04 QR R17-X02 post-owner Source133 Cover-order observer acceptance. Local SQL only."""
import json
import os
import uuid
import psycopg

assert os.environ.get("DDVRE_QR_R17_X02_LOCAL") == "CONFIRMED"
assert not os.environ.get("DATABASE_URL")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
FROZEN_OWNER="8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec"
U=uuid.uuid4

def one(db,sql,args=()):
    return db.execute(sql,args).fetchone()[0]

def rejected(call):
    try:
        call()
    except psycopg.Error as e:
        return e.sqlstate, str(e).splitlines()[0]
    raise AssertionError("R17_X02_PRIVATE_PREFLIGHT_INCORRECTLY_AUTHORIZED")

def observe(db,actor,work):
    return one(db,"select public.community_gallery_photo_media_preflight_r17(%s,%s)",(actor,work))

def fingerprint(db,work,owner):
    return tuple(db.execute("""select
      (select row_version from public.community_works where work_id=%s),
      (select current_published_revision_id from public.community_works where work_id=%s),
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s),
      (select count(*) from public.audit_events where target_entity_id=%s),
      (select count(*) from public.work_revision_media rm
        join public.community_work_revisions r on r.revision_id=rm.work_revision_id
        where r.work_id=%s),
      (select count(*) from public.gallery_photo_revision_fields f
        join public.community_work_revisions r on r.revision_id=f.revision_id
        where r.work_id=%s),
      (select count(*) from public.search_documents where work_id=%s)
    """,(work,work,work,work,owner,work,work,work,work)).fetchone())

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==133
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    owner,actor,other,other_actor,retired_actor,creator,subject,other_subject,m1,m2,m3=(U() for _ in range(11))
    with a.transaction():
        for account,auth in [(owner,actor),(other,other_actor)]:
            a.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
            a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
               values(%s,'supabase',%s,clock_timestamp(),'active')""",(account,str(auth)))
        a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
          values(%s,'supabase',%s,clock_timestamp(),'retired')""",(owner,str(retired_actor)))
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,'R17 X02 cover observer QA')""",(creator,owner,"qr17_x02_"+U().hex[:14]))
        for sub in [subject,other_subject]:
            a.execute("""insert into public.gallery_verified_subjects(
              subject_id,gallery_kind,subject_type,canonical_target_id,
              platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
              values(%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',
              624,'QA-synthetic-X02','verified')""",(sub,"qr17-x02-"+U().hex))
        for mid in [m1,m2,m3]:
            a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(mid,))
            a.execute("""insert into public.media_assets(
              media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,
              processing_state,moderation_state)
              values(%s,%s,%s,'image/png',100,10,10,%s,'ready','clear')""",
              (mid,owner,"qa/x02/"+str(mid)+".png","e"*64))

    works={}
    def create_gallery(label,versions):
        work=U()
        with a.transaction():
            a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
            a.execute("""insert into public.community_works(
              work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
              values(%s,%s,%s,'gallery','public','clear')""",(work,owner,creator))
            a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
            a.execute("""insert into public.gallery_photo_subjects(
              work_id,subject_id,owner_account_id,creator_profile_id)
              values(%s,%s,%s,%s)""",(work,subject,owner,creator))
            for number,(media_pairs,cover,rev_subject) in enumerate(versions,start=1):
                revision=U()
                a.execute("""insert into public.community_work_revisions(
                  revision_id,work_id,revision_number,created_by_account_id)
                  values(%s,%s,%s,%s)""",(revision,work,number,owner))
                a.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,%s)",
                          (revision,"QR x02 "+label+" r"+str(number)))
                for mid,ordinal in media_pairs:
                    a.execute("""insert into public.work_revision_media(
                      work_revision_id,media_id,ordinal,role)
                      values(%s,%s,%s,'gallery')""",(revision,mid,ordinal))
                a.execute("""insert into public.gallery_photo_revision_fields(
                  revision_id,subject_id,cover_media_id,originality_attested)
                  values(%s,%s,%s,true)""",(revision,rev_subject,cover))
                a.execute("""update public.community_works set lifecycle_state='published',
                  current_published_revision_id=%s,published_at=now() where work_id=%s""",
                  (revision,work))
        works[label]=work
        return work

    good=create_gallery("first", [([(m1,0),(m2,1)],m1,subject)])
    misordered=create_gallery("misordered-current",[([(m1,0),(m2,1)],m2,subject)])
    bad_history=create_gallery("misordered-history",[
        ([(m1,0),(m2,1)],m2,subject),
        ([(m2,0),(m1,1)],m2,subject)
    ])
    missing=create_gallery("missing-cover",[([(m1,0)],m3,subject)])
    bad_subject=create_gallery("wrong-subject",[([(m1,0)],m1,other_subject)])

    cases=[
      ("FIRST_ORDINAL0_VALID",good,0,True,False,[True]),
      ("CURRENT_COVER_ORDINAL1_REJECTED",misordered,1,False,True,[False]),
      ("HISTORICAL_COVER_ORDINAL1_REJECTED",bad_history,1,True,True,[False,True]),
      ("COVER_NOT_IN_REVISION_MEDIA_REJECTED",missing,1,False,True,[False]),
      ("PHOTO_SUBJECT_MISMATCH_REJECTED",bad_subject,1,True,True,[True])
    ]
    for name,work,expected_count,expected_current_first,expected_block,expected_first_flags in cases:
        before=fingerprint(a,work,owner)
        dto=observe(b,actor,work)
        assert dto["schemaVersion"]==1 and dto["contract"]=="ddv.gallery-photo-media-readonly@r17",name
        assert dto["sourceStorageState"]=="DATABASE_METADATA_ONLY"
        assert dto["knownDependencyCounts"]["coverSubjectOrReferenceMismatch"]==expected_count,(name,dto)
        covers=sorted(dto["coverReferences"],key=lambda v:v["revisionNumber"])
        assert [v["coverFirst"] for v in covers]==expected_first_flags,(name,covers)
        current=next(v for v in covers if v["isCurrent"])
        assert current["coverFirst"] is expected_current_first,(name,current)
        assert ("MEDIA_COVER_METADATA_INCONSISTENT" in dto["blockedReasons"])==expected_block,(name,dto["blockedReasons"])
        for key in ("actualStorageBytesVerified","metadataSha256IsStorageProof",
                    "priorSignedUrlsRevoked","cdnBrowserPurgeProven",
                    "storageIssuerGraphComplete","graphComplete","mutationAuthorized",
                    "saveRevisionAuthorized","pairedGalleryPublishAuthorized",
                    "retirementAuthorized","physicalCleanupAuthorized"):
            assert dto[key] is False,(name,key)
        assert dto["snapshotNotAtomicMutationFence"] is True,name
        assert not any(secret in str(dto) for secret in ("qa/x02/","storageKey","signedUrl","uploadToken")),name
        assert fingerprint(a,work,owner)==before,("observer-mutated-DB",name)
        print(json.dumps({"case":"QR_R17_X02_"+name,"realPostgres":True,
           "count":expected_count,"blocked":expected_block,"noSideEffects":True}))

    baseline=fingerprint(a,good,owner)
    denied=rejected(lambda:observe(b,other_actor,good))
    assert "R17_PHOTO_PREFLIGHT_FORBIDDEN" in denied[1],denied
    assert fingerprint(a,good,owner)==baseline
    assert one(a,"select has_function_privilege('authenticated','public.community_gallery_photo_media_preflight_r17(uuid,uuid)','EXECUTE')") is False
    assert one(a,"select has_function_privilege('anon','public.community_gallery_photo_media_preflight_r17(uuid,uuid)','EXECUTE')") is False
    assert one(a,"select has_function_privilege('service_role','public.community_gallery_photo_media_preflight_r17(uuid,uuid)','EXECUTE')") is True
    print(json.dumps({"case":"QR_R17_X02_NONOWNER_AND_DIRECT_SQL_ACL",
       "nonownerDenied":True,"anonAuthenticatedDenied":True,"serviceOnly":True}))

    # Retired provider identity is an isolated fixture, never the real Owner actor.
    denied=rejected(lambda:observe(b,retired_actor,good))
    assert denied[0] is not None,denied
    assert fingerprint(a,good,owner)==baseline
    assert observe(b,actor,good)["knownDependencyCounts"]["coverSubjectOrReferenceMismatch"]==0
    print(json.dumps({"case":"QR_R17_X02_RETIRED_IDENTITY_DENIED",
       "retiredIdentityIsSynthetic":True,"stateUnchanged":True}))

    # Phase1 privacy is source-local real SQL (not physical erasure).
    session=U()
    a.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(actor,))
    a.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,actor))
    epoch=one(a,"select extract(epoch from clock_timestamp())::bigint")
    response=one(a,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",
        (actor,session,epoch))
    assert response["privacyState"]=="suppressed_cleanup_pending",response
    after=fingerprint(a,good,owner)
    denied=rejected(lambda:observe(b,actor,good))
    assert denied[0] is not None,denied
    assert fingerprint(a,good,owner)==after
    print(json.dumps({"case":"QR_R17_X02_PRIVACY_SUPPRESSION_DENIED",
       "phase1Committed":True,"observerNoPartialState":True,
       "physicalErasureProven":False}))

print(json.dumps({"result":"QR_R17_X02_SOURCE133_INDEPENDENT_POSTFIX_COVER_OBSERVER_PASS",
    "frozenOwnerHead":FROZEN_OWNER,"migrationCount":133,
    "actualStorageBytes":False,"signedActorHTTP":False,
    "signedStaging":False,"writerGraphComplete":False,"releaseAuthority":False}))
