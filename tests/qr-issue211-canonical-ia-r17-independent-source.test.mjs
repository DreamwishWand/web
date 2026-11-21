import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// INDEPENDENT STATIC NEGATIVE ACCEPTANCE; the expected mismatches below are
// historical main witnesses, NEVER acceptance of production behavior.
// Zero Auth / network / Provider / DB / publication / deployment.
const root = process.cwd();
const fixture = JSON.parse(readFileSync(resolve(root,'tests/fixtures/qr-issue211-canonical-ia-r17-readonly-20261027.json'),'utf8'));
const file = p => readFileSync(resolve(root,p),'utf8');
const sourcePaths = Object.keys(fixture.liveSourceBlobs);
const content = Object.fromEntries(sourcePaths.map(p => [p,file(p)]));
const blob = s => {const b=Buffer.from(s);return createHash('sha1').update('blob '+b.length).update(Buffer.from([0])).update(b).digest('hex');};
const one = p => content[p];
const has = (p,fragment) => assert.ok(one(p).includes(fragment),p+' missed '+fragment);
test('historical R17 remains 30 unique rows / 23 product jobs + 7 shared infrastructure / 0 PASS 12 PARTIAL 18 BLOCKED',()=>{
 const rows=fixture.historicalR17;
 assert.equal(rows.length,30);
 assert.equal(new Set(rows.map(x=>x.id)).size,30);
 assert.equal(rows.filter(x=>x.id.startsWith('COMM-')).length,7);
 assert.equal(rows.filter(x=>!x.id.startsWith('COMM-')).length,23);
 assert.equal(rows.filter(x=>x.verdict==='PARTIAL').length,12);
 assert.equal(rows.filter(x=>x.verdict==='BLOCKED').length,18);
 assert.equal(rows.filter(x=>x.verdict==='PASS').length,0);
 assert.equal(fixture.identity.mainExactHead,'71e568c9b576c54f8d100fae2ae883c835de7602');
});
test('all D01-D10 and IA-01..09 have existing R17 parents; no ninth IA subcase creates a new row',()=>{
 const frozen=new Set(fixture.historicalR17.map(x=>x.id));
 assert.deepEqual(fixture.proposalD.map(x=>x.id),Array.from({length:10},(_,i)=>'D'+String(i+1).padStart(2,'0')));
 assert.deepEqual(fixture.subcases.map(x=>x.id),Array.from({length:9},(_,i)=>'IA-'+String(i+1).padStart(2,'0')));
 for(const row of [...fixture.proposalD,...fixture.subcases])for(const id of row.r17)assert.ok(frozen.has(id),'UNKNOWN_R17_ROW '+row.id+'/'+id);
 for(const row of fixture.subcases){
  assert.equal(row.chrome,'NOT_EXECUTED');
  assert.equal(row.signedActor,'CONFIGURATION_BLOCKED');
  assert.equal(row.realRuntime,'NOT_EXECUTED');
  assert.equal(row.privacyE2E,'NOT_EXECUTED');
 }
});
test('exact pre-existing main Svelte file blobs match independently observed immutable sources',()=>{
 for(const [p,expected] of Object.entries(fixture.liveSourceBlobs))assert.equal(blob(one(p)),expected,'MAIN_SOURCE_BLOB_CHANGED '+p);
});
test('IA-01: historic Guide main exposes issues as a fifth tab; owner four-item root parity NOT PROVEN',()=>{
 const p='src/routes/guide/+page.svelte';
 has(p,"type Section='quests'|'starPaths'|'events'|'systems'|'issues'");
 has(p,"['quests','starPaths','events','systems','issues']");
 assert.equal(fixture.proposalD[0].classification,'OWNER_SUPERSESSION_AND_CONFIRMED_SOURCE_CONFLICT');
});
test('IA-02: main Q&A uses simple unansweredOnly RPC; no evidence of resolution + zero-answers hierarchy',()=>{
 has('src/routes/qa/+page.svelte','p_unanswered_only: unansweredOnly');
 has('src/lib/community/QaBrowse.svelte','bind:checked={unansweredOnly}');
 assert.equal(fixture.proposalD[1].r17[0],'CHC-Q');
});
test('IA-03: historical Gallery DreamSnaps path remains linked and callable, NOT a proven safe redirect',()=>{
 has('src/routes/gallery/+page.svelte','/gallery/dreamsnaps/');
 has('src/routes/gallery/dreamsnaps/+page.svelte','community_search_gallery_dreamsnaps_public_v1');
 has('src/routes/gallery/dreamsnaps/+page.svelte','getPublicCommunityMedia');
 assert.equal(fixture.proposalD[2].r17[0],'DS-COM');
});
test('IA-04/05: DreamSnaps main landing exposes four links not approved 1-3-1 Community DreamSnaps five-job surface',()=>{
 const tabs=one('src/lib/community/DreamsnapsTabs.svelte');
 for(const segment of ['/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/'])assert.ok(tabs.includes(segment));
 assert.equal((tabs.match(/href=/g)||[]).length,4);
 has('src/routes/dreamsnaps/+page.svelte','<DreamsnapsTabs />');
 assert.equal(fixture.proposalD[3].r17.length,4);
});
test('IA-06: main My DreamSnaps has per-entry/per-field official result publication control, not owner-approved global account switch',()=>{
 const my=one('src/routes/dreamsnaps/my/+page.svelte');
 assert.ok(my.includes('setDreamsnapOfficialResultPublication'));
 assert.ok(my.includes('entryId, publicFields: selectedFields[entryId]'));
 assert.ok(my.includes("['score','rank','moonstones','pixel_dust']"));
 assert.ok(my.includes('toggleField(String(entry.entryId)'));
});
test('IA-07: main Collection has permanent category/world/universe switch (later owner explicitly superseded)',()=>{
 const col=one('src/routes/collection/+page.svelte');
 assert.ok(col.includes("type ViewMode = 'category' | 'world' | 'universe'"));
 for(const v of ['category','world','universe'])assert.ok(col.includes("setView('"+v+"')"));
 assert.equal(fixture.proposalD[6].r17[0],'COL-WORK');
});
test('IA-08/09: owner taxonomy annotation is not a public launch PASS; crosslinks still require role/privacy/browser evidence',()=>{
 assert.equal(fixture.proposalD[7].r17[0],'GDE-SYS');
 assert.equal(fixture.status.signedReleaseAcceptance,false);
 assert.equal(fixture.status.release,'NO_GO');
 assert.equal(fixture.status.doNotDeploy,true);
});
