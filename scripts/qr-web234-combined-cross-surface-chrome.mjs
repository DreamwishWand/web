import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const ORIGIN=(process.env.QR_COMBINED_BASE_URL??'http://127.0.0.1:4185').replace(/\/$/,'');
const profileId='11111111-1111-4111-8111-111111111111';
const tipId='33333333-3333-4333-8333-333333333333';
const questionId='44444444-4444-4444-8444-444444444444';
const dreamId='55555555-5555-4555-8555-555555555555';
const deniedId='88888888-8888-4888-8888-888888888888';
const rpc=[],checks=[],pageErrors=[];
const kinds=[
 {work_id:tipId,work_type:'tip',title:'QR COMBINED TIP'},
 {work_id:questionId,work_type:'question',title:'QR COMBINED QUESTION'},
 {work_id:dreamId,work_type:'dreamsnap',title:'HIDDEN_DREAMSNAP_SECRET'},
 {work_id:deniedId,work_type:'dreamsnap',retired:true,title:'HIDDEN_RETIRED_SECRET'}
];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:960,height:800}});
page.on('pageerror',e=>pageErrors.push(String(e)));
await page.route('https://qr222-synthetic.invalid/**',async route=>{
 const request=route.request(),url=new URL(request.url());
 const payload=request.method()==='POST'?request.postDataJSON()??{}:{};
 const procedure=payload.rpc??url.pathname.split('/').at(-1);
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*',
   'access-control-allow-methods':'GET,POST,OPTIONS','content-type':'application/json'};
 if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
 rpc.push(procedure);
 const id=payload.payload?.p_tip_id??payload.payload?.p_question_id;
 let data=[];
 if(procedure==='community_get_creator_public_v1')data={handle:'qr-integrated',displayName:'QR Integrated Creator',bio:''};
 else if(procedure==='community_search_public')data=kinds;
 else if(procedure==='community_get_tip_public_v1')data={tipId:id,title:'QR COMBINED TIP DETAIL',body:'tip body',contextTags:[]};
 else if(procedure==='community_get_question_public_v1')data={questionId:id,title:'QR COMBINED QUESTION DETAIL',body:'question body',contextTags:[],answers:[]};
 await route.fulfill({status:200,headers,body:JSON.stringify(data)});
});
async function eventually(fn,timeout=13000){
 const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await page.waitForTimeout(90)}
 throw Error('timeout '+fn.toString().slice(0,160));
}
async function goto(uri){
 const result=await page.goto(ORIGIN+uri,{waitUntil:'domcontentloaded'});
 assert.equal(result?.status(),200,uri);
}
const detailCount=()=>rpc.filter(x=>x==='community_get_tip_public_v1'||x==='community_get_question_public_v1').length;
try{
 await goto('/creator/?id='+profileId);
 await eventually(async()=>await page.locator('[data-typed-work-route="tip"]').count()===1);
 assert.equal(await page.locator('[data-typed-work-route="dreamsnap-gated"]').count(),1);
 assert.equal(await page.locator('[data-typed-work-route="unavailable"]').count(),1);
 assert(!(await page.locator('body').innerText()).includes('HIDDEN_DREAMSNAP_SECRET'));
 checks.push('COMBINED_CREATOR_TYPED_SOURCE_SEARCH_AND_REDACTION');
 await page.locator('[data-typed-work-route="tip"]').click();
 await eventually(async()=>(await page.locator('article.detail h2').allInnerTexts()).includes('QR COMBINED TIP DETAIL'));
 assert(page.url().includes('/qa/?tip='+tipId));
 checks.push('CREATOR_DISCOVERY_TO_QA_TIP_DETAIL_WITH_CORRECT_ID_TYPE');
 await page.goBack({waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-typed-work-route="question"]').count()===1);
 await page.locator('[data-typed-work-route="question"]').click();
 await eventually(async()=>(await page.locator('article.detail h2').allInnerTexts()).includes('QR COMBINED QUESTION DETAIL'));
 assert(page.url().includes('/qa/?question='+questionId));
 checks.push('CREATOR_DISCOVERY_TO_QA_QUESTION_DETAIL_NO_TIP_CONFUSION');
 const before=detailCount();
 await goto('/qa/?tip='+tipId+'&question='+questionId);
 await eventually(async()=>await page.locator('[data-qa-state="invalid-work-url"]').count()===1);
 assert.equal(detailCount(),before);
 checks.push('CROSS_TYPE_DUPLICATE_QA_URL_FAILCLOSED_NO_RPC');
 await goto('/creator/?id='+profileId);
 await eventually(async()=>await page.locator('[data-typed-work-route="dreamsnap-gated"]').count()===1);
 await page.locator('[data-typed-work-route="dreamsnap-gated"]').click();
 await eventually(async()=>page.url().endsWith('/dreamsnaps/'));
 assert(!page.url().includes(dreamId));
 assert(!rpc.some(x=>/signer|media|storage|community_get_gallery_dreamsnap_public_v1/.test(x)));
 checks.push('CREATOR_DREAMSNAP_GATED_NO_ID_OR_SIGNER');
 assert.deepEqual(pageErrors,[]);
 const result={marker:'QR235_COMBINED_CHROME_CROSS_SURFACE_PASS',checks,source:'SYNTHETIC_ONLY',
   signedActors:false,remoteStage:false,provider:false};
 console.log(JSON.stringify(result));
 await mkdir('.artifacts/qr-web234-integration',{recursive:true});
 await writeFile('.artifacts/qr-web234-integration/result.json',JSON.stringify(result)+'\n');
}catch(err){
 await mkdir('.artifacts/qr-web234-integration',{recursive:true});
 await writeFile('.artifacts/qr-web234-integration/error.txt',String(err)+'\n');
 throw err;
}finally{await browser.close();}
