import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync('supabase/migrations/20261028000050_x05_first_work_media_bootstrap_v1.sql','utf8');
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
test('exact Source152 repaired SQL bytes fixed at accepted Owner candidate SHA',()=>{
 assert.equal(hash(sql),'cd297f48111afbb315651c6cb7e911afb1bcc03d');
});
test('PostEvent and Original return exactly the persisted normalized JSONB shape',()=>{
 assert.match(sql,/v_response\s*:=\s*jsonb_strip_nulls\(jsonb_build_object\(/);
 assert.match(sql,/'entryId'\s*,\s*v_entry/);
 assert.match(sql,/'nextOperation'\s*,\s*'pregrant'\)\)/);
 assert.match(sql,/insert\s+into\s+public\.idempotency_keys\s*\([\s\S]*?response[\s\S]*?values\([\s\S]*?v_request_hash\s*,\s*v_response/);
 assert.match(sql,/return\s+v_previous\.response\s*;/);
 assert.match(sql,/return\s+v_response\s*;/);
 assert.doesNotMatch(sql,/return\s+jsonb_strip_nulls\(v_response\)\s*;/);
});
test('same-key mismatch and same-media different-key exclusion are unchanged',()=>{
 for(const s of ["'X05_IDEMPOTENCY_KEY_REUSED'","'X05_DUPLICATE_MEDIA_WORK'",
 'pg_advisory_xact_lock','v_previous.request_hash is distinct from v_request_hash',
 "char_length(p_idempotency_key) not between 16 and 120"])
 assert.ok(sql.includes(s),s);
});
test('repair cannot grant Public, invent original Entry, claim Storage verification or policy approval',()=>{
 for(const s of ["'publicActivationAllowed',false","'officialChallengePhaseVerified',false",
 "'storageValidatedBySource152',false","'requiresPolicyGrant',true",
 "'nextOperation','pregrant'","'X05_ORIGINAL_ENTRY_NOT_FROZEN'",
 'private.dreamsnap_post_event_staged_v1'])
 assert.ok(sql.includes(s),s);
 const p=JSON.parse(readFileSync('docs/community/policy/dreamsnap-image-grant-v1.candidate.json','utf8'));
 assert.equal(p.approved,false);assert.equal(p.activateRegistry,false);
 assert.equal(p.sha256,'2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb');
});
