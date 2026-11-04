/**
 * OWNER LOCAL ONLY — do NOT run in GitHub CI, upload a genuine Save, or store
 * the full receipt in repo/build artifacts. No game imagery, no save writer.
 *
 * 624: private encrypted P1G -> Chromium localhost World Editor -> original
 * source GridObject ID -> 2D Inspector -> schematic Move -> Undo.
 * 626: independent raw source reference structure ONLY, never 624 geometry.
 *
 * Run with local npm dev server, locally installed Chrome/Playwright-core:
 * WEP_PRIVATE_P1G_PATH=/absolute/private/profile
 * WEP_PRIVATE_BUILD_ID=52BD625D9B4E0053 (or 9A239D3DB569756D)
 * WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED=YES
 * WEP_PRIVATE_LOCAL_ONLY_ACK=YES
 * WEP_PRIVATE_CHROME_BIN=/absolute/path/to/Chrome
 * node --experimental-strip-types scripts/wep-private-real-save-2d-local-only-20261104.mjs
 *
 * Outputs ONLY to os.tmpdir(), 0600. stdout contains no Save contents or IDs.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {
  requireOwnerPrivateScope,
  inspectExternallyAttestedSaveProfile,
  classify626ReferenceIndex,
  checkPrivateCandidateSource,
  WEP_PRIVATE_624_BID,
  WEP_PRIVATE_626_BID
} from './wep-private-real-save-e2e-safety-20261104.mjs';

const BID624=WEP_PRIVATE_624_BID;
const BID626=WEP_PRIVATE_626_BID;
const sourcePath=process.env.WEP_PRIVATE_P1G_PATH;
const claimedBid=String(process.env.WEP_PRIVATE_BUILD_ID??'').trim().toUpperCase();
const report={
  schema:'wand.wep.private-local-world-e2e-receipt@1',
  evidence:'OWNER_PRIVATE_LOCAL_CANDIDATE__NOT_INDEPENDENT_QA',
  buildAttestation:'EXTERNAL_OWNER_CONFIRMATION_REQUIRED',
  privateOriginalSha256:null,
  privateSourceObject:null,
  sourceVersion:null,
  checks:[],
  httpRequestsOffLocalhost:0,
  nativeV3:false,
  trustedCoreSpatialRead:false,
  persistentGridWriterAuthorized:false,
  persistentRoadFenceWriterAuthorized:false,
  productOperationEnabled:false,
  status:'NOT_RUN'
};
const add=(name,status,reason=null)=>report.checks.push({name,status,...(reason?{reason}:{})});
const sha=b=>createHash('sha256').update(b).digest('hex');
const safeRec=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
function printOnlySafeStatus(){
  console.log(JSON.stringify({
    status:report.status,
    evidence:report.evidence,
    checkStatuses:report.checks.map(c=>({name:c.name,status:c.status})),
    persistentGridWriterAuthorized:false,
    privateLocalReceiptPath:localReceiptPath
  },null,2));
}
let browser=null;
let localReceiptPath=null;
try {
  // No genuine byte may leave the current machine or enter a CI fixture.
  if (process.env.CI||process.env.GITHUB_ACTIONS)
    throw Error('PRIVATE_SAVE_CI_FORBIDDEN');
  if (!sourcePath) {
    report.status='NOT_RUN_PRIVATE_SOURCE_NOT_AVAILABLE';
  } else if(process.env.WEP_PRIVATE_LOCAL_ONLY_ACK!=='YES'||
    process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED!=='YES'){
    report.status='NOT_RUN_EXTERNAL_BUILD_CONSENT_REQUIRED';
  } else if (![BID624,BID626].includes(claimedBid)){
    report.status='NOT_RUN_EXACT_BUILD_UNSUPPORTED';
  } else {
    const accepted=requireOwnerPrivateScope();
    if(accepted.status!=='READY')throw Error('PRIVATE_OWNER_SOURCE_SCOPE_CHANGED');
    const url=accepted.url;
    const data=await readFile(sourcePath);
    report.privateOriginalSha256=sha(data); // private local file, never stdout
    const decoded=await p1gPackagedProfileCodec.loadProfile(new Uint8Array(data));
    if(decoded.inputType!=='packaged')throw Error('PRIVATE_ENCRYPTED_P1G_REQUIRED');
    const profile=JSON.parse(decoded.jsonText);
    // LastSaveDeviceInfo can legitimately reflect a previous cross-platform
    // save. It never proves (or disproves) the *extraction* platform/BID.
    const externallyBound=inspectExternallyAttestedSaveProfile(profile,claimedBid);
    const schema=externallyBound.schema;
    report.privateOriginalSizeBytes=data.length;
    report.zipStructure={
      archiveEntryCount:decoded.metadata?.zip?.entryCount??null,
      profileEntryCount:decoded.metadata?.zip?.profileEntryCount??null
    };
    report.sourceVersion={platform:'Nintendo Switch',fullVersion:schema===624?'1.25.0':'1.25.3',
      schema,bid:claimedBid};
    add('V0_OWNER_EXTERNAL_BID_AND_ENCRYPTED_PROFILE_SCHEMA','PASS');
    if(schema===626){
      const {read626SpatialReferences,SWITCH_626}=await import('../src/lib/wep/real-save-spatial-source.ts');
      const source=read626SpatialReferences(profile,{
        ...SWITCH_626,sourceSha256:report.privateOriginalSha256,sourceRevision:'owner-local:'+randomUUID()
      });
      report.referenceIndex={
        count:source.objects.length,grids:source.grids.length,
        issues:source.issues.length,status:source.status,
        geometryFor2d:source.geometryFor2d
      };
      const limited=classify626ReferenceIndex(source);
      add('V1_626_SERIALIZED_AREA_GRID_SUBGRID_REFERENCES',limited.checkStatus);
      add('626_NATIVE_2D_GEOMETRY','NOT_RUN','NO_VERIFIED_SAME_BUILD_GEOMETRY');
      report.status=limited.checkStatus==='PASS'
        ? 'NOT_RUN_626_NATIVE_2D_GEOMETRY_UNVERIFIED'
        : 'PARTIAL_626_REFERENCE_ERRORS_NATIVE_2D_NOT_RUN';
    }else{
      // User's file is provided ONLY to an on-device Chrome instance. Route
      // every attempted external HTTP request to abort before any transfer.
      const chromePath=process.env.WEP_PRIVATE_CHROME_BIN;
      if(!chromePath){report.status='NOT_RUN_CHROME_EXECUTABLE_NOT_CONFIGURED';}
      else {
        const { chromium }=await import('playwright-core');
        browser=await chromium.launch({executablePath:chromePath,headless:true,
          args:['--no-sandbox','--disable-dev-shm-usage']});
        const context=await browser.newContext({
          viewport:{width:1440,height:900},
          serviceWorkers:'block',
          acceptDownloads:false
        });
        const page=await context.newPage();
        // Playwright HTTP route alone does not intercept WebSocket traffic.
        // Block any Provider/offhost socket before it can exchange Save data.
        if(typeof page.routeWebSocket!=='function')
          throw Error('PRIVATE_BROWSER_WEBSOCKET_GUARD_REQUIRED');
        await page.routeWebSocket('**/*',route=>{
          const dest=new URL(route.url());
          if(dest.protocol==='ws:' && dest.hostname===url.hostname &&
            dest.port===url.port) route.connectToServer();
          else {report.httpRequestsOffLocalhost+=1;route.close();}
        });
        const pageErrors=[];
        page.on('pageerror',e=>pageErrors.push(String(e)));
        await page.route('**/*',route=>{
          const dest=new URL(route.request().url());
          if(dest.origin===url.origin)route.continue();
          else { report.httpRequestsOffLocalhost+=1;route.abort('blockedbyclient'); }
        });
        await page.goto(url.href,{waitUntil:'networkidle'});
        await page.locator('.platform-select select').selectOption('switch');
        await page.locator('[data-wep-626-bid] input').fill(claimedBid);
        await page.locator('.load-panel input[type=file]').setInputFiles({
          name:'profile',mimeType:'application/octet-stream',buffer:data
        });
        await page.getByRole('button',{name:'Open in Canvas'}).first().click();
        await page.locator('[data-wep-real-source-read-status]').waitFor({timeout:20000});
        const nodes=page.locator('g[data-editor-object-id^="g"]');
        const total=await nodes.count();
        if(total===0)throw Error('PRIVATE_624_RENDERED_ROOT_SOURCE_EMPTY');
        const rawGrids=profile.World.GridCollection?.Grids??{};
        let selected=null;
        for(let i=0;i<Math.min(total,60);i++){
          const n=nodes.nth(i), id=await n.getAttribute('data-editor-object-id');
          const verified=checkPrivateCandidateSource(profile,id);
          if(!verified)throw Error('PRIVATE_SOURCE_ID_MISMATCH');
          const {gridId,objectId}=verified;
          const raw=rawGrids[String(gridId)]?.Objects?.[String(objectId)];
          if(await n.getAttribute('data-wep-spatial-native-grid-object-id')!==String(objectId))
            throw Error('PRIVATE_SVG_NATIVE_ID_MISMATCH');
          await n.click();
          const details=page.locator('[data-wep-spatial-details-id]');
          if(await details.count()!==1)continue;
          if(!(await details.innerText()).includes(id))throw Error('PRIVATE_INSPECTOR_ID_MISMATCH');
          const toolbar=page.locator('.toolbar-actions');
          const button=toolbar.getByRole('button',{name:'Move right',exact:true});
          if(await button.count()===0 || !await button.isEnabled() ||
            await button.getAttribute('aria-disabled')==='true')continue;
          // On valid Source, record the existing native ID/Inspector before
          // executing a local DRAFT command, never a Save write.
          add('V1_624_P1G_GRID_TO_SCENE_EXACT_NATIVE_ID_INSPECTOR','PASS');
          await button.click();
          const delta=page.locator('[data-wep-spatial-delta="'+id+'"]');
          if(await delta.count()!==1)continue;
          const changeText=await delta.innerText();
          if(!changeText.includes('MOVE') ||
            !changeText.includes(raw.X+','+raw.Y+'/'))continue;
          selected={gridId,objectId,itemId:raw.ItemID,x:raw.X,y:raw.Y};
          add('624_LOCAL_MOVE_DRAFT_PREVIEW','PASS');
          const undo=toolbar.getByRole('button',{name:'Undo',exact:true});
          if(await undo.count()!==1||!await undo.isEnabled()||
            await undo.getAttribute('aria-disabled')==='true')
            throw Error('PRIVATE_LOCAL_UNDO_NOT_AUTHORIZED');
          await undo.click();
          await delta.waitFor({state:'detached',timeout:10000});
          if(await page.locator('[data-wep-spatial-changes]').count()!==0)
            throw Error('PRIVATE_LOCAL_UNDO_DID_NOT_RESET_DIFF');
          add('624_UNDO_CLEARS_SAME_OBJECT_DIFF','PASS');
          break;
        }
        if(selected&&report.checks.some(x=>x.name==='624_UNDO_CLEARS_SAME_OBJECT_DIFF')){
          report.privateSourceObject=selected; // local 0600 receipt only
          report.status='OWNER_PRIVATE_624_2D_PREVIEW_UNDO_PASS_NOT_INDEPENDENT';
        }else{
          report.status='PARTIAL_NO_NATIVE_VERIFIED_SAFE_MOVE_CANDIDATE';
          add('624_MOVE_PREVIEW_UNDO','NOT_RUN','NO_ACCEPTED_SAFE_CANDIDATE');
        }
        if(report.httpRequestsOffLocalhost>0||pageErrors.length)
          throw Error('PRIVATE_BROWSER_OFFHOST_OR_RUNTIME_ERROR');
        add('LOCAL_BROWSER_NO_PROVIDER_REQUESTS','PASS');
        await context.close();
      }
    }
    if(sha(await readFile(sourcePath))!==report.privateOriginalSha256)
      throw Error('PRIVATE_ORIGINAL_SOURCE_SHA_CHANGED');
    add('V1_ORIGINAL_P1G_SHA_UNCHANGED','PASS');
  }
} catch(e) {
  report.status='FAIL_CLOSED';
  report.privateErrorCode=String(e?.message??e).slice(0,160); // no full error stack, profile or paths
} finally {
  await browser?.close().catch(()=>{});
  // Private receipt stays on OWNER'S machine only; never committed or
  // uploaded. GitHub workflow NEVER invokes this script.
  if(sourcePath){
    const receipt=join(tmpdir(),'wand-private-world-'+randomUUID()+'.json');
    await writeFile(receipt,JSON.stringify(report,null,2)+'\n',{mode:0o600});
    localReceiptPath=receipt;
  }
  printOnlySafeStatus();
}
if(report.status==='FAIL_CLOSED')process.exitCode=1;
