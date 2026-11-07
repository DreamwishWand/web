import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_PROFILE_HANDLE_CONTRACT, PROTECTED_USER_HANDLE_TOKENS,
  inspectPublicProfileHandleSegment
} from '../src/lib/community/public-profile-handle-syntax.mjs';

const denied = output => {
  for (const k of [
    'mayReadPublicProfile','mayReadPrivateLibrary','mayRedirectOldAlias',
    'mayIndex','mayWriteHandle','mayPublishCommunity'
  ]) assert.equal(output[k],false,k);
  assert.equal(output.publicUrl,null);
  assert.equal(output.redirectCode,null);
  assert.equal(Object.isFrozen(output),true);
};

test('new /users handle grammar is a distinct syntax-only community contract',()=>{
  assert.equal(USER_PROFILE_HANDLE_CONTRACT,'wand.public-profile-handle.syntax-only@1');
  assert.equal(new Set(PROTECTED_USER_HANDLE_TOKENS).size,PROTECTED_USER_HANDLE_TOKENS.length);
  assert.equal(Object.isFrozen(PROTECTED_USER_HANDLE_TOKENS),true);
});

test('ASCII casefold produces a candidate, never a public authorization',()=>{
  for (const [raw,expected] of [
    ['Alice','alice'],['ALICE_07','alice_07'],['a23','a23'],
    ['a'.repeat(24),'a'.repeat(24)],['a_b_c','a_b_c'],
    ['Z9z','z9z']
  ]) {
    const r=inspectPublicProfileHandleSegment(raw);
    assert.equal(r.status,'SYNTAX_ONLY_UNVERIFIED',raw);
    assert.equal(r.canonicalHandle,expected);
    assert.equal(r.reason,'SERVER_HISTORY_PRIVACY_AUTH_UNVERIFIED');
    denied(r);
  }
});

test('unknown/null/object/array inputs cannot coerce to someone else handle',()=>{
  for(const raw of [null,undefined,0,42,false,{},['alice'],{toString:()=> 'alice'}]){
    const r=inspectPublicProfileHandleSegment(raw);
    assert.equal(r.status,'INVALID');
    assert.equal(r.canonicalHandle,null);
    denied(r);
  }
});

test('encoded slash, Unicode lookalike, bidi and non-ASCII NFKC cases are rejected',()=>{
  for(const raw of [
    'a%2fb','a%2Fb','a%252fb','%61lice','al%69ce','a%2e%2e',
    'ａｌｉｃｅ','Αlice','аlice','álîce','al\u200dce','abc\u202e',
    'abc/def','abc\\def'
  ]) {
    const r=inspectPublicProfileHandleSegment(raw);
    assert.equal(r.status,'INVALID',raw);
    assert.equal(r.canonicalHandle,null);
    denied(r);
  }
});

test('whitespace, malformed separators, dots and disallowed punctuation denied',()=>{
  for(const raw of [
    '','ab','a'.repeat(25),' aBc','aBc ','alice\n',
    'a__b','ab_','_abc','abc-01','ab.c','ab+c','ab?','ab#',
    '1alice','a_0_','a..b','a:b','a@b','a&b','a=b'
  ]) {
    const r=inspectPublicProfileHandleSegment(raw);
    assert.equal(r.status,'INVALID',JSON.stringify(raw));
    denied(r);
  }
});

test('routes, reserved names and prototype pollution keys never become public aliases',()=>{
  for(const raw of [
    'users','USERS','library','creator','creatorS','admin','ADMIN',
    'system','operator','support','help','__proto__','constructor','prototype',
    'gallery','dreamsnaps','work','works','settings'
  ]) {
    const r=inspectPublicProfileHandleSegment(raw);
    assert.equal(r.status,'INVALID',raw);
    denied(r);
  }
});

test('caller-supplied approval and private content never override syntax-only boundary',()=>{
  const candidate=inspectPublicProfileHandleSegment('alice', {
    ownerApproved:true, signedSession:true, oldAliasOwner:'alice',
    privacy:'public', isMinor:false, indexed:true, workVisible:true
  });
  assert.equal(candidate.status,'SYNTAX_ONLY_UNVERIFIED');
  denied(candidate);
  assert.equal(candidate.canonicalHandle,'alice');
  assert.equal('ownerApproved' in candidate,false);
  assert.equal('signedSession' in candidate,false);
});
