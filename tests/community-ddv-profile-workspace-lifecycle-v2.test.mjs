import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(
  new URL('../supabase/migrations/20261001233225_community_ddv_profile_workspace_lifecycle_v2.sql',import.meta.url),
  'utf8'
);
const command=fs.readFileSync(
  new URL('../supabase/functions/community-command/index.ts',import.meta.url),
  'utf8'
);
const client=fs.readFileSync(
  new URL('../src/lib/community/commands.ts',import.meta.url),
  'utf8'
);

assert.match(sql,/slot_index smallint/i);
assert.match(sql,/slot_index between 1 and 5/i);
assert.match(sql,/lifecycle_state in \('active','archived'\)/i);
assert.match(sql,/ddv_profile_workspaces_account_slot_uq/i);
assert.match(sql,/generate_series\(1,5\)/i);
assert.match(sql,/DDV_PROFILE_WORKSPACE_LIMIT_REACHED/i);
assert.match(sql,/community_update_ddv_profile_workspace_v1/i);
assert.match(sql,/community_delete_ddv_profile_workspace_v1/i);
assert.match(sql,/p_confirmation <> 'DELETE'/i);
assert.match(sql,/delete from public\.ddv_profile_workspaces/i);
assert.match(sql,/wand_accounts_remove_ddv_profile_workspaces_on_delete/i);
assert.match(sql,/Archived workspaces still count toward the five-workspace account limit/i);
assert.match(sql,/Account\/Creator-scoped Community content must not use this cascade/i);

for (const token of [
  "updateDdvProfileWorkspace: 'community_update_ddv_profile_workspace_v1'",
  "deleteDdvProfileWorkspace: 'community_delete_ddv_profile_workspace_v1'",
  "params.p_lifecycle_state = payload.lifecycleState",
  "params.p_confirmation = payload.confirmation"
]) assert.ok(command.includes(token), token);

assert.ok(client.includes("DdvProfileWorkspaceLifecycleState = 'active' | 'archived'"));
assert.ok(client.includes('CreateDdvProfileWorkspace'));
assert.ok(client.includes('UpdateDdvProfileWorkspace'));
assert.ok(client.includes('DeleteDdvProfileWorkspace'));
assert.ok(client.includes('AssociateDdvIdentity'));
assert.ok(client.includes('UnlinkDdvIdentity'));
assert.ok(!client.includes('LinkDdvProfile'));

console.log('PASS DDV Profile Workspace lifecycle v2 contract');
