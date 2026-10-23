-- Golden Photo-only Gallery lifecycle: self-rolling back staging acceptance.
begin;
do $$
declare
 a uuid; b uuid; sa uuid; sb uuid; ca uuid;
 m1 uuid:=gen_random_uuid(); m2 uuid:=gen_random_uuid(); m3 uuid:=gen_random_uuid(); mb uuid:=gen_random_uuid();
 subject uuid:=gen_random_uuid(); unknown_subject uuid:=gen_random_uuid();
 w uuid; rev1 uuid; rev2 uuid; ver bigint; result jsonb; replay jsonb;
 bad_count int:=0; v_count int;
begin
 select wa.account_id,ai.provider_subject::uuid,cp.creator_profile_id
 into a,sa,ca
 from public.wand_accounts wa
 join public.auth_identities ai on ai.account_id=wa.account_id and ai.provider='supabase' and ai.identity_state='active'
 join public.creator_profiles cp on cp.owner_account_id=wa.account_id and cp.profile_visibility='public' and cp.moderation_state='clear'
 where wa.status='active' order by wa.account_id limit 1;
 select wa.account_id,ai.provider_subject::uuid into b,sb
 from public.wand_accounts wa
 join public.auth_identities ai on ai.account_id=wa.account_id and ai.provider='supabase' and ai.identity_state='active'
 where wa.status='active' and wa.account_id<>a order by wa.account_id limit 1;
 if a is null or b is null then raise exception 'ACCEPTANCE_NEEDS_TWO_EXISTING_ACTORS'; end if;

 insert into public.gallery_verified_subjects
  (subject_id,gallery_kind,subject_kind,canonical_subject_key,platform,game_version,build_identity,
    source_reference,verified_state,verified_at)
 values
  (subject,'outdoor','biome','acceptance-biome-'||gen_random_uuid()::text,'switch','1.25.0',
   '52BD625D9B4E0053','rollback-only golden test','verified',now()),
  (unknown_subject,'tom_furniture','base_item','40004201','switch','1.25.0',
   '52BD625D9B4E0053','rollback-only unverified negative','unverified',null);

 foreach w in array array[m1,m2,m3,mb] loop
  insert into public.community_entities(entity_id,entity_type) values(w,'media_asset');
 end loop;
 insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values
  (m1,a,'gallery-acceptance/'||m1,'image/png',1000,1920,1080,repeat('a',64),'ready','clear'),
  (m2,a,'gallery-acceptance/'||m2,'image/png',1000,1920,1080,repeat('b',64),'ready','clear'),
  (m3,a,'gallery-acceptance/'||m3,'image/png',1000,1920,1080,repeat('c',64),'ready','clear'),
  (mb,b,'gallery-acceptance/'||mb,'image/png',1000,1920,1080,repeat('d',64),'ready','clear');

 -- Never publish an unverified or misleading subject.
 begin
  perform public.community_publish_gallery_photo_v1(sa,ca,unknown_subject,'Rejected','',array[m1],m1,true,'negative-subject-'||gen_random_uuid());
 exception when others then
  if sqlerrm like '%GALLERY_SUBJECT_NOT_VERIFIED_FOR_TARGET%' then bad_count:=bad_count+1; else raise; end if;
 end;
 -- ToM record requires exact positive Base Item/subject pairing.
 begin
  insert into public.gallery_verified_subjects
   (gallery_kind,subject_kind,canonical_subject_key,base_item_id,platform,game_version,build_identity,source_reference,verified_state,verified_at)
  values ('tom_clothing','base_item','some-other-id',40004201,'switch','1.25.0','52BD625D9B4E0053','invalid', 'verified',now());
 exception when check_violation then bad_count:=bad_count+1;
 end;
 begin
  perform public.community_publish_gallery_photo_v1(sa,ca,subject,'Rejected','',array[m1,mb],m1,true,'negative-media-'||gen_random_uuid());
 exception when others then
  if sqlerrm like '%GALLERY_MEDIA_NOT_VERIFIED_OR_NOT_OWNED%' then bad_count:=bad_count+1; else raise; end if;
 end;
 begin
  perform public.community_publish_gallery_photo_v1(sa,ca,subject,'Rejected','',array[m1,m1],m1,true,'negative-duplicate-'||gen_random_uuid());
 exception when others then
  if sqlerrm like '%GALLERY_MEDIA_DUPLICATED%' then bad_count:=bad_count+1; else raise; end if;
 end;
 begin
  perform public.community_publish_gallery_photo_v1(sa,ca,subject,'Rejected','',array[m1],m2,true,'negative-cover-'||gen_random_uuid());
 exception when others then
  if sqlerrm like '%GALLERY_COVER_NOT_INCLUDED%' then bad_count:=bad_count+1; else raise; end if;
 end;

 result:=public.community_publish_gallery_photo_v1(sa,ca,subject,'Golden gallery scene','Photo only',array[m1,m2],m2,true,'golden-create-'||m1);
 w:=(result->>'workId')::uuid;
 rev1:=(result->>'revisionId')::uuid;
 ver:=(result->>'rowVersion')::bigint;
 if w is null or result->>'visibility'<>'public' or result->>'lifecycleState'<>'published'
 then raise exception 'ACCEPTANCE_CREATE_PUBLIC_FAILED'; end if;
 replay:=public.community_publish_gallery_photo_v1(sa,ca,subject,'Golden gallery scene','Photo only',array[m1,m2],m2,true,'golden-create-'||m1);
 if replay is distinct from result then raise exception 'ACCEPTANCE_CREATE_IDEMPOTENCY_FAILED'; end if;
 if (select count(*) from public.community_work_revisions where work_id=w)<>1
 then raise exception 'ACCEPTANCE_DUPLICATE_REVISION'; end if;
 if (select sealed_at from public.community_work_revisions where revision_id=rev1) is null
 then raise exception 'ACCEPTANCE_REVISION_NOT_SEALED'; end if;
 if (public.community_get_gallery_public_v1(w)->>'workId')::uuid<>w
 then raise exception 'ACCEPTANCE_PUBLIC_DETAIL_FAILED'; end if;
 if (public.community_get_public_media_storage_v2(m2)->>'mediaId')::uuid<>m2
 then raise exception 'ACCEPTANCE_PUBLIC_MEDIA_RESOLVER_FAILED'; end if;
 if (select media_id from public.work_revision_media where work_revision_id=rev1 and ordinal=0)<>m1
 then raise exception 'ACCEPTANCE_ORDER_FAILED'; end if;

 begin
  perform public.community_update_gallery_photo_v1(sb,w,ver,'Hacked','',array[m1],m1,subject,'nonowner-'||m1);
 exception when others then
  if sqlerrm like '%GALLERY_NOT_OWNER%' then bad_count:=bad_count+1; else raise; end if;
 end;
 begin
  perform public.community_update_gallery_photo_v1(sa,w,ver,'Retarget','',array[m1],m1,unknown_subject,'retarget-'||m1);
 exception when others then
  if sqlerrm like '%GALLERY_SUBJECT_IDENTITY_IMMUTABLE%' then bad_count:=bad_count+1; else raise; end if;
 end;
 begin
  perform public.community_update_gallery_photo_v1(sa,w,ver,'Replace artwork','',array[m3],m3,subject,'artwork-'||m1);
 exception when others then
  if sqlerrm like '%GALLERY_UPDATE_ARTWORK_CONTINUITY_REQUIRED%' then bad_count:=bad_count+1; else raise; end if;
 end;

 result:=public.community_update_gallery_photo_v1(sa,w,ver,'Golden gallery scene updated','Updated caption',array[m2,m3],m3,subject,'golden-update-'||m1);
 rev2:=(result->>'revisionId')::uuid;
 ver:=(result->>'rowVersion')::bigint;
 if rev1=rev2 or (select count(*) from public.community_work_revisions where work_id=w)<>2
 then raise exception 'ACCEPTANCE_UPDATE_REVISION_FAILED'; end if;
 if (select title from public.gallery_work_revisions where revision_id=rev1)<>'Golden gallery scene'
 then raise exception 'ACCEPTANCE_OLD_REVISION_CHANGED'; end if;
 if (public.community_get_gallery_public_v1(w)->>'title')<>'Golden gallery scene updated'
 then raise exception 'ACCEPTANCE_LIVE_REVISION_NOT_UPDATED'; end if;
 replay:=public.community_update_gallery_photo_v1(sa,w,(select row_version from public.community_works where work_id=w)-1,
 'Golden gallery scene updated','Updated caption',array[m2,m3],m3,subject,'golden-update-'||m1);
 if replay is distinct from result then raise exception 'ACCEPTANCE_UPDATE_IDEMPOTENCY_FAILED'; end if;
 begin
  perform public.community_update_gallery_photo_v1(sa,w,ver-1,'Conflict','',array[m2],m2,subject,'conflict-'||m1);
 exception when others then
  if sqlerrm like '%GALLERY_VERSION_CONFLICT%' then bad_count:=bad_count+1; else raise; end if;
 end;

 begin
  perform public.community_retire_gallery_photo_v1(sa,w,ver,'keep_private','cloud-fail-'||m1);
 exception when others then
  if sqlerrm like '%GALLERY_CLOUD_PRIVATE_PRESERVATION_REQUIRED%' then bad_count:=bad_count+1; else raise; end if;
 end;
 if (select lifecycle_state from public.community_works where work_id=w)<>'published'
 then raise exception 'ACCEPTANCE_CLOUD_FAILED_OPEN'; end if;
 begin
  perform public.community_retire_gallery_photo_v1(sb,w,ver,'delete','nonowner-delete-'||m1);
 exception when others then
  if sqlerrm like '%GALLERY_NOT_OWNER%' then bad_count:=bad_count+1; else raise; end if;
 end;
 result:=public.community_retire_gallery_photo_v1(sa,w,ver,'delete','golden-delete-'||m1);
 replay:=public.community_retire_gallery_photo_v1(sa,w,ver,'delete','golden-delete-'||m1);
 if replay is distinct from result then raise exception 'ACCEPTANCE_RETIRE_IDEMPOTENCY_FAILED'; end if;
 if (select lifecycle_state from public.community_works where work_id=w)<>'deleted'
 or exists(select 1 from public.search_documents where work_id=w)
 then raise exception 'ACCEPTANCE_RETIRE_VISIBILITY_FAILED'; end if;
 begin
  perform public.community_get_gallery_public_v1(w);
  raise exception 'ACCEPTANCE_DELETED_PUBLIC_DETAIL_VISIBLE';
 exception when others then
  if sqlerrm like '%ACCEPTANCE_DELETED_PUBLIC_DETAIL_VISIBLE%' then raise; end if;
 end;
 begin
  perform public.community_get_public_media_storage_v2(m3);
  raise exception 'ACCEPTANCE_DELETED_PUBLIC_MEDIA_VISIBLE';
 exception when others then
  if sqlerrm like '%ACCEPTANCE_DELETED_PUBLIC_MEDIA_VISIBLE%' then raise; end if;
 end;
 if has_function_privilege('anon','public.community_publish_gallery_photo_v1(uuid,uuid,uuid,text,text,uuid[],uuid,boolean,text)','execute')
 or has_function_privilege('authenticated','public.community_update_gallery_photo_v1(uuid,uuid,bigint,text,text,uuid[],uuid,uuid,text)','execute')
 then raise exception 'ACCEPTANCE_UNAUTHORIZED_EXECUTE_EXPOSED'; end if;
 if bad_count<>11 then raise exception 'ACCEPTANCE_NEGATIVE_TEST_COUNT %',bad_count; end if;
 raise notice 'GALLERY_PHOTO_GOLDEN_ROLLBACK_PASS negative=%, work=%',bad_count,w;
end $$;
rollback;
