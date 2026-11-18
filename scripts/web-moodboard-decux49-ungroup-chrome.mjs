import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const bin=process.env.CHROME_BIN;
assert.ok(bin,'Chrome executable is required');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const width of [1366,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  const unsafe=[];
  page.on('request',r=>{if(r.method()!=='GET')unsafe.push(r.method()+':'+r.url());});
  try{
   await page.goto('http://127.0.0.1:4298/web/moodboards/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('.moodboards-page').waitFor({state:'visible',timeout:30000});
   const original=await page.evaluate(()=>{
    const now='2026-11-18T00:00:00.000Z';
    const ref=(id,type,label,entityId,groupIds)=>({id,type,label,url:null,entityId,note:null,groupIds,createdAt:now});
    const board={
     id:'board_garden',title:'Garden',description:null,createdAt:now,updatedAt:now,
     groups:[
      {id:'group_garden',title:'Garden ideas',order:0,collapsed:false},
      {id:'group_kitchen',title:'Kitchen ideas',order:1,collapsed:false}
     ],
     references:[
      ref('ref_item','ITEM','Potted flower','40000047',['group_garden']),
      ref('ref_preset','WAND_PRESET','Terrace','preset_1',['group_garden','group_kitchen']),
      ref('ref_note','NOTE','Soft greens',null,['group_garden']),
      ref('ref_other','NOTE','Morning coffee',null,['group_kitchen'])
     ]
    };
    const other={id:'board_other',title:'Unaffected',description:null,createdAt:now,updatedAt:now,groups:[],references:[]};
    const data=JSON.stringify({schema:'wand.moodboards.local@1',version:2,updatedAt:now,boards:[board,other]});
    localStorage.setItem('dreamwishwand:moodboards:v1',data);
    localStorage.removeItem('dreamwishwand:moodboards:v1:backup');
    return data;
   });
   await page.reload({waitUntil:'domcontentloaded'});
   const group=page.locator('[data-group-id="group_garden"]');
   await group.waitFor({state:'visible',timeout:20000});
   const remove=group.locator('button[data-moodboard-ungroup="group_garden"]');
   assert.equal(await remove.count(),1);
   const name=await remove.getAttribute('aria-label');
   assert.ok(name?.includes('Garden ideas'));
   assert.equal(await page.locator('[data-group-id="unsorted"] [data-moodboard-ungroup]').count(),0,'unsorted never deletable');
   const box=await remove.boundingBox();assert.ok(box?.height>=44,'touch target');
   await remove.focus();assert.equal(await remove.evaluate(el=>document.activeElement===el),true,'keyboard focus');
   await remove.click();
   await group.waitFor({state:'detached',timeout:20000});
   const after=await page.evaluate(()=>{
     const next=JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1'));
     return {
      rawPrevious:localStorage.getItem('dreamwishwand:moodboards:v1:backup'),
      boards:next.boards.map(b=>({id:b.id,title:b.title,groups:b.groups.map(g=>g.id),refs:b.references.map(r=>({id:r.id,groups:r.groupIds}))}))
     };
   });
   assert.equal(after.rawPrevious,original,'previous document is recoverable byte for byte');
   assert.equal(after.boards.length,2);
   assert.deepEqual(after.boards[0].groups,['group_kitchen'],'only Garden group removed');
   assert.deepEqual(after.boards[0].refs,[
    {id:'ref_item',groups:[]},
    {id:'ref_preset',groups:['group_kitchen']},
    {id:'ref_note',groups:[]},
    {id:'ref_other',groups:['group_kitchen']}
   ],'all original Items Presets Notes remain, shared membership retained');
   assert.deepEqual(after.boards[1],{id:'board_other',title:'Unaffected',groups:[],refs:[]},'other Board never touched');
   assert.equal(await page.locator('[data-group-id="unsorted"] .reference-card').count(),2,'exclusive refs move to Unsorted');
   assert.equal(await page.locator('[data-group-id="group_kitchen"] .reference-card').count(),2,'shared references remain in Kitchen');
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2,'board count intact');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no mobile overflow');
   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'200 percent layout no overflow');
   }
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-group-id="group_garden"]').count(),0,'independent reopened document keeps ungroup operation');
   await page.getByRole('button',{name:'Restore previous snapshot'}).click();
   await page.locator('[data-group-id="group_garden"]').waitFor({state:'visible',timeout:20000});
   const reopened=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')).boards[0]);
   assert.equal(reopened.references.length,4);
   assert.equal(reopened.groups.length,2,'prior group and memberships restored from previous snapshot');
   assert.deepEqual(reopened.references[0].groupIds,['group_garden']);
   assert.deepEqual(unsafe,[],'no POST/upload/network mutation');
   console.log('08WEB_DECUX49_UNGROUP_KEEP_REFERENCES_BACKUP_RESTORE_INDEPENDENT_REOPEN_PASS_'+width);
  }finally{await page.close();await context.close();}
 }
 assert.deepEqual(errors,[],'browser runtime errors');
 console.log('08WEB_DECUX49_LOCAL_PERSISTENCE_GROUP_ONLY_NOT_CONTENT_DELETE_PASS');
}finally{await browser.close();}
