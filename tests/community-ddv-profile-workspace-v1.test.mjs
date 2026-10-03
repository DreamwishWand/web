import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(
  new URL('../supabase/migrations/20261001232814_community_ddv_profile_workspace_v1.sql',import.meta.url),
  'utf8'
);

assert.match(sql,/create table public\.ddv_profile_workspaces/i);
assert.match(sql,/create table private\.ddv_identity_associations/i);
assert.match(sql,/unique \(account_id,binding_key_hash\)/i);
assert.doesNotMatch(sql,/unique \(binding_key_hash\)/i);
assert.match(sql,/>= 5/);
assert.match(sql,/DDV_PROFILE_WORKSPACE_LIMIT_REACHED/);
assert.match(sql,/community_create_ddv_profile_workspace_v1/);
assert.match(sql,/community_get_ddv_profile_workspaces_v1/);
assert.match(sql,/community_associate_ddv_identity_v1/);
assert.match(sql,/community_unlink_ddv_identity_v1/);
assert.match(sql,/identityAssociated.*false/s);
assert.match(sql,/DDV_IDENTITY_ALREADY_ASSOCIATED_IN_ACCOUNT/);
assert.match(sql,/delete from private\.ddv_identity_associations[\s\S]*workspace_id=p_workspace_id/);
assert.doesNotMatch(sql,/delete from public\.ddv_profile_workspaces[\s\S]*community_unlink_ddv_identity_v1/);
assert.match(sql,/revoke all on table public\.ddv_profile_workspaces from public,anon,authenticated/i);
assert.match(sql,/alter table public\.ddv_profile_workspaces enable row level security/i);
assert.match(sql,/grant execute on function public\.community_associate_ddv_identity_v1\(uuid,uuid,text\)[\s\S]*to service_role/i);
assert.doesNotMatch(sql,/raw.*player.*id/i);

console.log('PASS DDV Profile Workspace v1 product contract');
