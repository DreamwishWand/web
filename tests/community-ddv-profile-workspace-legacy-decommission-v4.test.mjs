import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(
  new URL('../supabase/migrations/20261001234524_community_ddv_profile_workspace_decommission_legacy_link_v4.sql',import.meta.url),
  'utf8'
);
const admin=fs.readFileSync(
  new URL('../supabase/functions/community-admin/index.ts',import.meta.url),
  'utf8'
);

assert.match(sql,/revoke execute on function public\.community_link_ddv_profile_v1[\s\S]*from service_role/i);
assert.match(sql,/revoke execute on function public\.community_get_linked_ddv_profiles[\s\S]*from service_role/i);
assert.match(sql,/revoke execute on function public\.community_admin_correct_ddv_profile_link_v1[\s\S]*from service_role/i);
assert.match(sql,/SUPERSEDED/i);
assert.doesNotMatch(admin,/correctDdvProfileLink|community_admin_correct_ddv_profile_link_v1/);

console.log('PASS legacy exclusive DDV Profile runtime decommission');
