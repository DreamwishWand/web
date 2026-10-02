import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.QR_PROFILE_BASE_URL || 'http://127.0.0.1:4173/community-lab/profiles/';
const chrome = process.env.CHROME_BIN || undefined;
const outDir = path.resolve('.artifacts/profile-workspace-qr');
await mkdir(outDir,{recursive:true});

let workspaces=[];
let nextId=1;
let requireRecentAuthOnce=true;
const duplicatePlayerId='DUPLICATE-PLAYER-ID';

function lowestFreeSlot(){
  for(let i=1;i<=5;i++) if(!workspaces.some(w=>w.slotIndex===i)) return i;
  return null;
}
function json(route,status,body){ return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}); }
function nowIso(){ return new Date().toISOString(); }

const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={schema:'dreamwish-wand-qr-profile-workspace-browser@1',result:'FAIL',checks:{},consoleErrors:[],pageErrors:[]};

try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
  page.on('pageerror',e=>report.pageErrors.push(String(e)));

  await page.route('**/auth/v1/token?grant_type=password',route=>json(route,200,{
    access_token:'qr-access',refresh_token:'qr-refresh',expires_in:3600,user:{id:'qr-user',email:'qr@example.test'}
  }));
  await page.route('**/auth/v1/logout?scope=local',route=>json(route,204,{}));
  await page.route('**/functions/v1/community-query',async route=>{
    const req=route.request(); const body=JSON.parse(req.postData()||'{}');
    if(body.query==='ddvProfileWorkspaces') return json(route,200,{ok:true,data:workspaces});
    return json(route,400,{error:'QR_UNEXPECTED_QUERY',message:String(body.query)});
  });
  await page.route('**/functions/v1/community-command',async route=>{
    const body=JSON.parse(route.request().postData()||'{}');
    const p=body.payload||{};
    if(body.command==='createDdvProfileWorkspace'){
      if(workspaces.length>=5) return json(route,409,{error:'DDV_PROFILE_WORKSPACE_LIMIT',message:'Maximum 5 retained Workspaces.'});
      const slot=lowestFreeSlot();
      const row={workspaceId:`qr-ws-${nextId++}`,slotIndex:slot,displayName:null,lifecycleState:'active',relationshipKind:p.relationshipKind,identityAssociated:false,createdAt:nowIso(),updatedAt:nowIso()};
      workspaces.push(row); return json(route,200,{ok:true,data:row});
    }
    const row=workspaces.find(w=>w.workspaceId===p.workspaceId);
    if(!row) return json(route,404,{error:'WORKSPACE_NOT_FOUND',message:'Workspace not found.'});
    if(body.command==='updateDdvProfileWorkspace'){
      row.displayName=p.displayName??null; row.lifecycleState=p.lifecycleState; row.updatedAt=nowIso();
      return json(route,200,{ok:true,data:row});
    }
    if(body.command==='associateDdvIdentity'){
      if(p.playerId===duplicatePlayerId) return json(route,409,{error:'DDV_PROFILE_IDENTITY_DUPLICATE',message:'Player ID is already associated with another Workspace on this account.'});
      row.identityAssociated=true; row.identityAssociatedAt=nowIso();
      return json(route,200,{ok:true,data:row});
    }
    if(body.command==='unlinkDdvIdentity'){
      row.identityAssociated=false; row.identityAssociatedAt=null;
      return json(route,200,{ok:true,data:row});
    }
    if(body.command==='deleteDdvProfileWorkspace'){
      if(p.confirmation!=='DELETE') return json(route,400,{error:'CONFIRMATION_REQUIRED',message:'DELETE confirmation required.'});
      if(requireRecentAuthOnce){
        requireRecentAuthOnce=false;
        return json(route,401,{error:'RECENT_AUTH_REQUIRED',message:'Recent authentication required.'});
      }
      workspaces=workspaces.filter(w=>w.workspaceId!==row.workspaceId);
      return json(route,200,{ok:true,data:{deleted:true,workspaceId:row.workspaceId}});
    }
    return json(route,400,{error:'QR_UNEXPECTED_COMMAND',message:String(body.command)});
  });

  await page.goto(baseUrl,{waitUntil:'networkidle'});
  await page.getByLabel('Publishable key').fill('sb_publishable_qr_test');
  await page.getByLabel('Email').fill('qr@example.test');
  await page.getByLabel('Password').fill('0123456789abcde');
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByText(/Authenticated as/).waitFor();

  const relationship=page.getByLabel('New Workspace relationship');
  await relationship.selectOption('self');
  await page.getByRole('button',{name:'Create next Profile'}).click();
  await page.getByRole('button',{name:/Profile 1/}).waitFor();
  await relationship.selectOption('parent_guardian_managed');
  await page.getByRole('button',{name:'Create next Profile'}).click();
  await page.getByRole('button',{name:/Profile 2/}).waitFor();
  report.checks.create_relationships='PASS';

  await page.getByRole('button',{name:/Profile 1/}).click();
  await page.getByLabel('Private label').fill('Main Valley');
  await page.getByLabel('Lifecycle').selectOption('archived');
  await page.getByRole('button',{name:'Save Workspace'}).click();
  const updatedProfileOne = page.getByRole('button',{name:/Main Valley/});
  await updatedProfileOne.waitFor();
  assert.match(await updatedProfileOne.innerText(),/Main Valley/);
  assert.match(await updatedProfileOne.innerText(),/archived/);
  report.checks.custom_label_archive_capacity='PASS';

  await relationship.selectOption('self');
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Create next Profile'}).click();
  await page.getByText(/5 \/ 5 · 0 free/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Create next Profile'}).isDisabled(),true);
  report.checks.retained_five_slot_capacity='PASS';

  await page.getByRole('button',{name:/Profile 1/}).click();
  await page.getByLabel('DDV Player ID / User ID').fill('PLAYER-A');
  await page.getByRole('button',{name:'Associate Player ID'}).click();
  await page.getByText('An optional Player ID is associated with this Workspace.').waitFor();
  await page.getByRole('button',{name:'Unlink Player ID'}).click();
  await page.getByLabel('DDV Player ID / User ID').waitFor();
  report.checks.optional_player_id_ui_unlink='PASS';

  await page.getByRole('button',{name:/Profile 2/}).click();
  await page.getByLabel('DDV Player ID / User ID').fill(duplicatePlayerId);
  await page.getByRole('button',{name:'Associate Player ID'}).click();
  await page.getByText(/already associated with another Workspace/).waitFor();
  report.checks.same_account_duplicate_rejection_presentation='PASS';

  await page.getByRole('button',{name:/Profile 5/}).click();
  const deleteButton=page.getByRole('button',{name:'Delete Profile Workspace'});
  assert.equal(await deleteButton.isDisabled(),true);
  await page.getByPlaceholder('DELETE').fill('DELETE');
  assert.equal(await deleteButton.isEnabled(),true);
  await deleteButton.click();
  await page.getByText(/Recent authentication is required/).waitFor();
  report.checks.explicit_delete_recent_auth_state='PASS';

  await page.getByRole('button',{name:'Sign out'}).click();
  await page.getByLabel('Email').fill('qr@example.test');
  await page.getByLabel('Password').fill('0123456789abcde');
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByRole('button',{name:/Profile 5/}).click();
  await page.getByPlaceholder('DELETE').fill('DELETE');
  await page.getByRole('button',{name:'Delete Profile Workspace'}).click();
  await page.getByText(/4 \/ 5 · 1 free/).waitFor();
  await relationship.selectOption('self');
  await page.getByRole('button',{name:'Create next Profile'}).click();
  await page.getByText(/5 \/ 5 · 0 free/).waitFor();
  assert.ok(await page.getByRole('button',{name:/Profile 5/}).count());
  report.checks.delete_slot_reuse='PASS';

  await page.getByRole('button',{name:/Profile 1/}).click();
  assert.equal(await page.getByLabel('Private label').inputValue(),'Main Valley');
  assert.equal(await page.getByLabel('Lifecycle').inputValue(),'archived');
  await page.getByRole('button',{name:/Profile 2/}).click();
  assert.equal(await page.getByLabel('Private label').inputValue(),'');
  assert.equal(await page.getByLabel('Lifecycle').inputValue(),'active');
  assert.match(await page.getByRole('button',{name:/Profile 2/}).innerText(),/parent_guardian_managed/);
  report.checks.workspace_scoped_state_isolation='PASS';

  report.checks.player_id_live_hmac='SEPARATE_GATE_NOT_EXECUTED';
  assert.equal(report.pageErrors.length,0,report.pageErrors.join(' | '));
  report.result='PASS';
  await page.screenshot({path:path.join(outDir,'profile-workspace-final.png'),fullPage:true});
  await writeFile(path.join(outDir,'profile-workspace-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await context.close();
}catch(error){
  report.error=error instanceof Error?error.stack||error.message:String(error);
  await writeFile(path.join(outDir,'profile-workspace-report.json'),JSON.stringify(report,null,2));
  console.error(report.error); process.exitCode=1;
}finally{ await browser.close(); }
