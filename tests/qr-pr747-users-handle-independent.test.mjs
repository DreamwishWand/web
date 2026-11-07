// 04 QR-S independent new-only negative acceptance for PR747: raw /users/{handle}/
// This is NOT Auth/RLS/CAS, signed runtime, a verified alias, or public HTTP QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import {
  USER_PROFILE_HANDLE_CONTRACT,
  PROTECTED_USER_HANDLE_TOKENS,
  inspectPublicProfileHandleSegment
} from '../src/lib/community/public-profile-handle-syntax.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = join(root, 'src/lib/community/public-profile-handle-syntax.mjs');
const sourceHead = '2e7ca39465ff908c5a483710180b26b8d37a93ea';
const parentMain = '01f45bd20ab98da2b6dc7c807738c20592621f47';
const oldCreatorSha = '8ddbc9da560ad98a177e3008330ae8c48aaf5461';
const original82Sha = 'bbf9bc830440d964c5da8b3c3cac7e926d281881';
const blockedKeys = [
  'mayReadPublicProfile', 'mayReadPrivateLibrary', 'mayRedirectOldAlias',
  'mayIndex', 'mayWriteHandle', 'mayPublishCommunity'
];

function git(...args) {
  return execFileSync('git', args, {cwd:root,encoding:'utf8'}).trim();
}
function mark(m) {console.log('QR747_' + m + '_PASS');}
function denial(r) {
  assert.ok(Object.isFrozen(r),'result not frozen');
  assert.ok(Object.isFrozen(PROTECTED_USER_HANDLE_TOKENS),'reserved list not frozen');
  for(const key of blockedKeys) assert.equal(r[key],false,key);
  assert.equal(r.publicUrl,null);
  assert.equal(r.redirectCode,null);
  for(const field of ['ownerApproved','signedSession','accountId','creatorProfileId',
    'isPublic','statusCode','redirectLocation','writerEnabled','aliasReserved'])
    assert.equal(Object.hasOwn(r,field),false,field);
}
function inspect(raw) {
  const r=inspectPublicProfileHandleSegment(raw);
  denial(r);
  return r;
}
function expected(raw) {
  if(typeof raw!=='string')return null;
  if(raw.length<3 || raw.length>24)return null;
  const first=raw.charCodeAt(0);
  if(!((first>=65&&first<=90)||(first>=97&&first<=122)))return null;
  let lastUnderscore=false;
  for(let i=0;i<raw.length;i++){
    const n=raw.charCodeAt(i);
    const letter=(n>=65&&n<=90)||(n>=97&&n<=122);
    const digit=n>=48&&n<=57;
    if(n===95){
      if(i===0 || i===raw.length-1 || lastUnderscore)return null;
      lastUnderscore=true;continue;
    }
    if(!letter && !digit)return null;
    lastUnderscore=false;
  }
  const canonical=raw.replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
  if(PROTECTED_USER_HANDLE_TOKENS.includes(canonical))return null;
  return canonical;
}

test('fixed source only three additive blobs; legacy Creator and original82 unmoved',()=>{
  assert.equal(git('rev-parse',sourceHead),sourceHead);
  assert.deepEqual(git('diff','--name-only',parentMain,sourceHead).split('\n').sort(),[
    'docs/community/public-users-handle-security-20261107.md',
    'src/lib/community/public-profile-handle-syntax.mjs',
    'tests/comm-public-profile-handle-syntax.test.mjs'
  ]);
  assert.equal(git('hash-object','src/lib/community/domain.ts'),oldCreatorSha);
  assert.equal(git('hash-object',
    'supabase/migrations/20260930025132_community_core_v0_server_rpc.sql'),original82Sha);
  assert.equal(USER_PROFILE_HANDLE_CONTRACT,'wand.public-profile-handle.syntax-only@1');
  mark('EXACT_THREE_ADD_ONLY_LEGACY_NFKC_ORIGINAL82_UNCHANGED');
});

test('independent character-state oracle: deterministic ASCII fuzz and casefold',()=>{
  let seed=0x45A01B6C;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.%/\\ \t\n';
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  let candidates=0, invalid=0;
  const samples=['a_b','A_0','A'.repeat(24),'a'.repeat(24),'a'.repeat(25),
    'a0a','aa_', '_aaa','AAA_000','a__b','a_b_c','A12345678901234567890123'];
  for(let i=0;i<6500;i++){
    const n=rand()%30;
    let x='';
    for(let k=0;k<n;k++)x+=alphabet[rand()%alphabet.length];
    samples.push(x);
  }
  for(const raw of samples){
    const result=inspect(raw),canonical=expected(raw);
    if(canonical===null){
      assert.equal(result.status,'INVALID',JSON.stringify(raw));
      assert.equal(result.canonicalHandle,null);
      invalid++;
    }else{
      assert.equal(result.status,'SYNTAX_ONLY_UNVERIFIED',raw);
      assert.equal(result.canonicalHandle,canonical);
      assert.equal(result.reason,'SERVER_HISTORY_PRIVACY_AUTH_UNVERIFIED');
      candidates++;
    }
  }
  assert.ok(candidates>900 && invalid>5000 && candidates+invalid===samples.length,
    'insufficient deterministic positive/negative oracle coverage');
  mark('ASCII_FUZZ_6500_RAW_CASEFOLD_GRAMMAR_ALL_AUTH_DENIED');
});

