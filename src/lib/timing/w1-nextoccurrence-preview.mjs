// Pure UI PREVIEW DTO for Switch DDV v1.25.3 schema626.
// Never stage, patch, encode, or authorize export: ONLY Wand-owned Rust Core
// may subsequently prove authoritative old/raw CAS, refs and native semantics.
export const W1_UI_PREVIEW_CONTRACT='wand.w1.nextoccurrence.ui-preview-only@1';
export const W1_UI_WRITER_ENABLED=false;
export const W1_UI_ENCODE_COPY_ENABLED=false;
const BID='9A239D3DB569756D';
const POINTER='/World/RecurringEvents/155/ItemSpawning/NextOccurrence';
const EVENT=2010000021;
const oldOrNewUtc=value=>{
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(value))
   throw Error('W1_PREVIEW_UTC_FORMAT_REQUIRED');
 const [y,m,d,hh,mm,ss]=[value.slice(0,4),value.slice(5,7),value.slice(8,10),
  value.slice(11,13),value.slice(14,16),value.slice(17,19)].map(Number);
 if(y<1||m<1||m>12||hh>23||mm>59||ss>59)throw Error('W1_PREVIEW_UTC_INVALID');
 const max=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
 if(d<1||d>max)throw Error('W1_PREVIEW_UTC_INVALID');
 return value;
};
export function previewNextOccurrenceUiOnly(row,nextUtc,{
 sourceSha256,registrySha256,externalBid,sourceSchema,sourceRevision=0
}={}){
 if(externalBid!==BID||sourceSchema!==626||
    !/^[0-9a-f]{64}$/.test(String(sourceSha256||''))||
    !/^[0-9a-f]{64}$/.test(String(registrySha256||''))||
    sourceRevision!==0) throw Error('W1_PREVIEW_SOURCE_IDENTITY_UNPROVEN');
 if(!row||row.eventId!==EVENT||row.mapKey!=='155'||row.savedIndex!==155||
    row.oneof!=='ItemSpawning'||row.sourcePointer!==POINTER||
    row.ambiguous!==false||row.registryKnown!==true||row.policy!=='W1')
   throw Error('W1_PREVIEW_OPERATION_NOT_YET_SUPPORTED');
 const old=oldOrNewUtc(row.nextOccurrence);
 const proposed=oldOrNewUtc(nextUtc);
 if(old===proposed)throw Error('W1_PREVIEW_NOOP_DENIED');
 return Object.freeze({
  contract:W1_UI_PREVIEW_CONTRACT,
  eventId:EVENT,savedMapKey:'155',oneof:'ItemSpawning',
  exactDiff:[Object.freeze({pointer:POINTER,oldUtc:old,newUtc:proposed})],
  sourceSha256,registrySha256,sourceRevision,proposedRevision:1,
  originalFirstBackupRequired:true,
  sourceOwnedCoreCasAccepted:false,
  fullReferenceClosureAccepted:false,
  nativeSemanticsAccepted:false,
  atomicStageCommitted:false,
  encodeCopyAuthorized:false,
  originalOverwriteAuthorized:false,
  previewOnly:true
 });
}
