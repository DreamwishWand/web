/**
 * OWNER DESKTOP ONLY — genuine Switch v1.25.3/schema626 P1G structural
 * references -> local World read-only browser -> original unchanged.
 *
 * NEVER run with genuine data in CI, GitHub, Cloud Work or public logs.
 * Never exercises 626 Native 2D geometry, Edit/Export/Apply or Product Writer.
 *
 * Requires WEP_PRIVATE_P1G_PATH (outside checkout), WEP_PRIVATE_BUILD_ID,
 * WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED=YES, WEP_PRIVATE_LOCAL_ONLY_ACK=YES,
 * WEP_PRIVATE_CHROME_BIN, optional WEP_PRIVATE_LOCAL_URL.
 * node --experimental-strip-types scripts/wep-private-626-readonly-browser-receipt-20261104.mjs
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { SWITCH_626, read626SpatialReferences } from '../src/lib/wep/real-save-spatial-source.ts';
import {
  requireOwnerPrivateScope,
  inspectExternallyAttestedSaveProfile,
  classify626ReferenceIndex,
  ensurePrivateSourceOutsideCheckout,
  WEP_PRIVATE_626_BID
} from './wep-private-real-save-e2e-safety-20261104.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const record=x=>x!==null && typeof x==='object' && !Array.isArray(x);
function rawObjectCount(profile){
  const grids=profile?.World?.GridCollection?.Grids;
  if(!record(grids)) return null;
  let n=0;
  for(const grid of Object.values(grids)){
    if(!record(grid) || !record(grid.Objects)) return null;
    n+=Object.keys(grid.Objects).length;
    if(!Number.isSafeInteger(n)) return null;
  }
  return n;
}
export function evaluate626BrowserCount(rawCount, renderedText, sourceIssueCount){
  if(!Number.isSafeInteger(rawCount) || rawCount<0 ||
     typeof renderedText!=='string' ||
     !/^(0|[1-9][0-9]*)$/.test(renderedText.trim()) ||
     !Number.isSafeInteger(sourceIssueCount) || sourceIssueCount<0)
    return Object.freeze({status:'PARTIAL',reason:'UNRESOLVED_626_SOURCE_COUNT'});
  const parsed=Number(renderedText.trim());
  if(!Number.isSafeInteger(parsed) || parsed!==rawCount)
    return Object.freeze({status:'PARTIAL',reason:'626_BROWSER_RAW_GRIDOBJECT_COUNT_MISMATCH'});
  if(sourceIssueCount!==0)
    return Object.freeze({status:'PARTIAL',reason:'626_NATIVE_REFERENCE_ISSUES_PRESENT'});
  return Object.freeze({status:'SOURCE_ONLY_MATCH',reason:'626_RAW_GRIDOBJECT_ENTRY_COUNT_MATCH'});
}

const sourcePath=process.env.WEP_PRIVATE_P1G_PATH;
const report={
  schema:'wand.wep.owner-local-626-structural-browser@1',
  evidence:'OWNER_PRIVATE_P1G_IF_EXECUTED_NOT_INDEPENDENT_QA_NOT_NATIVE_V3',
  sourceAttestation:'OWNER_EXTERNAL_SWITCH_BID_REQUIRED',
  checks:[],
  sourceSha256:null,sourceSizeBytes:null,zipCounts:null,
  rawObjectEntryCount:null,browserObjectEntryCount:null,
  sourceReferenceStatus:null,sourceReferenceIssueCount:null,
  externalBlockedRequests:0,pageErrorCount:0,
  originalShaUnchanged:false,
  nativeGeometryVerified:false,coreSpatialReadAccepted:false,
  persistentWriterAuthorized:false,productApplyAuthorized:false,
  status:'NOT_RUN'
};
const add=(name,status)=>report.checks.push({name,status});
let browser=null, approvedSourcePath=null, data=null;
try {
  const scope=requireOwnerPrivateScope();
  if(scope.status!=='READY'){
    report.status=scope.status;
  }else if(scope.bid!==WEP_PRIVATE_626_BID){
    report.status='NOT_RUN_SWITCH_626_BID_REQUIRED';
  }else if(!process.env.WEP_PRIVATE_CHROME_BIN){
    report.status='NOT_RUN_LOCAL_CHROME_REQUIRED';
  }else{
    approvedSourcePath=await realpath(sourcePath);
    ensurePrivateSourceOutsideCheckout(approvedSourcePath,await realpath(process.cwd()));
    data=await readFile(approvedSourcePath);
    const originalSha=sha(data);
    report.sourceSha256=originalSha; // ONLY local chmod 0600 receipt
    report.sourceSizeBytes=data.length;
    const decoded=await p1gPackagedProfileCodec.loadProfile(new Uint8Array(data));
    assert.equal(decoded.inputType,'packaged','PRIVATE_ENCRYPTED_P1G_REQUIRED');
    const profile=JSON.parse(decoded.jsonText);
    const identity=inspectExternallyAttestedSaveProfile(profile,scope.bid);
    assert.equal(identity.schema,626,'PRIVATE_626_SCHEMA_REQUIRED');
    report.zipCounts={
      entries:decoded.metadata?.zip?.entryCount??null,
      profiles:decoded.metadata?.zip?.profileEntryCount??null
    };
    add('V0_EXTERNAL_SWITCH_BID_SCHEMA_ENCRYPTED_ZIP','PASS');
    const source=read626SpatialReferences(profile,{
      ...SWITCH_626,sourceSha256:originalSha,
      sourceRevision:'owner-local-ui-only:'+randomUUID()
    });
    const indexVerdict=classify626ReferenceIndex(source);
    report.sourceReferenceStatus=indexVerdict.status;
    report.sourceReferenceIssueCount=source.issues.length;
    report.rawObjectEntryCount=rawObjectCount(profile);
    add('626_SOURCE_REFERENCE_INDEX',indexVerdict.checkStatus);
    // The genuine personal source is provided only to a loopback Chromium
    // instance on the owner's machine. No Cloud, screenshots or profile logs.
    const {chromium}=await import('playwright-core');
    browser=await chromium.launch({
      headless:true,executablePath:process.env.WEP_PRIVATE_CHROME_BIN,
      args:['--no-sandbox','--disable-dev-shm-usage']
    });
    const context=await browser.newContext({
      viewport:{width:1280,height:900},
      serviceWorkers:'block',acceptDownloads:false
    });
    const page=await context.newPage();
    page.on('pageerror',()=>{report.pageErrorCount+=1;});
    if(typeof page.routeWebSocket!=='function')
      throw Error('PRIVATE_BROWSER_WEBSOCKET_GUARD_REQUIRED');
    await page.routeWebSocket('**/*',route=>{
      const dest=new URL(route.url());
      if(dest.protocol==='ws:' && dest.hostname===scope.url.hostname &&
        dest.port===scope.url.port)route.connectToServer();
      else {report.externalBlockedRequests+=1;route.close();}
    });
    await page.route('**/*',route=>{
      const dest=new URL(route.request().url());
      if(dest.origin===scope.url.origin &&
         ['GET','HEAD'].includes(route.request().method()))route.continue();
      else {report.externalBlockedRequests+=1;route.abort('blockedbyclient');}
    });
    await page.goto(scope.url.href,{waitUntil:'networkidle'});
    await page.locator('.platform-select select').selectOption('switch');
    await page.locator('[data-wep-626-bid] input').fill(scope.bid);
    await page.locator('[data-wep-626-provenance] input').check();
    await page.locator('.load-panel input[type=file]').setInputFiles({
      name:'profile.save',mimeType:'application/octet-stream',buffer:data
    });
    const panel=page.locator('[data-wep-626-readonly]');
    await panel.waitFor({state:'visible',timeout:20000});
    assert.match(await panel.locator('h3').innerText(),/1\.25\.3.*schema 626/);
    assert.equal(await page.locator('.editor-shell').count(),0);
    assert.equal(await page.locator('.toolbar-actions').count(),0);
    assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
    assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
    add('626_LOCAL_READONLY_NO_CANVAS_DRAFT_EDIT_EXPORT','PASS');
    const rawLabel=(await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim();
    report.browserObjectEntryCount=rawLabel;
    const compared=evaluate626BrowserCount(
      report.rawObjectEntryCount,rawLabel,source.issues.length
    );
    add('626_BROWSER_ORIGINAL_GRIDOBJECT_ENTRY_COUNT',compared.status==='SOURCE_ONLY_MATCH'?'PASS':'PARTIAL');
    // 320px does not establish 200% native browser zoom or Native positions.
    await page.setViewportSize({width:320,height:740});
    const dims=await page.evaluate(()=>({
      viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth
    }));
    if(dims.scrollWidth>dims.viewport+2)throw Error('PRIVATE_626_320_OVERFLOW');
    assert.equal(await panel.isVisible(),true);
    add('626_320_READONLY_VIEWPORT','PASS');
    // Wrong BID reload must remove a previous accepted Source panel.
    await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
    await page.locator('.load-panel input[type=file]').setInputFiles({
      name:'profile.save',mimeType:'application/octet-stream',buffer:data
    });
    await panel.waitFor({state:'detached',timeout:20000});
    add('626_WRONG_BID_CLEARS_PRIOR_SOURCE_READ','PASS');
    if(report.externalBlockedRequests!==0||report.pageErrorCount!==0)
      throw Error('PRIVATE_626_OFFHOST_OR_BROWSER_RUNTIME_ERROR');
    add('626_NO_EXTERNAL_REQUEST_OR_BROWSER_ERROR','PASS');
    await context.close();
    // Local inspection is Source-only; unknown refs stay PARTIAL.
    report.status=compared.status==='SOURCE_ONLY_MATCH' &&
      indexVerdict.checkStatus==='PASS'
      ? 'OWNER_LOCAL_626_SOURCE_READONLY_BROWSER_MATCH_NOT_NATIVE_2D'
      : 'PARTIAL_626_REFERENCE_OR_BROWSER_SOURCE_UNRESOLVED';
    if(sha(await readFile(approvedSourcePath))!==originalSha)
      throw Error('PRIVATE_ORIGINAL_SOURCE_SHA_CHANGED');
    report.originalShaUnchanged=true;
    add('ORIGINAL_ENCRYPTED_P1G_SHA_UNCHANGED','PASS');
  }
}catch(e){
  report.status='FAIL_CLOSED';
  report.privateErrorCode=String(e?.message??e).slice(0,120);
}finally{
  await browser?.close().catch(()=>{});
  // Never write to source directory, Git checkout, CI artifact or Cloud.
  if(data!==null){
    const name=join(tmpdir(),'wand-private-schema626-source-'+randomUUID()+'.json');
    await writeFile(name,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  }
  console.log(JSON.stringify({
    status:report.status,
    evidence:report.evidence,
    checks:report.checks,
    nativeGeometryVerified:false,
    persistentWriterAuthorized:false,
    originalShaUnchanged:report.originalShaUnchanged
  }));
}
if(report.status==='FAIL_CLOSED') process.exitCode=1;
