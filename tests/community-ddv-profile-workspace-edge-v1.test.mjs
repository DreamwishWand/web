import assert from 'node:assert/strict';
import fs from 'node:fs';

const command=fs.readFileSync(
  new URL('../supabase/functions/community-command/index.ts',import.meta.url),
  'utf8'
);
const query=fs.readFileSync(
  new URL('../supabase/functions/community-query/index.ts',import.meta.url),
  'utf8'
);

for (const token of [
  "createDdvProfileWorkspace: 'community_create_ddv_profile_workspace_v1'",
  "associateDdvIdentity: 'community_associate_ddv_identity_v1'",
  "unlinkDdvIdentity: 'community_unlink_ddv_identity_v1'",
  "deriveDdvIdentityDigest",
  "params.p_workspace_id = payload.workspaceId",
  "params.p_binding_key_hash = bindingDigest"
]) assert.ok(command.includes(token), token);

assert.ok(query.includes("ddvProfileWorkspaces: 'community_get_ddv_profile_workspaces_v1'"));
assert.ok(!command.includes('linkDdvProfile'));
assert.ok(!command.includes('community_link_ddv_profile_v1'));
assert.ok(!query.includes('linkedDdvProfiles'));
assert.ok(!query.includes('community_get_linked_ddv_profiles'));
assert.ok(!command.includes('COMMUNITY_DDV_PROFILE_LINK_MODE'));
assert.ok(command.includes('COMMUNITY_DDV_PROFILE_BINDING_KEY_V1'));
assert.ok(command.includes('dreamwishwand/ddv-player-id/v1\\0'));
assert.ok(command.includes('DDV_PROFILE_WORKSPACE_LIMIT_REACHED'));
assert.ok(command.includes('DDV_IDENTITY_ALREADY_ASSOCIATED_IN_ACCOUNT'));

console.log('PASS DDV Profile Workspace Edge transport contract');
