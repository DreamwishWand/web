#!/usr/bin/env python3
"""04 QR new Source140 FINAL cover-only + post-incident media boundary.
Disposable local 140-source PostgreSQL only; no JWT, Provider, Storage or Staging.
Existing Source138/139/140 authenticated-reader fixtures are NOT rerun.
"""
import json
import os
import uuid
from pathlib import Path
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
newid = uuid.uuid4

def one(db, sql, args=()):
    return db.execute(sql, args).fetchone()[0]

def denied(db, sql, args, fragment):
    db.execute('savepoint qr140_denial')
    try:
        one(db, sql, args)
    except psycopg.Error as error:
        db.execute('rollback to savepoint qr140_denial')
        assert fragment in str(error), (fragment, str(error))
        return
    db.execute('rollback to savepoint qr140_denial')
    raise AssertionError('QR140_COVER_MEDIA_UNEXPECTEDLY_ACCESSIBLE:' + fragment)

with psycopg.connect(DSN, autocommit=True) as left, psycopg.connect(DSN, autocommit=True) as right:
    assert one(left,'select pg_backend_pid()') != one(right,'select pg_backend_pid()')
    assert one(left,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    seed = left.execute("""
        select ai.provider_subject::uuid, wa.account_id, cp.creator_profile_id, gv.subject_id
        from public.wand_accounts wa
        join public.auth_identities ai on ai.account_id=wa.account_id
          and ai.provider='supabase' and ai.identity_state='active'
        join public.creator_profiles cp on cp.owner_account_id=wa.account_id
          and cp.moderation_state='clear'
        cross join public.gallery_verified_subjects gv
        where wa.status='active' and gv.verification_state='verified'
          and gv.subject_type='floating_island'
        order by wa.account_id,gv.canonical_target_id limit 1
    """).fetchone()
    assert seed is not None, 'QR140_SYNTHETIC_SEED_OWNER_OR_GALLERY_SUBJECT_MISSING'
    actor, owner, creator, subject = seed
    cover_current, cover_history, unrelated = newid(),newid(),newid()
    with left.transaction():
        for media, ch in [(cover_current,'a'),(cover_history,'b'),(unrelated,'c')]:
            left.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
            left.execute("""
                insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
                  byte_size,width,height,checksum_sha256,processing_state,moderation_state)
                values(%s,%s,%s,'image/png',128,20,20,%s,'ready','clear')
            """,(media,owner,'qr140-local/'+str(media)+'.png',ch*64))
        published = one(left,"""
            select public.community_publish_gallery_photo_v1(
                %s,%s,null,null,'outdoor',%s,'QR140 immutable cover media',null,
                array[%s]::uuid[],%s,true,%s
            )
        """,(actor,creator,subject,cover_current,cover_current,'qr140-'+newid().hex))
        gallery = uuid.UUID(published['workId'])
        old_revision = newid()
        left.execute("""
            insert into public.community_work_revisions(
                revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
            values(%s,%s,2,%s,'{}'::jsonb)
        """,(old_revision,gallery,owner))
        left.execute("""
            insert into public.gallery_work_revisions(revision_id,title,metadata)
            values(%s,'QR140 historic cover-only','{}'::jsonb)
        """,(old_revision,))
        left.execute("""
            insert into public.gallery_photo_revision_fields(
                revision_id,subject_id,cover_media_id,originality_attested)
            values(%s,%s,%s,true)
        """,(old_revision,subject,cover_history))
        assert one(left,"select count(*) from public.work_revision_media where work_revision_id=%s and media_id=%s",(old_revision,cover_history)) == 0
        # A positive Preset artifact and one direct Gallery association are
        # synthetic database-only. The Release Gate is restored OFF in the
        # same committed transaction, NOT an attested Provider publication.
        reservation = one(left,"""
          select public.community_preset_storage_reserve_r18(
              %s,%s,%s,%s,%s,100,%s,1,'scene')
        """,(actor,creator,'staging/'+str(owner)+'/'+str(newid())+'.json','qr140-'+newid().hex,'a'*64,'b'*64))
        rid = uuid.UUID(reservation['reservationId'])
        lease = one(left,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,rid))
        left.execute("""
           update private.preset_storage_release_gate_r18
           set enabled=true, provider_precondition_accepted=true,operator_evidence_ref='QR140_LOCAL_ROLLBACK_PROVIDER_UNATTESTED'
           where gate_key='verified_preset_publication'
        """)
        left.execute("""
          update private.preset_storage_reservations_r18
          set reservation_state='VERIFIED_PUBLISHED_OBJECT',
              verification_evidence_state='PROVIDER_ATTESTED',
              readback_at=now(),readback_byte_size=100,readback_sha256=%s
          where reservation_id=%s
        """,('b'*64,rid))
        receipt = one(left,"""
          select private.preset_storage_commit_candidate_r18(
            %s,%s,2,%s,1,'QR140 synthetic artifact',null,'public','{}'::jsonb)
        """,(actor,rid,uuid.UUID(lease['leaseToken'])))
        direct_preset = newid()
        left.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')",(direct_preset,))
        left.execute("""
          insert into public.preset_artifacts(preset_artifact_id,owner_account_id,
             creator_profile_id,associated_gallery_work_id,preset_type)
          values(%s,%s,%s,%s,'scene')
        """,(direct_preset,owner,creator,gallery))
        left.execute("""
          insert into public.preset_revisions(
             preset_artifact_id,revision_number,artifact_blob_id,created_by_account_id)
          values(%s,1,(select committed_blob_id from private.preset_storage_reservations_r18
             where reservation_id=%s),%s)
        """,(direct_preset,rid,owner))
        # DISTINCT historical Gallery link (not the direct associated gallery):
        # its past revision references the Preset, while its current revision
        # intentionally does not. Neither historical relation may be lost.
        historical_gallery, historical_revision, current_revision = newid(),newid(),newid()
        left.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(historical_gallery,))
        left.execute("""
            insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility)
            values(%s,%s,%s,'gallery','public')
        """,(historical_gallery,owner,creator))
        left.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(historical_gallery,))
        for revision,num,title in [
            (historical_revision,1,'QR140 previous Gallery revision with Preset'),
            (current_revision,2,'QR140 current unrelated Gallery revision')]:
            left.execute("""
                insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                values(%s,%s,%s,%s)
            """,(revision,historical_gallery,num,owner))
            left.execute("""
                insert into public.gallery_work_revisions(revision_id,title,description)
                values(%s,%s,'QR140 historical relationship')
            """,(revision,title))
        left.execute("""
            insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
            values(%s,%s)
        """,(historical_revision,uuid.UUID(receipt['presetRevisionId'])))
        left.execute("""
            update public.community_works
            set lifecycle_state='published',current_published_revision_id=%s,published_at=now()
            where work_id=%s
        """,(current_revision,historical_gallery))
        left.execute("""
            insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at)
            values(%s,%s,'gallery',%s,'QR140 previous published relationship',now())
        """,(historical_gallery,historical_gallery,creator))

        left.execute("""
          update private.preset_storage_release_gate_r18
          set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null
          where gate_key='verified_preset_publication'
        """)
    assert one(right,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    current = one(right,'select public.community_gallery_media_gateway_v1(%s)',(cover_current,))
    previous = one(right,'select public.community_gallery_media_gateway_v1(%s)',(cover_history,))
    other = one(right,'select public.community_gallery_media_gateway_v1(%s)',(unrelated,))
    assert current['galleryManaged'] is True and current['publiclyAccessible'] is True
    assert current['mediaId']==str(cover_current)
    assert previous['galleryManaged'] is True and previous['publiclyAccessible'] is False
    assert 'storageKey' not in previous
    assert other['galleryManaged'] is False and other['publiclyAccessible'] is False
    assert one(right,'select private.preset_storage_media_quarantined_r19(%s)',(cover_current,)) is False
    assert one(right,'select private.preset_storage_media_quarantined_r19(%s)',(cover_history,)) is False
    assert one(right,'select private.preset_storage_media_quarantined_r19(%s)',(unrelated,)) is False
    assert one(right,'select private.preset_storage_work_quarantined_r19(%s)',(historical_gallery,)) is False
    assert not one(right,"select has_function_privilege('anon','public.community_gallery_media_gateway_v1(uuid)','execute')")
    assert one(right,"select has_function_privilege('service_role','public.community_gallery_media_gateway_v1(uuid)','execute')")
    right.execute('begin')
    report = one(right,"""
      select public.community_preset_storage_report_integrity_r18(
        %s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT',
        'QR140 cover-only post-commit local',null,null)
    """,(actor,rid))
    assert report['publicationAuthorized'] is False
    right.execute('commit')
    assert one(left,'select private.preset_storage_work_quarantined_r19(%s)',(gallery,)) is True
    assert one(left,'select private.preset_storage_work_quarantined_r19(%s)',(historical_gallery,)) is True
    assert one(left,'select count(*) from public.search_documents where work_id=%s',(historical_gallery,)) == 0
    assert one(left,'select private.preset_storage_media_quarantined_r19(%s)',(cover_history,)) is True
    assert one(left,'select private.preset_storage_media_quarantined_r19(%s)',(cover_current,)) is True
    assert one(left,'select private.preset_storage_media_quarantined_r19(%s)',(unrelated,)) is False
    left.execute('begin')
    for media in [cover_current,cover_history]:
        denied(left,'select public.community_gallery_media_gateway_v1(%s)',(media,),
               'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
    unaffected = one(left,'select public.community_gallery_media_gateway_v1(%s)',(unrelated,))
    assert unaffected['galleryManaged'] is False and unaffected['publiclyAccessible'] is False
    left.execute('rollback')
    assert one(left,'select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s',(rid,)) == 1
    assert one(left,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    # Verify compatibility behavior independently without installing or
    # describing any real Stage-only Scene definition. The temporary local
    # function and grants are created and revoked within one ROLLBACK.
    owner_sql = Path('supabase/migrations/20261025003040_r19_reader_history_graph_gap_closure.sql').read_text()
    scene_conditional = owner_sql[owner_sql.rfind('do $r19
      'case':'QR_SOURCE140_FINAL_COVER_ONLY_AND_POSTINCIDENT_GATEWAY_TWO_PG',
      'normalCurrentMediaBeforeIncident':'public',
      'historicalCoverOnlyBeforeIncident':'galleryManaged_nonpublic_noStorageKey',
      'unrelatedBeforeAndAfter':'unaffected',
      'postincidentCurrentAndCoverOnly':'both_denied',
      'historicalMediaMembershipAbsent':True,
      'directAndHistoricalSeparateGalleryLinksSuppressed':True,
      'incidentDurable':True,
      'realProviderUsed':False,
      'signedJwtUsed':False,
      'stagingTouched':False,
      'positiveReleaseGateOff':True,
      'syntheticStageOnlySqlGrantVetoLocal':True,
      'sourceScenePublicEdgeFailclosedBeforeRPC':True
    }))
):]
    assert "to_regprocedure('public.community_get_scene_preset_public_v1(uuid)')" in scene_conditional
    assert "revoke execute on function public.community_get_scene_preset_public_v1(uuid)" in scene_conditional
    public_edge = Path('supabase/functions/community-public-query/index.ts').read_text()
    closed = public_edge.index("if (rpc === 'community_get_scene_preset_public_v1')")
    first_admin_rpc = public_edge.index('ctx.supabaseAdmin.rpc(rpc, params)')
    assert closed < first_admin_rpc
    assert "SCENE_PUBLIC_READER_COMPATIBILITY_UNVERIFIED' }, 503, true" in public_edge
    left.execute('begin')
    left.execute("""
        create function public.community_get_scene_preset_public_v1(p_id uuid)
        returns jsonb language sql security definer as $qr140$ select '{}'::jsonb $qr140$
    """)
    left.execute("""
        grant execute on function public.community_get_scene_preset_public_v1(uuid)
        to public,anon,authenticated,service_role
    """)
    assert one(left,"select has_function_privilege('service_role','public.community_get_scene_preset_public_v1(uuid)','execute')")
    left.execute(scene_conditional)
    for role in ['service_role','anon','authenticated']:
        assert not one(left,"select has_function_privilege(%s,'public.community_get_scene_preset_public_v1(uuid)','execute')",(role,))
    left.execute('rollback')
    assert one(left,"select to_regprocedure('public.community_get_scene_preset_public_v1(uuid)')") is None

    print(json.dumps({
      'case':'QR_SOURCE140_FINAL_COVER_ONLY_AND_POSTINCIDENT_GATEWAY_TWO_PG',
      'normalCurrentMediaBeforeIncident':'public',
      'historicalCoverOnlyBeforeIncident':'galleryManaged_nonpublic_noStorageKey',
      'unrelatedBeforeAndAfter':'unaffected',
      'postincidentCurrentAndCoverOnly':'both_denied',
      'historicalMediaMembershipAbsent':True,
      'incidentDurable':True,
      'realProviderUsed':False,
      'signedJwtUsed':False,
      'stagingTouched':False,
      'positiveReleaseGateOff':True
    }))
