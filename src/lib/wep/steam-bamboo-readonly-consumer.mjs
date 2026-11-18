// 08 WEB ACT1709: UI DTO and exact read-only Steam626 Bamboo target.
// This is NOT a release anchor, Build proof, entitlement, Reader grant or
// a replacement for the single Rust ProductSession.
export const BAMBOO_CONSUMER_CONTRACT='wand.web.steam626.bamboo40700007.reader-consumer@1';
export const BAMBOO_READ_KIND='READ_STEAM626_BAMBOO_P1G_ONCE';
export const BAMBOO_RESULT_KIND='STEAM626_BAMBOO_P1G_RESULT';
export const BAMBOO_READY_KIND='STEAM626_BAMBOO_READER_READY';
export const BAMBOO_STEAM_FULL_VERSION='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
export const BAMBOO_READ_TARGET_ITEM_ID=40700007;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const uint32=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const reject=()=>{throw Error('BAMBOO_CONSUMER_RECEIPT_DENIED')};
// Only a sanitized Rust-issued one-time receipt may cross Worker -> UI.
// No original SHA, session, CAS, root digest, reference, raw JSON or token.
export function projectBambooReadOnlyResult(result){
 if(!exact(result,'itemId,gridId,x,y,oldStock,nextGridObjectId,readOnly,productReadAccepted,writerAuthorized,stageAuthorized,editedCopyAuthorized,operationOn')||
    result.itemId!==BAMBOO_READ_TARGET_ITEM_ID||
    ![result.gridId,result.x,result.y,result.oldStock].every(uint32)||
    !uint32(result.nextGridObjectId)||result.nextGridObjectId===0||
    result.readOnly!==true||result.productReadAccepted!==false||
    result.writerAuthorized!==false||result.stageAuthorized!==false||
    result.editedCopyAuthorized!==false||result.operationOn!==false)reject();
 return Object.freeze({
  itemId:BAMBOO_READ_TARGET_ITEM_ID,gridId:result.gridId,x:result.x,y:result.y,
  oldStock:result.oldStock,nextGridObjectId:result.nextGridObjectId,
  readOnly:true,writerAuthorized:false,stageAuthorized:false,
  editedCopyAuthorized:false,operationOn:false
 });
}
export function exactBambooRequest(data){
 return exact(data,'kind,requestId,file,gridId,x,y,externalSteamBuildObserved')&&
  data.kind===BAMBOO_READ_KIND&&data.requestId===1&&
  data.externalSteamBuildObserved===true&&
  [data.gridId,data.x,data.y].every(uint32);
}
export function exactBambooUiResult(data){
 return exact(data,'contract,kind,requestId,ok,result')&&
  data.contract===BAMBOO_CONSUMER_CONTRACT&&data.kind===BAMBOO_RESULT_KIND&&
  data.requestId===1&&data.ok===true&&
  (()=>{try{projectBambooReadOnlyResult(data.result);return true}catch{return false}})();
}