test('complete raw ASCII codepoint mutation, Unicode/confusables and nested encodings',()=>{
  for(let cp=0;cp<128;cp++){
    const raw='Ab'+String.fromCharCode(cp)+'7';
    const result=inspect(raw);
    const x=expected(raw);
    assert.equal(result.status,x===null?'INVALID':'SYNTAX_ONLY_UNVERIFIED','ASCII-'+cp);
  }
  for(const raw of [
    'ＡＬＩＣＥ','ａｌｉｃｅ','Αlice','Аlice','аlice','lіbrary','𝐀lice',
    'a\u200dlice','a\u200blice','a\u202elice','a\u2066b','ab\u00a0cd',
    'alice\u0000','alice\u007f','alice\u2028','al\u0301ice','\ufeffalice',
    'a%2fb','a%2Fb','a%252fb','a%25252fb','%61lice','alice%00','a%2e%2e',
    'a/../b','a\\..\\b','a//b','a.b','alice?q=1','alice#x','a%b'
  ])assert.equal(inspect(raw).status,'INVALID',JSON.stringify(raw));
  mark('ASCII128_NONASCII_BIDI_PATH_PERCENT_NESTED_ENCODING_DENIED');
});

test('all reserved tokens + exact impersonation and namespace variants cannot resolve',()=>{
  assert.equal(new Set(PROTECTED_USER_HANDLE_TOKENS).size,PROTECTED_USER_HANDLE_TOKENS.length);
  const severe=['admin','administrator','owner','operator','support','api','auth',
    'library','creator','creators','accounts','users','system','work','works',
    'constructor','prototype','__proto__','dreamsnaps','gallery','moderation'];
  for(const word of [...PROTECTED_USER_HANDLE_TOKENS,...severe]){
    for(const raw of [word,word.toUpperCase()]){
      const r=inspect(raw);
      assert.equal(r.status,'INVALID',raw);
      assert.equal(r.canonicalHandle,null,raw);
    }
  }
  for(const possibleAlias of ['alice','alice_2','creator_alice','admin_2','owner1',
    'verified','official_wand','someoneelsesname']){
    const r=inspect(possibleAlias);
    if(r.status==='SYNTAX_ONLY_UNVERIFIED'){
      assert.equal(r.canonicalHandle,expected(possibleAlias));
      assert.equal(r.publicUrl,null);
    }
  }
  mark('ALL_RESERVED_AND_IMPERSONATION_ALLOWED_SYNTAX_NEVER_AUTHORIZED');
});

test('object coercion, inherited user privileges and forged caller flags never authorize',()=>{
  const adversarial=[
    null,undefined,true,false,0,123,1n,[],['alice'],{},new String('alice'),
    {toString(){throw Error('coerced');}},
    Object.create({ownerApproved:true,handle:'alice'}),
    Object.assign(Object.create(null),{handle:'alice',isPublic:true}),
    {get handle(){throw Error('getter invoked');}},
    /alice/,
    new Proxy({value:'alice'},{
      get(){throw Error('unsafe object property access');}
    })
  ];
  for(const x of adversarial){
    const r=inspect(x);
    assert.equal(r.status,'INVALID');
    assert.equal(r.canonicalHandle,null);
    assert.equal(r.reason,'NOT_A_STRING');
  }
  for(const args of [
    [{mayWriteHandle:true,mayIndex:true,canReadPrivate:true}],
    [{ownerApproved:true,signedSession:true,rollbackPassed:true}],
    [{profileOwner:'victim',oldAlias:'victim',accountId:'forged'}]
  ]){
    const r=inspectPublicProfileHandleSegment('Alice',...args);
    denial(r);
    assert.equal(r.status,'SYNTAX_ONLY_UNVERIFIED');
    assert.equal(r.canonicalHandle,'alice');
  }
  mark('PROXY_COERCION_INHERITED_AND_FORGED_CALLER_FLAGS_DENIED');
});

test('length and underscore boundaries, uppercase folding, no positive URL or redirect',()=>{
  for(const raw of ['a_b','a_0','abc','a00','ABC','a'.repeat(24),'AbCd_0123']){
    const r=inspect(raw);
    assert.equal(r.status,'SYNTAX_ONLY_UNVERIFIED');
  }
  for(const raw of ['','a','ab','ab_','_abc','abc_','a__b','a___b',
    '1alice','0aa','a-b','a.b','a b','A_','a'.repeat(25)]){
    const r=inspect(raw);
    assert.equal(r.status,'INVALID',raw);
  }
  const a=inspect('Alice'),b=inspect('ALICE'),c=inspect('alice');
  assert.notStrictEqual(a,b);
  assert.equal(a.canonicalHandle,b.canonicalHandle);
  assert.equal(b.canonicalHandle,c.canonicalHandle);
  for(const r of [a,b,c])denial(r);
  mark('ASCII_LENGTH_UNDERSCORE_CASEFOLD_PRIVATE_NO_URL_REDIRECT');
});

test('new helper cannot fetch, query SQL, normalize NFKC, publish or create HTTP routes',()=>{
  const text=readFileSync(source,'utf8');
  assert.doesNotMatch(text,/^\s*import\s+/m);
  assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|WebSocket|eval|Function|createClient|connect|query|writeFileSync|spawnSync|execSync)\s*\(/);
  assert.doesNotMatch(text,/\b(?:normalize|NFKC|NFD|NFC|localeCompare)\s*\(/);
  assert.doesNotMatch(text,/\b(?:GRANT|REVOKE|INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:ON|INTO|TABLE|FUNCTION|ROLE|POLICY)\b/i);
  assert.equal(git('diff','--name-only',parentMain,sourceHead,'supabase'), '');
  assert.equal(git('diff','--name-only',parentMain,sourceHead,'src/lib/community/domain.ts'),'');
  assert.equal(git('diff','--name-only',parentMain,sourceHead,'src/routes'),'');
  mark('STATIC_NO_SQL_AUTH_NETWORK_LEGACY_REWRITE_OR_PUBLIC_ROUTE');
});
