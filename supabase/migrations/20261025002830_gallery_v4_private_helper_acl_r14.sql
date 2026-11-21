-- Private R14 helper RPCs are never exposed to authenticated/anon or
-- service_role direct SQL. Only security-definer owner Gallery writer may call.
revoke all on function private.gallery_v4_scoped_graph_r14(uuid,uuid[])
  from public,anon,authenticated,service_role;
revoke all on function private.gallery_v4_atomic_lock_scoped_r14(uuid,uuid,uuid,uuid[])
  from public,anon,authenticated,service_role;
