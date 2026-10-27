#!/usr/bin/env python3
"""04 QR Issue #228 / X06: real disposable full146 post-Owner-fix, two actual PG backends.
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
query = "QR230-independent-" + new().hex[:14]
media_key = "qr230/disposable/local/" + str(media)


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
    assert scalar(writer, "select count(*) from supabase_migrations.schema_migrations") == 146
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
    catalog = writer.execute("""
      select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE'),
             has_function_privilege('authenticated',p.oid,'EXECUTE'),
             has_function_privilege('service_role',p.oid,'EXECUTE')
      from pg_proc p where p.oid='private.generic_public_search_work_accessible_r21(uuid)'::regprocedure
    """).fetchone()
    assert catalog[0] and "search_path=pg_catalog, public, private" in catalog[1], catalog
    assert catalog[2] and catalog[3] and not catalog[4], ("R21_UNEXPECTED_EXECUTE",catalog)
    assert not scalar(writer,"select has_function_privilege('anon','private.dreamsnap_public_work_accessible_r20(uuid)','EXECUTE')")
    assert scalar(writer,"select has_function_privilege('anon','public.community_search_public(text,public.work_type,uuid,text[],integer,timestamptz,uuid)','EXECUTE')")
    all_policies=writer.execute("""
      select policyname,permissive,roles,cmd,qual from pg_policies
      where schemaname='public' and tablename='search_documents'
    """).fetchall()
    anon_select=[row for row in all_policies if row[3] in ('SELECT','ALL')
       and ('anon' in row[2] or 'public' in row[2])]
    permissive=[row for row in anon_select if row[1]=='PERMISSIVE']
    restrictive=[row for row in anon_select if row[1]=='RESTRICTIVE']
    assert len(permissive)==1 and permissive[0][0]=='search_documents_public_read', ("UNEXPECTED_ANON_PERMISSIVE_OR_POLICY",anon_select)
    assert "generic_public_search_work_accessible_r21" in permissive[0][4]
    assert all(row[1] in ('PERMISSIVE','RESTRICTIVE') for row in anon_select)
    assert any("preset_storage" in row[0] for row in restrictive), ("INHERITED_R19_RESTRICTIVE_POLICY_MISSING",restrictive)
    emit({"securityAudit":"SOURCE146_R21_LIVE_CATALOG_PASS",
      "helperSecurityDefiner":catalog[0],"searchPath":catalog[1],
      "anonExecute":catalog[2],"authenticatedExecute":catalog[3],
      "serviceExecute":catalog[4],"effectiveAnonPermissivePolicies":[row[0] for row in permissive],"inheritedAnonRestrictivePolicies":[row[0] for row in restrictive]})
    emit({"source": "full146", "anonCanExecute": True,
          "functionSecurityDefiner": False, "rlsPolicy": policy[0],
          "rlsExpression": policy[2], "backendCount": 2,
          "ownerHEAD": "5ddf4d23689643340c8d547e47b58f211e03291e"})

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
          (creator,account,"qr228_"+new().hex[:18],"QR228 Synthetic Creator"))
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
          values(%s,%s,true,true,'eligible','QR228 local caption')""",
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
    # Independent query/filter/pagination checks on publisher-owned canonical index.
    with reader.transaction():
        reader.execute("set local role anon")
        def generic(q,worktype="dreamsnap",who=None,tags=None,limit=20,before_time=None,before_id=None):
            return reader.execute("""
              select work_id,title,creator_profile_id,published_at
              from public.community_search_public(
                 %s::text,%s::public.work_type,%s::uuid,%s::text[],%s::integer,
                 %s::timestamptz,%s::uuid)
            """,(q,worktype,who,tags,limit,before_time,before_id)).fetchall()
        full=generic(query,who=creator)
        assert len(full)==1 and full[0][0]==work,("SOURCE146_PUBLIC_INDEX_FILTER",full)
        assert generic(query,who=new())==[]
        assert generic("not-present-"+query,who=creator)==[]
        assert generic(query,worktype="question")==[]
        assert generic(query,who=creator,tags=["does-not-match"])==[]
        limited=generic(query,who=creator,limit=1)
        assert len(limited)==1 and limited[0][0]==work
        assert generic(query,who=creator,limit=1,before_time=limited[0][3],before_id=work)==[], "CURSOR_DUPLICATE"
        assert generic(query,who=creator,limit=0)==full, "LIMIT_MINIMUM"
    emit({"case":"QUERY_CREATOR_TYPE_TAG_LIMIT_CURSOR","status":"PASS",
          "legitimateResults":len(full),"cursorNoDuplicate":True})

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
            assert observed["canonicalIndexCount"]==1,("NONCANONICAL_INDEX_PURGE",name,observed)
            assert not observed["anonGenericMatched"] and not observed["anonDirectIndexVisible"],("SOURCE146_ANON_READER_RED",name,observed)
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

    # Independently exercise a legitimate Question publisher, not synthetic
    # manually inserted SearchDocument; preserve all other Work types' old rule.
    question_title="QR230-public-question-"+new().hex[:13]
    response=scalar(writer,
      "select public.community_ask_question_v1(%s,%s,%s,%s,%s::text[],%s,%s,%s)",
      (auth,creator,question_title,"Question body for independent public search",
       ["world","decorating"],"Nintendo Switch","1.25.3","qr230-"+new().hex))
    assert isinstance(response,dict) and "questionId" in response, ("QUESTION_PUBLISH_RPC",response)
    question_id=uuid.UUID(response["questionId"])
    assert scalar(writer,"select count(*) from public.search_documents where work_id=%s",(question_id,))==1
    with reader.transaction():
        reader.execute("set local role anon")
        question=reader.execute("""
          select work_id,title,tags from public.community_search_public(
          %s::text,'question'::public.work_type,%s::uuid,%s::text[],20,null,null)
        """,(question_title,creator,["world"])).fetchall()
        assert len(question)==1 and question[0][0]==question_id
        assert reader.execute("""
          select work_id from public.community_search_public(
          %s::text,'question'::public.work_type,%s::uuid,%s::text[],20,null,null)
        """,(question_title,creator,["not-a-tag"])).fetchall()==[]
    old_rule=bool(scalar(writer,"select private.is_discoverable_work(%s)",(question_id,)))
    new_rule=bool(scalar(writer,"select private.generic_public_search_work_accessible_r21(%s)",(question_id,)))
    assert old_rule and old_rule==new_rule, ("NON_DREAMSNAP_REGRESSION",old_rule,new_rule)
    emit({"case":"CANONICAL_QUESTION_PUBLIC","sourceProducer":"community_ask_question_v1",
          "anonReturned":True,"oldRule":old_rule,"newRule":new_rule,
          "tagFilter":True})

    # Real Work visibility lifecycle: leave SearchDocument physically present
    # and require the anon RLS to reject stale index without a manual delete.
    with writer.transaction():
        writer.execute("update public.community_works set visibility='private' where work_id=%s",(work,))
    hidden=snapshot(reader,writer,"WORK_VISIBILITY_PRIVATE")
    assert not hidden["anonGenericMatched"] and not hidden["anonDirectIndexVisible"] and not hidden["source144R20"], hidden
    # The actual DreamSnaps round guard can forbid private->public
    # republishing, so never force a resurrection through a raw UPDATE.
    # The four independent Account/Identity/Creator/Privacy restorations
    # above already prove supported positive restoration.
    assert hidden["canonicalIndexCount"]==1,("LIFECYCLE_INDEX_PURGED",hidden)
    emit({"case":"CANONICAL_INDEX_LIFECYCLE","privateDenied":True,
          "staleIndexRetained":True,"republishAttempted":False,
          "sourceRoundGuardPreserved":True})

    assert protected==["ACCOUNT_RESTRICTED","IDENTITY_RETIRED",
                       "CREATOR_ENTITY_TOMBSTONE","PRIVACY_SUPPRESSED"],protected
    emit({"marker":"QR230_INDEPENDENT_SOURCE146_ACTUAL_TWO_PG_ANON_POSTFIX_PASS",
          "classification":"INDEPENDENT_POST_OWNER_PASS",
          "protected":protected,"source146OwnerHEAD":"5ddf4d23689643340c8d547e47b58f211e03291e",
          "questionPublicPreserved":True,"filterCursorAndLifecycle":True,
          "signedActor":False,"staging":False,"storage":False,"cdn":False,
          "provider":False,"indexCreatedVia":"originalPublisherOnly"})
