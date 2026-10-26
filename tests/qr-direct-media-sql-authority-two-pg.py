#!/usr/bin/env python3
"""Independent 04 QR Direct Media SQL caller authorization contract.
Local disposable Source141 PostgreSQL only. No signed JWT, provider, CDN or Staging.
This deliberately fails against unfenced SQL; no old QR179 test is invoked.
"""
import json
import os
import uuid
import psycopg

assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
uid = uuid.uuid4

def one(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()[0]

def guarded(conn, role, sql, params=()):
    try:
        with conn.transaction():
            if role:
                conn.execute("set local role " + role)
            value = one(conn, sql, params)
            return {"denied": False, "value": value}
    except psycopg.Error as error:
        return {"denied": True, "state": error.sqlstate, "message": str(error).split("\n")[0]}

def no_key(result):
    return result["denied"] or not isinstance(result.get("value"), dict) or not result["value"].get("storageKey")

with psycopg.connect(DSN, autocommit=True) as a, psycopg.connect(DSN, autocommit=True) as b:
    assert one(a, "select pg_backend_pid()") != one(b, "select pg_backend_pid()")
    assert one(a, "select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    row = a.execute("""
        select i.provider_subject::uuid, wa.account_id, cp.creator_profile_id, gv.subject_id
        from public.wand_accounts wa
        join public.auth_identities i on i.account_id=wa.account_id
        join public.creator_profiles cp on cp.owner_account_id=wa.account_id
        cross join public.gallery_verified_subjects gv
        where wa.status='active' and i.identity_state='active'
          and gv.verification_state='verified' and gv.subject_type='floating_island'
        limit 1
    """).fetchone()
    assert row, "QR_DIRECT_SQL_LOCAL_OWNER_MISSING"
    actor, owner, creator, subject = row
    other = one(a, """
        select provider_subject::uuid from public.auth_identities
        where account_id <> %s and identity_state='active' limit 1
    """, (owner,))
    current_media, historical_cover, unrelated_media = uid(), uid(), uid()
    with a.transaction():
        for media, marker in ((current_media, 'a'), (historical_cover, 'b'), (unrelated_media, 'c')):
            a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')", (media,))
            a.execute("""
                insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
                    byte_size,width,height,checksum_sha256,processing_state,moderation_state)
                values(%s,%s,%s,'image/png',128,20,20,%s,'ready','clear')
            """, (media,owner,'qr-direct-sql-local/'+str(media)+'.png',marker*64))
        created = one(a, """
            select public.community_publish_gallery_photo_v1(
                %s,%s,null,null,'outdoor',%s,'QR direct SQL caller fixture',null,
                array[%s]::uuid[],%s,true,%s)
        """, (actor,creator,subject,current_media,current_media,'qr-direct-'+uid().hex))
        gallery = uuid.UUID(created["workId"])
        old_revision = uid()
        a.execute("""
            insert into public.community_work_revisions(
                revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
            values(%s,%s,2,%s,'{}'::jsonb)
        """, (old_revision,gallery,owner))
        a.execute("""
            insert into public.gallery_work_revisions(revision_id,title,metadata)
            values(%s,'QR direct SQL historic cover-only','{}'::jsonb)
        """, (old_revision,))
        a.execute("""
            insert into public.gallery_photo_revision_fields(
                revision_id,subject_id,cover_media_id,originality_attested)
            values(%s,%s,%s,true)
        """, (old_revision,subject,historical_cover))
        assert one(a, """
            select count(*) from public.work_revision_media
            where work_revision_id=%s and media_id=%s
        """, (old_revision,historical_cover)) == 0
        reservation = one(a, """
            select public.community_preset_storage_reserve_r18(
                %s,%s,%s,%s,%s,100,%s,1,'scene')
        """, (actor,creator,'staging/'+str(owner)+'/'+str(uid())+'.json',
              'qr-direct-'+uid().hex,'a'*64,'b'*64))
        rid = uuid.UUID(reservation["reservationId"])
        lease = one(a, "select public.community_preset_storage_claim_promotion_r18(%s,%s,1)", (actor,rid))
        a.execute("""
            update private.preset_storage_release_gate_r18
            set enabled=true, provider_precondition_accepted=true,
                operator_evidence_ref='QR_DIRECT_SQL_LOCAL_UNATTESTED_SYNTHETIC'
            where gate_key='verified_preset_publication'
        """)
        a.execute("""
            update private.preset_storage_reservations_r18
            set reservation_state='VERIFIED_PUBLISHED_OBJECT',
                verification_evidence_state='PROVIDER_ATTESTED',
                readback_at=now(),readback_byte_size=100,readback_sha256=%s
            where reservation_id=%s
        """, ('b'*64,rid))
        receipt = one(a, """
            select private.preset_storage_commit_candidate_r18(
                %s,%s,2,%s,1,'QR direct SQL local artifact',null,'public','{}'::jsonb)
        """, (actor,rid,uuid.UUID(lease["leaseToken"])))
        preset_id = uid()
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')", (preset_id,))
        a.execute("""
            insert into public.preset_artifacts(preset_artifact_id,owner_account_id,
                creator_profile_id,associated_gallery_work_id,preset_type)
            values(%s,%s,%s,%s,'scene')
        """, (preset_id,owner,creator,gallery))
        a.execute("""
            insert into public.preset_revisions(
                preset_artifact_id,revision_number,artifact_blob_id,created_by_account_id)
            values(%s,1,(select committed_blob_id from private.preset_storage_reservations_r18
              where reservation_id=%s),%s)
        """, (preset_id,rid,owner))
        a.execute("""
            update private.preset_storage_release_gate_r18
            set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null
            where gate_key='verified_preset_publication'
        """)
    assert one(b, "select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    direct_public = "select public.community_get_public_media_storage_v2(%s)"
    direct_owner = "select public.community_gallery_owner_media_read_v1(%s,%s)"
    assert one(b, "select has_function_privilege('service_role','public.community_get_public_media_storage_v2(uuid)','execute')")
    assert one(b, "select has_function_privilege('service_role','public.community_gallery_owner_media_read_v1(uuid,uuid)','execute')")
    for role in ("anon", "authenticated"):
        assert not one(b, """
            select has_function_privilege(%s,'public.community_get_public_media_storage_v2(uuid)','execute')
        """, (role,))
        assert not one(b, """
            select has_function_privilege(%s,'public.community_gallery_owner_media_read_v1(uuid,uuid)','execute')
        """, (role,))
    before_public = guarded(b, "service_role", direct_public, (current_media,))
    before_owner = guarded(b, "service_role", direct_owner, (actor,current_media))
    before_old = guarded(b, "service_role", direct_owner, (actor,historical_cover))
    before_other = guarded(b, "service_role", direct_owner, (other,current_media))
    assert not no_key(before_public), "QR_DIRECT_SQL_PREINCIDENT_PUBLIC_GALLERY_NOT_POSITIVE"
    assert not no_key(before_owner) and before_owner["value"].get("ownerAuthorized") is True
    assert not no_key(before_old) and before_old["value"].get("ownerAuthorized") is True
    assert no_key(before_other) and before_other["value"].get("ownerAuthorized") is False
    assert no_key(guarded(b, "service_role", direct_public, (unrelated_media,)))
    assert one(a,"select private.preset_storage_media_quarantined_r19(%s)",(current_media,)) is False
    assert one(a,"select private.preset_storage_media_quarantined_r19(%s)",(historical_cover,)) is False

    with b.transaction():
        report = one(b, """
            select public.community_preset_storage_report_integrity_r18(
                %s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT',
                'QR direct SQL local postcommit incident',null,null)
        """, (actor,rid))
        assert report["publicationAuthorized"] is False
    assert one(a,"select private.preset_storage_media_quarantined_r19(%s)",(current_media,)) is True
    assert one(a,"select private.preset_storage_media_quarantined_r19(%s)",(historical_cover,)) is True
    assert one(a,"select private.preset_storage_media_quarantined_r19(%s)",(unrelated_media,)) is False
    assert one(a, "select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s", (rid,)) == 1
    assert one(a, "select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    results = {
        "directPublicCurrentServiceRole": guarded(a, "service_role", direct_public, (current_media,)),
        "directOwnerCurrentServiceRole": guarded(a, "service_role", direct_owner, (actor,current_media)),
        "directOwnerHistoricalCoverServiceRole": guarded(a, "service_role", direct_owner, (actor,historical_cover)),
        "directNonOwnerServiceRole": guarded(a, "service_role", direct_owner, (other,current_media)),
        "directOwnerCurrentPostgres": guarded(a, None, direct_owner, (actor,current_media)),
    }
    violations = [name for name, outcome in results.items() if not no_key(outcome)]
    print(json.dumps({
        "case": "QR_DIRECT_MEDIA_SQL_SOURCE140_DIFFERENTIAL_2PG",
        "sourceHead": os.getenv("GITHUB_SHA", "local"),
        "preincidentCurrentGalleryPublic": True,
        "preincidentOwnerCurrentAndHistoric": True,
        "postincidentDirectSQLStorageKeyExposedCases": violations,
        "postincidentUnrelatedMediaQuarantined": False,
        "serviceRoleFunctionExecute": True,
        "normalJwtProviderCdnAndStageExecuted": False,
        "releaseGateReclosed": True,
    }, sort_keys=True))
    assert not violations, "QR_DIRECT_MEDIA_SQL_AUTHORITY_POSTINCIDENT_STORAGEKEY_EXPOSED:" + ",".join(violations)
