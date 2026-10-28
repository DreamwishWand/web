#!/usr/bin/env python3
"""04 QR independent Source149: only disposable full149 local DB, synthetic identifiers.
Never contacts staging, provider, Storage or online DDV services."""
import os, uuid, json
from concurrent.futures import ThreadPoolExecutor
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL') == 'CONFIRMED'
assert not os.getenv('SUPABASE_ACCESS_TOKEN') and not os.getenv('DATABASE_URL')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def val(conn,q,args=()): return conn.execute(q,args).fetchone()[0]
def denied(conn,q,args=()):
    with conn.transaction():
        conn.execute('savepoint qrnegative')
        try: conn.execute(q,args)
        except psycopg.Error as e:
            conn.execute('rollback to savepoint qrnegative')
            conn.execute('release savepoint qrnegative')
            return e.sqlstate
        conn.execute('rollback to savepoint qrnegative')
        conn.execute('release savepoint qrnegative')
    return None
def proof(tag,**kw): print(json.dumps({'marker':tag,**kw},sort_keys=True,default=str),flush=True)

grant_sql='select private.dreamsnap_x05_record_creator_grant_v1(%s,%s,%s,%s,%s,%s,%s,true,true)'
transition_sql='select private.dreamsnap_x05_owner_transition_v1(%s,%s,%s,%s,%s)'
def fixture(conn):
    account,auth,creator,challenge=[U() for _ in range(4)]
    works=[(U(),U(),U()) for _ in range(3)]
    with conn.transaction():
        conn.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
        conn.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
            values(%s,'supabase',%s,now(),'active')""",(account,str(auth)))
        conn.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        conn.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR149')",
                     (creator,account,'qr149_'+U().hex[:19]))
        conn.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
            submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
            formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
            minimum_real_eligible_creators,is_synthetic)
            values(%s,%s,'QR synthetic only','results',now()-interval '8 hours',
            now()-interval '7 hours',now()-interval '6 hours',now()-interval '5 hours',
            now()-interval '4 hours',now()+interval '1 hour',2,1,1,1,false)""",
            (challenge,'qr149_'+U().hex[:19]))
        for n,(work,photo,media) in enumerate(works):
            conn.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
            conn.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
                values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
            conn.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                values(%s,%s,1,%s)""",(photo,work,account))
            conn.execute("""insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13)
                values(%s,%s,'self',false)""",(work,challenge))
            conn.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
                no_external_edits_attested,integrity_state,caption)
                values(%s,%s,true,true,'eligible','QR synthetic')""",(photo,challenge))
            conn.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
                width,height,checksum_sha256,processing_state,moderation_state)
                values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
                (media,account,'qr149/disposable/'+str(media),'a'*64))
            conn.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(photo,media))
            conn.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(photo,work))
            if n==0:
                entry=U()
                conn.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,managed_under13,
                    entry_revision_id,entry_state,eligibility_state,origin_kind)
                    values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,challenge,work,account,photo))
                conn.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,photo))
                conn.execute("""insert into public.dreamsnap_gallery_publications(work_id,entry_id,revision_id,publication_state)
                    values(%s,%s,%s,'published')""",(work,entry,photo))
                conn.execute("""update public.community_works set lifecycle_state='published',visibility='public',
                    current_published_revision_id=%s,published_at=now() where work_id=%s""",(photo,work))
            else:
                conn.execute("""insert into private.dreamsnap_post_event_staged_v1(
                    work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
                    values(%s,%s,%s,%s,%s,%s)""",(work,challenge,creator,photo,media,photo))
    return account,auth,creator,challenge,works

