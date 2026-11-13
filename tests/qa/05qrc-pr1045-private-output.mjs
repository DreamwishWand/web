// Independent synthetic CLI private output integrity; Linux local test only.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rename,symlink,readdir,readlink,stat,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const exe=resolve(process.argv[2]),d=await mkdtemp(join(tmpdir(),'qa1045-'));
const raw=Buffer.from(JSON.stringify({GameInfo:{Version:626},World:{Characters:[{Base:{id:10000053},SkinID:170000009}],DialogueFlags:[50000017]},Player:{ListInventories:{42:{ID:42,CompatibleItemType:'ItemType_Skin',Inventory:{170000007:{Amount:3},170000009:{Amount:2}}}}}}));
const sha=x=>createHash('sha256').update(x).digest('hex');
const env={...process.env,WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',WAND_LOCAL_ORIGINAL_SHA256:'b'.repeat(64),WAND_LOCAL_ORIGINAL_SIZE_BYTES:'321',WAND_LOCAL_DECODED_SHA256:sha(raw)};
const args=p=>['--character-skin-dependencies-receipt-only','10000053','170000007','50000017','--out',p];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(parent){
 const p=spawn(exe,args(join(parent,'receipt.json')),{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);const done=new Promise((r,j)=>{p.on('error',j);p.on('close',code=>r({code,stdout,stderr}))});
 try{let pinned=false;for(let i=0;i<300&&!pinned;i++){for(const fd of await readdir('/proc/'+p.pid+'/fd').catch(()=>[])){if(await readlink('/proc/'+p.pid+'/fd/'+fd).catch(()=>null)===parent){pinned=true;break}}if(!pinned)await pause(10)}assert(pinned,'pinned directory not observed');return {p,done}}
 catch(e){p.kill();await done;throw e}
}
try{
 const a=join(d,'a'),b=join(d,'b'),c=join(d,'c');for(const p of [a,b,c])await mkdir(p,{mode:0o700});
 let x=await start(a);try{await rename(a,join(d,'moved'));await symlink(b,a);x.p.stdin.end(raw);const r=await x.done;assert.equal(r.code,0,r.stderr);assert.equal(r.stdout,'');const out=join(d,'moved','receipt.json');assert.equal((await stat(out)).mode&0o777,0o600);const v=JSON.parse(await readFile(out));assert.equal(v.decodedSha256,sha(raw));assert.equal(v.oldSkinInventory.savedAmount,2);assert.equal(v.selectedSkin.skinInventory.savedAmount,3);assert.equal(v.writerAuthorized,false);assert.equal((await readdir(b)).length,0)}finally{x.p.kill()}
 // Actual create-new collision after descriptor pin, before stdin completion.
 x=await start(c);const marker=Buffer.from('synthetic-existing-file');try{await writeFile(join(c,'receipt.json'),marker,{flag:'wx',mode:0o600});x.p.stdin.end(raw);const r=await x.done;assert.equal(r.code,12,r.stderr);assert.equal(r.stdout,'');assert.match(r.stderr,/PRIVATE_OUTPUT_CREATE_NEW/);assert.deepEqual(await readFile(join(c,'receipt.json')),marker)}finally{x.p.kill()}
 console.log('QA1045_ACTUAL_PINNED_RENAME_COLLISION_PRIVATE_OUTPUT_PASS');
}finally{await rm(d,{recursive:true,force:true})}
