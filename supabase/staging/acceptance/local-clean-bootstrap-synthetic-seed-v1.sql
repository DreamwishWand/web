-- 03 COMM isolated CI fixtures, NEVER apply to Staging or Production.
-- Fabricated locally on a disposable DB; NOT DDV-verified live subjects/users.
-- The isolated Supabase project is destroyed after CI.
do $seed$
declare
 a uuid := gen_random_uuid();
 b uuid := gen_random_uuid();
 ca uuid := gen_random_uuid();
 wa uuid := gen_random_uuid();
 r uuid := gen_random_uuid();
begin
 -- A local metadata-only bucket is required by the read-only origin RPC.
 -- No origin object, Storage.remove, uploads or remote buckets are used.
 insert into storage.buckets(id,name,public)
 values('community-media-staging','community-media-staging',false)
 on conflict (id) do nothing;
 insert into public.wand_accounts(account_id) values (a),(b);
 insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at)
 values(a,'supabase',gen_random_uuid()::text,now()),
       (b,'supabase',gen_random_uuid()::text,now());
 insert into public.community_entities(entity_id,entity_type)
 values(ca,'creator_profile'),(wa,'community_work');
 insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
 values(ca,a,'isolated_bootstrap_creator','Synthetic Local CI Creator');
 insert into public.community_works(
   work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,
   visibility,moderation_state
 ) values(wa,a,ca,'gallery','draft','private','clear');
 insert into public.gallery_works(work_id,gallery_kind) values(wa,'outdoor');
 insert into public.gallery_verified_subjects(
   subject_id,gallery_kind,subject_type,canonical_target_id,base_item_id,
   platform,game_version,build_id,profile_schema,evidence_ref,verification_state
 ) values (
   r,'outdoor','floating_island','ci:synthetic-floating-island',null,
   'switch','1.25.0','52BD625D9B4E0053',624,
   'synthetic-local-bootstrap-only-not-game-evidence','verified'
 );
 raise notice 'ISOLATED_SYNTHETIC_ACCOUNTS_CREATOR_GALLERY_SUBJECT_READY';
end
$seed$;
