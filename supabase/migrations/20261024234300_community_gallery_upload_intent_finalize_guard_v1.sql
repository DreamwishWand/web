-- 03 COMM #124 hardening after the already-applied upload-intent migration.
-- The generic Community Media finalizer MUST NOT be a bypass to signed
-- Gallery intent's allowed size/type and expiration.
create or replace function private.community_media_reject_aborted_gallery_upload_v1()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_intent public.community_media_upload_intents%rowtype;
begin
 select * into v_intent from public.community_media_upload_intents i
  where i.storage_key=new.storage_key for share;
 if v_intent.storage_key is null then return new; end if;
 if v_intent.state='aborted' then raise exception 'GALLERY_UPLOAD_ABORTED';end if;
 if v_intent.state<>'pending' or now()>v_intent.expires_at then
   raise exception 'GALLERY_UPLOAD_EXPIRED_OR_CLOSED';
 end if;
 if v_intent.mime_type<>new.mime_type or v_intent.expected_bytes<>new.byte_size
 or v_intent.owner_account_id<>new.owner_account_id then
   raise exception 'GALLERY_UPLOAD_BODY_MISMATCH';
 end if;
 return new;
end $$;
revoke all on function private.community_media_reject_aborted_gallery_upload_v1()
 from public,anon,authenticated,service_role;
