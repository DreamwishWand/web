-- #124: read-only storage catalog reconciliation, no object removal, no
-- logged object names, no new Media/Storage ownership model.
-- Bucket passed explicitly by the existing authenticated retention worker.
create or replace function public.community_gallery_storage_reconciliation_v1(
 p_bucket text)
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,storage as $$
declare v jsonb;
begin
 if p_bucket is null or length(p_bucket)>100
    or not exists(select 1 from storage.buckets where id=p_bucket) then
   raise exception 'GALLERY_STORAGE_RECONCILIATION_BUCKET_INVALID';
 end if;
 with origin as (
   select o.name,o.metadata,
      case when (o.metadata->>'size') ~ '^[0-9]{1,15}$'
        then (o.metadata->>'size')::bigint else null end as origin_bytes,
      m.media_id,m.byte_size,m.processing_state,m.purged_at,
      i.storage_key as journal_key,i.state as intent_state
   from storage.objects o
   left join public.media_assets m on m.storage_key=o.name
   left join public.community_media_upload_intents i on i.storage_key=o.name
   where o.bucket_id=p_bucket
 ), origin_counts as (
  select count(*)::bigint total_objects,
    count(*) filter(where media_id is not null)::bigint registered_objects,
    count(*) filter(where journal_key is not null)::bigint journaled_objects,
    count(*) filter(where media_id is null and journal_key is null)::bigint untracked_objects,
    count(*) filter(where media_id is not null and journal_key is null)::bigint registered_legacy_objects,
    count(*) filter(where media_id is null and journal_key is not null)::bigint journaled_without_asset_objects,
    count(*) filter(where origin_bytes is null)::bigint unknown_size_objects,
    count(*) filter(where media_id is not null and origin_bytes is not null
      and origin_bytes<>byte_size)::bigint registered_size_mismatch,
    coalesce(sum(origin_bytes),0)::bigint recorded_origin_bytes,
    coalesce(sum(origin_bytes) filter(where media_id is null and journal_key is null),0)::bigint untracked_origin_bytes
  from origin
 ), journal as (
  select count(*) filter(where i.state='finalized' and
   m.processing_state='ready' and m.purged_at is null and o.id is null)::bigint
   finalized_ready_missing_origin,
   count(*) filter(where i.state='aborted' and o.id is not null)::bigint
   aborted_origin_not_removed
  from public.community_media_upload_intents i
  left join public.media_assets m on m.storage_key=i.storage_key
  left join storage.objects o on o.bucket_id=p_bucket and o.name=i.storage_key
 )
 select jsonb_build_object(
  'contract','ddv.gallery-storage-reconciliation@1',
  'bucketChecked',true,
  'originObjectCount',c.total_objects,
  'originRegisteredObjectCount',c.registered_objects,
  'originJournaledObjectCount',c.journaled_objects,
  'originUntrackedObjectCount',c.untracked_objects,
  'registeredWithoutGalleryIntentCount',c.registered_legacy_objects,
  'journaledUnregisteredObjectCount',c.journaled_without_asset_objects,
  'originMetadataSizeUnknownCount',c.unknown_size_objects,
  'originMetadataRecordedBytes',c.recorded_origin_bytes,
  'untrackedOriginBytes',c.untracked_origin_bytes,
  'registeredOriginSizeMismatchCount',c.registered_size_mismatch,
  'finalizedReadyMissingOriginCount',j.finalized_ready_missing_origin,
  'abortedOriginWaitingRemovalCount',j.aborted_origin_not_removed,
  'physicalRemovalAccepted',false,
  'safeToAutoDelete',false
 ) into v
 from origin_counts c cross join journal j;
 return v;
end $$;
revoke all on function public.community_gallery_storage_reconciliation_v1(text)
 from public,anon,authenticated;
grant execute on function public.community_gallery_storage_reconciliation_v1(text)
 to service_role;