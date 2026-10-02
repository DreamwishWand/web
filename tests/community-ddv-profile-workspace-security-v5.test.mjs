import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(
  new URL('../supabase/migrations/20261002003039_community_ddv_profile_workspace_delete_reauth_rate_v5.sql',import.meta.url),
  'utf8'
);
const command=fs.readFileSync(
  new URL('../supabase/functions/community-command/index.ts',import.meta.url),
  'utf8'
);

assert.match(sql,/ddv_profile_workspace_delete_recent_auth_seconds',900/i);
assert.match(sql,/ddv_profile_workspace_write',3600,60,true/i);
assert.match(sql,/ddv_profile_identity',3600,12,true/i);
assert.match(sql,/where bucket='ddv_profile_link'/i);
assert.match(sql,/set enabled=false/i);

assert.match(
  sql,
  /community_delete_ddv_profile_workspace_v1\([\s\S]*p_session_id uuid[\s\S]*p_issued_at_epoch bigint[\s\S]*p_workspace_id uuid[\s\S]*p_confirmation text/i
);
assert.match(sql,/private\.require_recent_session/i);
assert.match(sql,/ddv_profile_workspace_delete_recent_auth_seconds/i);
assert.match(sql,/Recent-auth policy is not configured|recent-auth policy is not configured/i);
assert.match(sql,/drop function public\.community_delete_ddv_profile_workspace_v1\(uuid,uuid,text\)/i);
assert.match(sql,/grant execute on function public\.community_delete_ddv_profile_workspace_v1\([\s\S]*uuid,uuid,bigint,uuid,text[\s\S]*to service_role/i);

for (const token of [
  "createDdvProfileWorkspace: 'ddv_profile_workspace_write'",
  "updateDdvProfileWorkspace: 'ddv_profile_workspace_write'",
  "deleteDdvProfileWorkspace: 'ddv_profile_workspace_write'",
  "associateDdvIdentity: 'ddv_profile_identity'",
  "unlinkDdvIdentity: 'ddv_profile_identity'",
  "params.p_session_id = sessionId",
  "params.p_issued_at_epoch = issuedAt"
]) assert.ok(command.includes(token), token);

assert.ok(!command.includes("createDdvProfileWorkspace: 'ddv_profile_link'"));
assert.ok(!command.includes("associateDdvIdentity: 'ddv_profile_link'"));

console.log('PASS Profile Workspace delete recent-auth and rate-limit v5 contract');
