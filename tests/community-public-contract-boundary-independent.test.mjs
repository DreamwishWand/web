import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../docs/community/'+name, import.meta.url),'utf8');
const browser=read('browser-operator-acceptance-runbook-20260930.md');
const email=read('transactional-email-activation-dreamwishwand-com-20260930.md');
const requireAll=(s,patterns)=>patterns.every(p=>p.test(s));
const browserRules=[
 /session-bound and measured from `auth\.sessions\.created_at`/,
 /JWT refresh does not reset the window/,
 /900 seconds \/ 15 minutes/,
 /Expired sessions reject high-risk writes with `RECENT_AUTH_REQUIRED`/,
 /all prohibited owner mutations must fail/,
 /a stale SavedItem is only a reference, never an access grant/,
 /denial for a stale session, a fresh authorized session, and exact `DELETE` confirmation/,
 /local\/global browser session cleanup/,
 /not assumed complete from a Wand tombstone alone/,
 /omit reporter WandAccount identity/,
 /Comment\/Reply\/Reaction\/Follow\/Save activity must remain \*\*in-app only\*\*/,
 /Never record:/,
 /not current runtime acceptance, production approval/
];
const emailRules=[
 /operator recipient is server-only configuration/,
 /separate HTTPS API credential role/,
 /Auth credential is never exposed to Edge\/browser code/,
 /existing Vault-backed `operations_escalation` worker token/,
 /relay verifies worker authorization and rejects invalid authorization/,
 /persistent Operations Alert remains canonical/,
 /Canonical alerts survive delivery failure/,
 /self-monitor alerts do not recurse into the same failed email path/,
 /Comment \/ Reply -> no email/,/Reaction -> no email/,/Follow -> no email/,/Save -> no email/,
 /A Resend outage cannot notify through Resend/,
 /no staging acceptance is promoted to production approval/
];
test('public criteria preserve session, ownership, deletion, privacy and non-acceptance',()=>{
 assert.ok(requireAll(browser,browserRules));
 for(const p of browserRules) assert.equal(requireAll(browser.replace(p,'[omitted]'),browserRules),false,p.source);
});
test('public criteria preserve credential separation, worker authorization, canonical incident and outage',()=>{
 assert.ok(requireAll(email,emailRules));
 for(const p of emailRules) assert.equal(requireAll(email.replace(p,'[omitted]'),emailRules),false,p.source);
});
test('public projections contain no credential values, private recipients or execution-result claims',()=>{
 for(const s of [browser,email]){
  assert.doesNotMatch(s,/\bre_[A-Za-z0-9]{12,}|\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.|-----BEGIN [A-Z ]+PRIVATE KEY-----/);
  assert.doesNotMatch(s,/\b[A-Za-z0-9._%+-]+@(?!dreamwishwand\.com\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i);
  assert.doesNotMatch(s,/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  assert.doesNotMatch(s,/\b(?:COMPLETE|PASSED|PRODUCTION_ENABLED)\b/);
 }
 assert.match(browser,/Backend\/database PASS does not substitute/);
 assert.match(email,/No historical execution result is asserted here/);
});
