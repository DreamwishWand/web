create index if not exists ddv_identity_associations_workspace_account_idx
  on private.ddv_identity_associations(workspace_id,account_id);
