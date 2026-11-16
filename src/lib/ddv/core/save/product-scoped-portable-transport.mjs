// Fixed Policy73 portable Restore transport over the existing single Rust owner.
import {createScopedEditLifecycle} from './product-scoped-amount-transport.mjs';
const fail=()=>{throw Error('PRODUCT_PORTABLE_RESTORE_DENIED')};
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const sha=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
export const portableBytesOk=b=>b instanceof Uint8Array&&b.length>0&&b.length<=1048576;
export const portableTargetOk=(mode,t)=>(mode==='catalog0'||mode==='switch-catalog0')?exact(t,'itemId')&&uint(t.itemId)&&(mode==='switch-catalog0'?t.itemId===40000076:t.itemId>=40000000&&t.itemId<50000000):(mode==='chest'||mode==='switch-chest')&&exact(t,'containerId,slotIndex')&&uint(t.containerId)&&t.containerId>1&&uint(t.slotIndex)&&t.slotIndex<48;
export function createPortableRestoreTransport(wasm,initial,identity,{parse,current,revoke,maxBytes,chunkBytes},mode){
 const sw=mode==='switch-catalog0'||mode==='switch-chest',domain=sw?mode.slice(7):mode,abi=sw?'switch626_'+domain:domain,build=sw?'switch626':'steam626';
 if(!['catalog0','chest'].includes(domain)||identity.platform!==(sw?'switch':'steam-windows')||identity.buildKind!==(sw?'switch-bid':'steam-full-version')||identity.buildId!==(sw?'9A239D3DB569756D':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22')||identity.schema!==626)fail();
 const chest=domain==='chest',contract='wand.worker.'+build+'.'+domain+'-portable-restore@1',capture='capture_'+abi+'_portable_backup',previewMethod='preview_'+abi+'_portable_restore',stageMethod='stage_'+abi+'_portable_restore';
 if([capture,previewMethod,stageMethod].some(k=>typeof wasm[k]!=='function'))fail();
 let saved=null,preview=null,target=null;
 const clear=()=>{saved?.fill(0);saved=null;preview=null;target=null};
 const life=createScopedEditLifecycle(wasm,initial,{parse,current,revoke:()=>{clear();revoke()},maxBytes,chunkBytes,contract,outputContract:'wand.worker.'+build+'.'+domain+'-portable-restore-output@1',toggleMethod:'toggle_'+abi+'_portable_restore',beginMethod:'begin_'+abi+'_portable_restore_output',nextMethod:'next_'+abi+'_portable_restore_output_chunk',expectedProjection:()=>preview?.projectedSha256??null});
 const args=t=>{if(!portableTargetOk(mode,t))fail();return chest?[t.containerId,t.slotIndex]:[t.itemId]};
 const summary=()=>Object.freeze({itemId:preview.itemId,...(chest?{containerId:preview.containerId,slotIndex:preview.slotIndex}:{}),oldAmount:preview.oldAmount,newAmount:preview.newAmount,exactFieldChangedCount:1,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false});
 const captureBackup=t=>life.checked(()=>{if(life.hasMutation())fail();const b=wasm[capture](...args(t),...life.args());if(!portableBytesOk(b))fail();return b});
 const previewTarget=(t,b)=>life.checked(()=>{if(life.hasMutation()||!portableBytesOk(b))fail();clear();target=Object.freeze({...t});const select=args(target);saved=b.slice();
  const r=parse(wasm[previewMethod](...select,saved,...life.args()),4096);
  if(!exact(r,'contract,itemId,oldAmount,newAmount,entrySha256,backupSha256,projectedSha256,writerAuthorized'+(chest?',containerId,slotIndex':''))||r.contract!==contract||!uint(r.itemId)||r.itemId===0||(chest?(r.containerId!==target.containerId||r.slotIndex!==target.slotIndex||r.oldAmount!==50||r.newAmount!==49):r.itemId!==target.itemId)||!uint(r.oldAmount)||!uint(r.newAmount)||r.oldAmount>9999||r.newAmount<1||r.newAmount!==r.oldAmount-1||![r.entrySha256,r.backupSha256,r.projectedSha256].every(sha)||r.projectedSha256===initial.decodedSha256||r.writerAuthorized!==false)fail();
  preview=Object.freeze(r);return summary()
 });
 const stage=()=>life.checked(()=>{if(!preview||!saved||life.hasMutation())fail();const p=preview;return Object.freeze({...summary(),...life.stage((...a)=>wasm[stageMethod](...args(target),saved,p.oldAmount,p.newAmount,p.entrySha256,p.backupSha256,p.projectedSha256,...a))})});
 const toggle=redo=>life.checked(()=>Object.freeze({...summary(),...life.toggle(redo)}));
 return Object.freeze({captureBackup,previewTarget,stage,toggle,takeOutput:life.takeOutput,hasMutation:life.hasMutation,clear});
}
