#!/usr/bin/env python3
"""03 COMM Source146 / Issue #228: post-fix real disposable full146, two actual PG backends.
No Staging, HTTP, Auth sign-in, signed bearer, Provider, Storage or remote project.
Publisher RPC is the ONLY mechanism that produces SearchDocument (never manually insert).
"""
import json
import os
import uuid

import psycopg

assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
new = uuid.uuid4
account, auth, creator, work, revision, media, entry, challenge = tuple(new() for _ in range(8))
query = "COMM146-owner-" + new().hex[:14]
media_key = "comm146/disposable/local/" + str(media)


def scalar(c, sql, args=()):
    return c.execute(sql, args).fetchone()[0]


def safe(c, sql, args=()):
    try:
        with c.transaction():
            return scalar(c, sql, args)
    except psycopg.Error as e:
        return {"sqlstate": e.sqlstate, "error": str(e).split("\n")[0]}


def emit(obj):
    print(json.dumps(obj, sort_keys=True, default=str), flush=True)


def seen_id(obj):
    return isinstance(obj, dict) and obj.get("workId") == str(work)


def publish_via_canonical_rpc(writer, name):
    # This is the exact legitimate production index updater from final Source44600.
    result = scalar(writer,
        "select public.community_dreamsnap_publish_gallery_v1(%s,%s,true)",
        (auth, entry))
    assert seen_id(result), ("CANONICAL_GALLERY_PUBLISH_FAILED", name, result)
    idx = writer.execute(
        "select work_id,creator_profile_id,title from public.search_documents "
        "where work_id=%s", (work,)).fetchall()
    assert len(idx) == 1 and idx[0][0] == work and idx[0][1] == creator, (
        "CANONICAL_INDEX_MISSING", name, idx)
    emit({"indexProducer": "public.community_dreamsnap_publish_gallery_v1",
          "event": name, "canonicalIndexRows": len(idx), "title": idx[0][2]})


def snapshot(reader, writer, label):
    # Transaction bound SET LOCAL ROLE => no privileged 'service_role' RPC used
    # for generic public Search. Reader is a second actual pg_backend_pid.
    with reader.transaction():
        reader.execute("set local role anon")
        assert scalar(reader, "select current_user") == "anon"
        rows = reader.execute(
            "select entity_id,work_id,title,creator_profile_id "
            "from public.community_search_public("
            "%s::text,'dreamsnap'::public.work_type,%s::uuid,null,20,null,null)",
            (query, creator)).fetchall()
        direct = reader.execute(
            "select work_id,title from public.search_documents "
            "where work_id=%s", (work,)).fetchall()
        anon_role = scalar(reader, "select current_user")
        pid_anon = scalar(reader, "select pg_backend_pid()")
    with reader.transaction():
        reader.execute("set local role service_role")
        assert scalar(reader, "select current_user") == "service_role"
        specialized = safe(reader,
            "select public.community_search_gallery_dreamsnaps_public_v1(null,30)")
        detail = safe(reader,
            "select public.community_get_gallery_dreamsnap_public_v1(%s)", (work,))
        pid_service = scalar(reader, "select pg_backend_pid()")
    guard = bool(scalar(writer,
        "select private.dreamsnap_public_work_accessible_r20(%s)", (work,)))
    db_index = scalar(writer,
        "select count(*) from public.search_documents where work_id=%s", (work,))
    result = {
        "case": label,
        "anonRole": anon_role,
        "anonBackend": pid_anon,
        "serviceBackend": pid_service,
        "writerBackend": scalar(writer, "select pg_backend_pid()"),
        "anonGenericMatched": any(r[1] == work and query in r[2] for r in rows),
        "anonGenericWorkIDs": [str(r[1]) for r in rows if r[1] == work],
        "anonDirectIndexVisible": bool(direct),
        "canonicalIndexCount": db_index,
        "source144R20": guard,
        "source145LegacySearchMatched": isinstance(specialized, list)
            and any(seen_id(x) for x in specialized),
        "source145DetailMatched": seen_id(detail),
        "source145DetailError": detail.get("sqlstate") if isinstance(detail,dict) else None,
    }
    assert result["anonBackend"] != result["writerBackend"]
    assert pid_anon == pid_service  # same distinct reader connection, independently role-switched
    emit(result)
    return result


