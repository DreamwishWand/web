// Deterministic synthetic-only decoded schema626 fixture; streaming output.
// Usage: node generate-synthetic.mjs /tmp/f.json 16 mib 1000 low|mixed|high
import {openSync,writeSync,closeSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [file,sizeText,unit='mib',gridText='1000',entropy='mixed']=process.argv.slice(2);
const size=Number(sizeText),grid=Number(gridText);
if(!file||!Number.isSafeInteger(size)||size<1||size>200||
   !['mb','mib'].includes(unit)||!Number.isSafeInteger(grid)||grid<0||grid>300000||
   !['low','mixed','high'].includes(entropy))throw Error('USAGE_FILE_SIZE_MB_OR_MIB_GRID_ENTROPY');
const exactSize=size*(unit==='mb'?1000000:1048576);
const path='/World/RecurringEvents/0/ItemSpawning/NextOccurrence';
const header='{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}}},"GridCollection":{"Objects":[';
const mid=']}},"Unknown":{"Survive":{"unicode":"\\u00e9","unknownNumberText":"9007199254740993"},"Padding":"';
const tail='"}}';
const fd=openSync(file,'w');const h=createHash('sha256');let total=0;
function write(value){
 const buffer=typeof value==='string'?Buffer.from(value):value;
 writeSync(fd,buffer);h.update(buffer);total+=buffer.length;
}
try{
 write(header);
 for(let i=0;i<grid;i++){
  const entry=(i?',':'')+'{"ItemID":'+(1000000+i)+',"x":'+(i%987)+',"z":'+(i%739)+',"Opaque":"keep"}';
  write(entry);
 }
 write(mid);
 const padding=exactSize-total-Buffer.byteLength(tail);
 if(padding<0)throw Error('GRID_COUNT_EXCEEDS_FIXTURE_SIZE');
 let state=0xA5C3B107;
 const chunk=Buffer.alloc(65536);
 while(total<exactSize-Buffer.byteLength(tail)){
  const count=Math.min(chunk.length,exactSize-Buffer.byteLength(tail)-total);
  for(let i=0;i<count;i++){
   state^=state<<13;state^=state>>>17;state^=state<<5;
   const v=state>>>0;
   chunk[i]=entropy==='low'?65:
    entropy==='mixed'&&i%4!==0?65:
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[v%62].charCodeAt(0);
  }
  write(chunk.subarray(0,count));
 }
 write(tail);
} finally{closeSync(fd);}
if(statSync(file).size!==exactSize)throw Error('SYNTHEXACT_SIZE_DRIFT');
console.log(JSON.stringify({type:'SYNTHETIC_SCHEMA626_JSON',bytes:total,
 sizeMB:(total/1000000).toFixed(3),sizeMiB:(total/1048576).toFixed(3),gridObjects:grid,
 entropy,sha256:h.digest('hex'),editedPointer:path}));