with psycopg.connect(DSN,autocommit=True) as db,psycopg.connect(DSN,autocommit=True) as peer:
    assert val(db,'select count(*) from supabase_migrations.schema_migrations')==149
    assert val(db,'select pg_backend_pid()')!=val(peer,'select pg_backend_pid()')
    signatures=[
      'private.dreamsnap_x05_record_creator_grant_v1(uuid,uuid,uuid,uuid,text,text,bigint,boolean,boolean)',
      'private.dreamsnap_x05_owner_transition_v1(uuid,uuid,bigint,text,uuid)',
      'private.dreamsnap_x05_schedule_preflight_v1(timestamptz,timestamptz)',
      'private.dreamsnap_x05_control_live_v1(uuid)',
      'private.dreamsnap_x05_public_activation_v1(uuid)'
    ]
    fn_oids=[val(db,'select %s::regprocedure::oid',(sig,)) for sig in signatures]
    tables=['private.dreamsnap_x05_work_control_v1','private.dreamsnap_x05_consent_events_v1','private.dreamsnap_x05_purge_tracking_v1']
    table_oids=[val(db,'select %s::regclass::oid',(s,)) for s in tables]
    for role in ('anon','authenticated','service_role'):
        with peer.transaction():
            peer.execute('set local role '+role)
            for oid in fn_oids:
                assert val(peer,"select has_function_privilege(current_user,%s::oid,'EXECUTE')",(oid,)) is False
            for oid in table_oids:
                for privilege in ('SELECT','INSERT','UPDATE','DELETE'):
                    assert val(peer,'select has_table_privilege(current_user,%s::oid,%s)',(oid,privilege)) is False
    assert val(db,"select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'dreamsnap_x05_%%'")==0
    proof('QR149_REAL_PRIVATE_ACL_NO_EXTERNAL_CALLER_PASS')

    anchor='2026-10-14 13:00:00+00'
    for current,kind in [('2026-10-14 12:59:59+00','upcoming'),('2026-10-14 13:00:00+00','submission'),
                         ('2026-10-21 12:59:59+00','submission'),('2026-10-21 13:00:00+00','voting'),
                         ('2026-10-28 12:59:59+00','voting'),('2026-10-28 13:00:00+00','scheduled_post_voting')]:
        result=val(db,'select private.dreamsnap_x05_schedule_preflight_v1(%s::timestamptz,%s::timestamptz)',(anchor,current))
        assert result['scheduleState']==kind,(current,result)
        assert result['positivePublicAllowed'] is False
        assert result['officialServerPhaseVerified'] is False and result['verifiedChallengeId'] is False
    for broken in ('2026-10-14 12:59:59+00','2026-10-15 13:00:00+00'):
        assert val(db,'select private.dreamsnap_x05_schedule_preflight_v1(%s::timestamptz,now())',(broken,))['scheduleState']=='invalid_anchor'
    assert val(db,'select private.dreamsnap_x05_schedule_preflight_v1(null,now())')['positivePublicAllowed'] is False
    proof('QR149_INDEPENDENT_WEDNESDAY_UTC_168_336_PUBLIC_FALSE_PASS')

    account,auth,creator,challenge,works=fixture(db)
    orig,after,racer=works
    d='c'*64
    g1=val(db,grant_sql,(auth,*orig,'qr-policy-v1',d,0))
    g2=val(db,grant_sql,(auth,*after,'qr-policy-v1',d,0))
    g3=val(db,grant_sql,(auth,*racer,'qr-policy-v1',d,0))
    assert [g1['kind'],g2['kind'],g3['kind']]==['OriginalCompetition','PostEventCreation','PostEventCreation']
    assert val(db,'select count(*) from public.dreamsnap_entries where work_id=%s',(after[0],))==0
    assert val(db,'select count(*) from public.dreamsnap_entries where work_id=%s',(orig[0],))==1
    assert denied(db,grant_sql,(auth,after[0],orig[1],after[2],'qr-policy-v2',d,1))
    assert denied(db,grant_sql,(auth,after[0],after[1],orig[2],'qr-policy-v2',d,1))
    assert denied(db,grant_sql,(U(),after[0],after[1],after[2],'qr-policy-v2',d,1))
    assert denied(db,grant_sql,(auth,after[0],after[1],after[2],'qr-policy-v2',d,0))
    proof('QR149_ORIGINAL_FROZEN_POSTEVENT_ENTRY_FREE_OWNER_MEDIA_CONSENT_PASS')

    # A grant and withdrawal simultaneously observe one row_version, but only one wins.
    def race(action):
        with psycopg.connect(DSN,autocommit=True) as c:
            try:
                if action=='withdraw': outcome=val(c,transition_sql,(auth,racer[0],1,'withdraw',None))
                else: outcome=val(c,grant_sql,(auth,*racer,'qr-policy-v2','d'*64,1))
                return ('win',action,outcome['rowVersion'])
            except psycopg.Error as e: return ('blocked',action,e.sqlstate)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(race,('withdraw','grant')))
    assert len([r for r in results if r[0]=='win'])==1,results
    assert len([r for r in results if r[0]=='blocked'])==1,results
    winner=next(x for x in results if x[0]=='win')[1]
    status=val(db,'select control_state from private.dreamsnap_x05_work_control_v1 where work_id=%s',(racer[0],))
    assert status==('withdrawn' if winner=='withdraw' else 'consented')
    assert val(db,'select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s',(racer[0],))==2
    assert val(db,'select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s',(racer[0],))==2
    assert denied(db,grant_sql,(auth,*racer,'qr-policy-old',d,1))
    proof('QR149_TWO_REAL_BACKENDS_WITHDRAW_VERSUS_GRANT_CAS_SERIALIZABLE_PASS',winner=winner)

    assert val(db,'select private.dreamsnap_public_work_accessible_r20(%s)',(orig[0],)) is True
    before=val(db,"select count(*) from public.outbox_events where aggregate_id=%s and event_type like 'dreamsnap.x05_nonpublic_%%'",(orig[0],))
    assert denied(db,transition_sql,(auth,orig[0],1,'unknown-operation',None))
    assert val(db,"select count(*) from public.outbox_events where aggregate_id=%s and event_type like 'dreamsnap.x05_nonpublic_%%'",(orig[0],))==before
    assert val(db,'select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s',(orig[0],))==1
    withdrawn=val(db,transition_sql,(auth,orig[0],1,'withdraw',None))
    assert withdrawn['state']=='withdrawn'
    assert val(db,'select visibility from public.community_works where work_id=%s',(orig[0],))=='private'
    assert val(db,'select publication_state from public.dreamsnap_gallery_publications where work_id=%s',(orig[0],))=='unpublished'
    assert val(db,'select private.dreamsnap_public_work_accessible_r20(%s)',(orig[0],)) is False
    assert val(db,'select private.dreamsnap_shared_public_work_metadata_v1(%s)',(orig[0],)) is None
    assert denied(db,transition_sql,(auth,orig[0],1,'withdraw',None))
    assert denied(db,grant_sql,(auth,*orig,'qr-policy-v3',d,2))
    proof('QR149_WITHDRAW_VISIBILITY_ORIGINAL_LEGACY_METADATA_GATE_PASS')

    erased=val(db,transition_sql,(auth,after[0],1,'delete',None))
    assert erased['state']=='delete_requested' and erased['purgeState']=='requested'
    assert val(db,'select request_state from private.dreamsnap_x05_purge_tracking_v1 where work_id=%s',(after[0],))=='requested'
    assert val(db,'select verified_at from private.dreamsnap_x05_purge_tracking_v1 where work_id=%s',(after[0],)) is None
    assert val(db,'select provider_receipt_digest from private.dreamsnap_x05_purge_tracking_v1 where work_id=%s',(after[0],)) is None
    assert val(db,'select visibility from public.community_works where work_id=%s',(after[0],))=='private'
    assert val(db,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='dreamsnap.x05_nonpublic_delete'",(after[0],))==1
    assert denied(db,transition_sql,(auth,after[0],1,'delete',None))
    assert val(db,'select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action=%s',(after[0],'delete_requested'))==1
    assert val(db,'select public_activation_allowed from private.dreamsnap_x05_work_control_v1 where work_id=%s',(after[0],)) is False
    proof('QR149_ATOMIC_DELETE_OUTBOX_NO_PHYSICAL_PURGE_CLAIM_PASS')
    proof('QR149_INDEPENDENT_FULL149_SOURCE_LOCAL_DONE',backends=[val(db,'select pg_backend_pid()'),val(peer,'select pg_backend_pid()')])