with psycopg.connect(DSN, autocommit=True) as writer, psycopg.connect(DSN, autocommit=True) as reader:
    assert scalar(writer, "select pg_backend_pid()") != scalar(reader, "select pg_backend_pid()")
    assert scalar(writer, "select count(*) from supabase_migrations.schema_migrations") == 147
    security = writer.execute("""
        select p.prosecdef, has_function_privilege('anon',p.oid,'EXECUTE')
        from pg_proc p where p.oid =
        'public.community_search_public(text,public.work_type,uuid,text[],integer,timestamptz,uuid)'::regprocedure
    """).fetchone()
    assert security == (False, True), ("NOT_GENUINE_SECURITY_INVOKER_ANON", security)
    policy = writer.execute("""
        select policyname,roles,qual
        from pg_policies where schemaname='public' and tablename='search_documents'
        and policyname='search_documents_public_read'
    """).fetchone()
    assert policy and "generic_public_search_work_accessible_r21" in policy[2], ("SOURCE146_POLICY_MISSING",policy)
    assert scalar(writer, "select has_function_privilege('anon','private.generic_public_search_work_accessible_r21(uuid)','EXECUTE')")
    assert not scalar(writer, "select has_function_privilege('anon','private.dreamsnap_public_work_accessible_r20(uuid)','EXECUTE')")
    assert scalar(writer, "select prosecdef from pg_proc where oid='private.generic_public_search_work_accessible_r21(uuid)'::regprocedure")
    emit({"source": "full146", "anonCanExecute": True,
          "functionSecurityDefiner": False, "rlsPolicy": policy[0],
          "rlsExpression": policy[2], "backendCount": 2,
          "ownerParentHEAD": "f9e9a4d3dc6f92a16c8ecbc6be4cb73faf808d75"})

    # Reproduce genuine relational prerequisites from accepted 04 QR #227
    # without inserting search_documents or bypassing any lifecycle trigger.
    with writer.transaction():
        writer.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
        writer.execute("""insert into public.auth_identities(
          account_id,provider,provider_subject,last_verified_at,identity_state)
          values(%s,'supabase',%s,now(),'active')""",(account,str(auth)))
        writer.execute("""insert into public.community_entities(entity_id,entity_type)
          values(%s,'creator_profile'),(%s,'community_work'),(%s,'media_asset')""",
          (creator,work,media))
        writer.execute("""insert into public.creator_profiles(
          creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,%s)""",
          (creator,account,"comm146_"+new().hex[:18],"COMM146 Synthetic Creator"))
        writer.execute("""insert into public.dreamsnap_challenges(
          challenge_id,challenge_key,title,lifecycle_state,submission_opens_at,
          submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
          formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
          minimum_real_eligible_creators,is_synthetic)
          values(%s,%s,%s,'results',now()-interval '8 hours',now()-interval '7 hours',
          now()-interval '6 hours',now()-interval '5 hours',now()-interval '4 hours',
          now()+interval '1 hour',2,1,1,1,false)""",
          (challenge,"qr228_"+new().hex[:19],query))
        writer.execute("""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
          values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
        writer.execute("""insert into public.community_work_revisions(
          revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,1,%s)""",(revision,work,account))
        writer.execute("""insert into public.dreamsnap_works(
          work_id,challenge_id,workspace_relationship_kind,managed_under13)
          values(%s,%s,'self',false)""",(work,challenge))
        writer.execute("""insert into public.dreamsnap_work_revisions(
          revision_id,challenge_id,game_screenshot_attested,
          no_external_edits_attested,integrity_state,caption)
          values(%s,%s,true,true,'eligible','COMM146 local caption')""",
          (revision,challenge))
        writer.execute("""insert into public.media_assets(
          media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
          checksum_sha256,processing_state,moderation_state)
          values(%s,%s,%s,'image/png',505,960,540,%s,'ready','clear')""",
          (media,account,media_key,"d"*64))
        writer.execute("""insert into public.work_revision_media(
          work_revision_id,media_id,ordinal,role)
          values(%s,%s,0,'dreamsnap')""",(revision,media))
        writer.execute("""insert into public.dreamsnap_entries(
          entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,
          entry_state,eligibility_state,origin_kind)
          values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",
          (entry,challenge,work,account,revision))
        writer.execute("""insert into public.dreamsnap_entry_revision_history(
          entry_id,revision_id) values(%s,%s)""",(entry,revision))
        writer.execute("""update public.community_works
          set current_published_revision_id=%s where work_id=%s""",(revision,work))
        writer.execute("""insert into public.dreamsnap_wand_results(
          entry_id,challenge_id,entry_revision_id,placement,formal_score)
          values(%s,%s,%s,1,111)""",(entry,challenge,revision))

    # There is no manual SearchDocument INSERT anywhere in this test.
    assert scalar(writer,
        "select count(*) from public.search_documents where work_id=%s",(work,)) == 0
    publish_via_canonical_rpc(writer,"INITIAL_CANONICAL_PUBLICATION")
    clean = snapshot(reader,writer,"PUBLIC_BASELINE")
    assert clean["anonGenericMatched"] and clean["anonDirectIndexVisible"]
    assert clean["source144R20"] and clean["source145LegacySearchMatched"]
    assert clean["source145DetailMatched"], ("BASELINE_INVALID",clean)

    cases = [
      ("ACCOUNT_RESTRICTED",
       "update public.wand_accounts set status='restricted' where account_id=%s",
       "update public.wand_accounts set status='active' where account_id=%s",(account,)),
      ("IDENTITY_RETIRED",
       "update public.auth_identities set identity_state='retired' where account_id=%s",
       "update public.auth_identities set identity_state='active',retired_at=null where account_id=%s",(account,)),
      ("CREATOR_ENTITY_TOMBSTONE",
       "update public.community_entities set deleted_at=now() where entity_id=%s",
       "update public.community_entities set deleted_at=null where entity_id=%s",(creator,)),
      ("PRIVACY_SUPPRESSED",
       "insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",
       "delete from private.account_privacy_suppressions where account_id=%s",(account,))
    ]
    protected=[]
    for name,change,restore,args in cases:
        with writer.transaction(): writer.execute(change,args)
        try:
            observed = snapshot(reader,writer,name)
            # Original Source144 r20 and Source145 dedicated are the external
            # reference access policy. Work remains Published/Public in DB.
            state = writer.execute(
                "select lifecycle_state::text,visibility::text from public.community_works where work_id=%s",
                (work,)).fetchone()
            assert state == ("published","public"), ("WORK_MUTATED",name,state)
            assert not observed["source144R20"]
            assert not observed["source145LegacySearchMatched"]
            assert not observed["source145DetailMatched"]
            assert observed["canonicalIndexCount"] == 1, ("INDEX_UNEXPECTEDLY_PURGED",name,observed)
            assert not observed["anonGenericMatched"], ("SOURCE146_GENERIC_SEARCH_LEAK",name,observed)
            assert not observed["anonDirectIndexVisible"], ("SOURCE146_DIRECT_INDEX_LEAK",name,observed)
            protected.append(name)
        finally:
            with writer.transaction(): writer.execute(restore,args)
        # Do not restore SearchDocument by test-only INSERT, EVER. If a
        # legitimate lifecycle transition removed the index, re-publish with
        # the exact same supported public index writer.
        if not scalar(writer,
                "select count(*) from public.search_documents where work_id=%s",(work,)):
            publish_via_canonical_rpc(writer,name+"_REINDEX_CANONICALLY")
        restored=snapshot(reader,writer,name+"_RESTORED")
        assert restored["source144R20"] and restored["source145LegacySearchMatched"]
        assert restored["anonGenericMatched"], ("POST_RESTORE_INDEX_MISSING",restored)

    # Valid non-DreamSnap work: Source146 must preserve the prior Work-level
    # discoverability semantics without borrowing DreamSnaps r20.
    other_work, other_revision = new(), new()
    with writer.transaction():
        writer.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')", (other_work,))
        writer.execute("""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
          values(%s,%s,%s,'question','draft','private')""",(other_work,account,creator))
        writer.execute("""insert into public.community_work_revisions(
          revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,1,%s)""",(other_revision,other_work,account))
        writer.execute("""update public.community_works
          set lifecycle_state='published',visibility='public',current_published_revision_id=%s,
              published_at=now() where work_id=%s""",(other_revision,other_work))
    base_other=bool(scalar(writer,"select private.is_discoverable_work(%s)",(other_work,)))
    owner_guard=bool(scalar(writer,"select private.generic_public_search_work_accessible_r21(%s)",(other_work,)))
    assert base_other and owner_guard == base_other, ("NON_DREAMSNAP_OVERDENIED",base_other,owner_guard)
    with reader.transaction():
        reader.execute("set local role anon")
        anon_other=bool(scalar(reader,"select private.generic_public_search_work_accessible_r21(%s)",(other_work,)))
        assert anon_other == base_other
    emit({"case":"NON_DREAMSNAP_QUESTION_PUBLIC_PREDICATE","preservesBaseline":True})

    assert protected == ["ACCOUNT_RESTRICTED", "IDENTITY_RETIRED",
                         "CREATOR_ENTITY_TOMBSTONE", "PRIVACY_SUPPRESSED"]
    # Existing generic RPC signature/role and Source145 comparators unchanged.
    emit({"marker":"COMM146_REAL_TWO_PG_ANON_POSTFIX_PASS",
          "classification":"OWNER_LOCAL_POSTFIX_PASS", "protected":protected,
          "source145ParentHEAD":
          "f9e9a4d3dc6f92a16c8ecbc6be4cb73faf808d75",
          "signedActor":False,"staging":False,"storage":False,"cdn":False,
          "provider":False,"indexCreatedVia":"canonical_publisher_only"})
