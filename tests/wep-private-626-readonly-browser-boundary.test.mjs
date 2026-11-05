import test from 'node:test';
import assert from 'node:assert/strict';
import {
  raw626GridObjectEntries,evaluate626BrowserCount
} from '../scripts/wep-private-626-readonly-boundary-20261104.mjs';
import {
  inspectExternallyAttestedSaveProfile,
  classify626ReferenceIndex,
  WEP_PRIVATE_626_BID,WEP_PRIVATE_624_BID
} from '../scripts/wep-private-real-save-e2e-safety-20261104.mjs';

// No private original P1G in CI. All examples are short synthetic raw maps.
const profile=()=>({
  GameInfo:{Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player:{},World:{GridCollection:{Grids:{
    '42':{ID:42,Objects:{'7':{ID:7,ItemID:40000047,X:1,Y:2},
                       '8':{ID:8,ItemID:40000048,X:5,Y:3}}},
    '43':{ID:43,Objects:{'9':{ID:9,ItemID:40000049,X:0,Y:1}}}
  },DiffGrids:{'45':{ID:45,Objects:{}}}}}
});
const index=(issues=[])=>({
  version:{schema:626},status:issues.length?'REFERENCE_ERRORS_FAIL_CLOSED':'READ_ONLY_REFERENCE_INDEX',
  geometryFor2d:'NOT_VERIFIED',persistentWriteAuthorized:false,
  productApplyAuthorized:false,objects:[],grids:[],issues
});
test('actual 626 original map and browser diagnostic can agree without granting 2D native geometry',()=>{
 const p=profile();
 assert.equal(raw626GridObjectEntries(p),3);
 const a=evaluate626BrowserCount(3,'3',0);
 assert.equal(a.status,'SOURCE_ONLY_MATCH');
 const source=classify626ReferenceIndex(index());
 assert.equal(source.checkStatus,'PASS');
 assert.equal(index().geometryFor2d,'NOT_VERIFIED');
 assert.equal(index().persistentWriteAuthorized,false);
});
test('subgrid child counted as serialized GridObject, not a transformed 2D footprint',()=>{
 const p=profile();
 assert.equal(raw626GridObjectEntries(p),3);
 p.World.GridCollection.Grids['43'].Objects['10']={ID:10,ItemID:40000050,X:0,Y:0};
 assert.equal(raw626GridObjectEntries(p),4);
 assert.equal(evaluate626BrowserCount(4,'4',0).status,'SOURCE_ONLY_MATCH');
});
test('unknown, missing, malformed or overflow source/browsed count is PARTIAL failclosed',()=>{
 for(const v of [null,-1,2.5,Number.MAX_SAFE_INTEGER+10]){
  assert.equal(evaluate626BrowserCount(v,'0',0).status,'PARTIAL');
 }
 for(const v of ['', '—','UNKNOWN','3 items','03','3.0','3e0','3.5','-3']){
  assert.equal(evaluate626BrowserCount(3,v,0).status,'PARTIAL',v);
 }
 assert.equal(raw626GridObjectEntries({World:{GridCollection:{}}}),null);
 const p=profile();p.World.GridCollection.Grids['43'].Objects=null;
 assert.equal(raw626GridObjectEntries(p),null);
});
test('mismatching original vs browser raw GridObjects cannot be V1 PASS',()=>{
 assert.deepEqual(evaluate626BrowserCount(3,'2',0),{
  status:'PARTIAL',reason:'626_BROWSER_RAW_GRIDOBJECT_COUNT_MISMATCH'
 });
 assert.equal(evaluate626BrowserCount(3,'4',0).status,'PARTIAL');
});
test('source unresolved DiffGrid/parent prevents browser count match from promoting source status',()=>{
 assert.deepEqual(evaluate626BrowserCount(3,'3',1),{
  status:'PARTIAL',reason:'626_NATIVE_REFERENCE_ISSUES_PRESENT'
 });
 assert.equal(classify626ReferenceIndex(index([{code:'DIFF_ONLY_DEFAULT_UNKNOWN'}])).checkStatus,'PARTIAL');
});
test('externally verified BID+schema mandatory; last save Windows never independent Switch proof',()=>{
 const id=inspectExternallyAttestedSaveProfile(profile(),WEP_PRIVATE_626_BID);
 assert.equal(id.schema,626);
 assert.equal(id.lastSaveDeviceTypeIsAuthority,false);
 assert.throws(()=>inspectExternallyAttestedSaveProfile(profile(),WEP_PRIVATE_624_BID),/BOUNDARY_MISMATCH/);
});
test('no runner in CI: private script carries explicit guards, no screenshot, no public report path',async()=>{
 const {readFileSync}=await import('node:fs');
 const text=readFileSync(new URL('../scripts/wep-private-626-readonly-browser-receipt-20261104.mjs',import.meta.url),'utf8');
 for(const value of ['requireOwnerPrivateScope()', 'ensurePrivateSourceOutsideCheckout',
    'serviceWorkers:', 'routeWebSocket',"'GET','HEAD'",'sourceSha256',
    'ORIGINAL_ENCRYPTED_P1G_SHA_UNCHANGED','NOT_NATIVE_2D']) {
  assert.ok(text.includes(value),value);
 }
 assert.ok(!text.includes('screenshot('));
 assert.ok(!text.includes('.artifacts/'));
});
