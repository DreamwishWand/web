#!/usr/bin/env python3
"""04 QR R14: real Q&A/Tip Source RPCs on synthetic local PostgreSQL only.
No real JWT, no remote DSN, all disposable fixtures rolled back.
"""
import json, os, uuid
import psycopg

assert os.getenv("DDVRE_QR_R14_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_DB_URL")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,s,args=()): return c.execute(s,args).fetchone()[0]
def denied(c,s,args=()):
    c.execute("savepoint r14_negative")
    try:
        c.execute(s,args).fetchone()
    except psycopg.Error:
        c.execute("rollback to savepoint r14_negative")
        c.execute("release savepoint r14_negative")
        return True
    c.execute("release savepoint r14_negative")
    return False

with psycopg.connect(DSN,autocommit=True,connect_timeout=4) as c:
    c.execute("begin")
    try:
        a,asub,acreator=c.execute("""
            select i.account_id,i.provider_subject::uuid,p.creator_profile_id
            from public.auth_identities i
            join public.creator_profiles p on p.owner_account_id=i.account_id
            where p.handle='isolated_bootstrap_creator' and i.provider='supabase'
              and i.identity_state='active'
            limit 1
        """).fetchone()
        b,bsub=c.execute("""
            select i.account_id,i.provider_subject::uuid
            from public.auth_identities i
            where i.account_id<>%s and i.provider='supabase'
              and i.identity_state='active' limit 1
        """,(a,)).fetchone()
        bcreator=uuid.uuid4(); stem="qr14-"+str(uuid.uuid4())[:8]
        c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(bcreator,))
        c.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR R14 Synthetic Creator B')",(bcreator,b,stem))
        question_title="QR R14 privacy question "+stem
        result=one(c,"select public.community_ask_question_v1(%s,%s,%s,%s,%s,%s,%s,%s)",
            (asub,acreator,question_title,"QR R14 Q body",["qr-r14:local"],"Switch","1.25.0","r14-question-"+stem))
        q=uuid.UUID(result["questionId"])
        answer_body="QR_R14_HIDDEN_ANSWER_"+stem
        result=one(c,"select public.community_add_answer_v1(%s,%s,%s,%s,%s)",
            (bsub,bcreator,q,answer_body,"r14-answer-"+stem))
        ans=uuid.UUID(result["answerId"])
        result=one(c,"select public.community_create_tip_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (bsub,bcreator,"QR R14 tip "+stem,"QR_R14_HIDDEN_TIP_"+stem,None,None,None,q,ans,"r14-tip-"+stem))
        tip=uuid.UUID(result["tipId"])
        before=one(c,"select public.community_get_question_public_v1(%s)",(q,))
        assert before["questionId"]==str(q) and answer_body in json.dumps(before),before
        assert one(c,"select count(*) from public.community_search_questions_v1(%s,null,false,20) where question_id=%s",(question_title,q))==1
        tip_before=one(c,"select public.community_get_tip_public_v1(%s)",(tip,))
        assert tip_before is not None and str(tip) in json.dumps(tip_before)
        one(c,"select public.community_save_entity(%s,%s)",(asub,tip))
        assert one(c,"select count(*) from public.saves where account_id=%s and entity_id=%s",(a,tip))>=1

        for subj in (asub,bsub):
            c.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(subj,))
        sa=uuid.uuid4(); sb=uuid.uuid4()
        c.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp()),(%s,%s,clock_timestamp())",
                  (sa,asub,sb,bsub))
        epoch=one(c,"select extract(epoch from clock_timestamp())::bigint")
        suppress_b=one(c,"select public.community_tombstone_account(%s,%s,%s,'DELETE')",(bsub,sb,epoch))
        assert suppress_b["privacyState"]=="suppressed_cleanup_pending"
        assert denied(c,"select public.community_get_tip_public_v1(%s)",(tip,))
        after_b=one(c,"select public.community_get_question_public_v1(%s)",(q,))
        assert answer_body not in json.dumps(after_b),after_b
        assert one(c,"select count(*) from public.community_search_questions_v1(%s,null,false,20) where question_id=%s",(question_title,q))==1
        assert denied(c,"select public.community_get_my_qa_activity_v1(%s,100)",(bsub,))
        assert denied(c,"select public.community_ask_question_v1(%s,%s,%s,%s,%s,%s,%s,%s)",
            (bsub,bcreator,"Blocked R14 "+stem,"New forbidden positive publish",["qr-r14:local"],"Switch","1.25.0","r14-block-"+stem))
        assert one(c,"select count(*) from public.qa_answers where answer_id=%s",(ans,))==1
        assert one(c,"select count(*) from public.qa_tip_revisions where source_answer_id=%s",(ans,))>=1

        suppress_a=one(c,"select public.community_tombstone_account(%s,%s,%s,'DELETE')",(asub,sa,epoch))
        assert suppress_a["privacyState"]=="suppressed_cleanup_pending"
        assert one(c,"select count(*) from public.community_search_questions_v1(%s,null,false,20) where question_id=%s",(question_title,q))==0
        assert denied(c,"select public.community_get_question_public_v1(%s)",(q,))
        assert one(c,"select lifecycle_state from public.community_works where work_id=%s",(q,))=="published"
        assert one(c,"select count(*) from public.saves where account_id=%s and entity_id=%s",(a,tip))>=1
        assert one(c,"select count(*) from public.search_documents where work_id in (%s,%s)",(q,tip))==0
        print(json.dumps({"marker":"QR_R14_QA_TIP_BEHAVIOR_SOURCE_PASS",
          "questionDetailBefore":True,"answerBefore":True,"tipBefore":True,
          "answerAfterAuthorSuppression":"HIDDEN","tipAfterSuppression":"DENIED",
          "questionAfterOwnerSuppression":"DENIED","publicSearchBeforeAfter":[1,0],
          "savedReferencePhysicalPreserved":True,"ownerActivityAfterSuppression":"DENIED",
          "positiveMutationAfterSuppression":"DENIED",
          "sourceRealRpc":True,"signedJwt":False,"allFixturesRolledBack":True},sort_keys=True))
    finally:
        c.execute("rollback")
