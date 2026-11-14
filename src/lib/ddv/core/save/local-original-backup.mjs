// Shared original encrypted-byte backup transport. No decoding, session mint,
// persistence assertion, or Writer authority; callers must bind a live source.
// Bound platform intrinsics: a caller can shadow Blob#slice, Blob#arrayBuffer
// and even the size getter on its instance or a subclass. Never invoke those
// untrusted methods while asserting an original-backup byte equivalence.
const nativeBlobSlice = Blob.prototype.slice;
const nativeBlobArrayBuffer = Blob.prototype.arrayBuffer;
const nativeBlobSize = Object.getOwnPropertyDescriptor(Blob.prototype,'size').get;
const trueBlobSize = blob => nativeBlobSize.call(blob);
const trueBlobChunk = (blob,start,end) =>
  nativeBlobArrayBuffer.call(nativeBlobSlice.call(blob,start,end));

export function requestOriginalByteBackup(originalSelectedFile){
 if(!(originalSelectedFile instanceof Blob))throw Error('LOCAL_ORIGINAL_BACKUP_STALE_OR_UNAVAILABLE');
    if(typeof document==='undefined'||typeof URL?.createObjectURL!=='function')
      throw Error('LOCAL_ORIGINAL_BACKUP_BROWSER_ONLY');
    const url=URL.createObjectURL(originalSelectedFile);
    try{
      const a=document.createElement('a');
      a.href=url;
      a.download=String(originalSelectedFile.name||'profile.p1g')
        .replace(/[^\\w.\\-]/g,'_')+'.original-backup.p1g';
      a.click();
    }finally{
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }

 return Object.freeze({downloadRequested:true,persistedVerified:false,writerAuthorized:false});
}
export async function compareOriginalBackupBytes(original,candidate,current,maxBytes){
 if(typeof current!=='function'||!current())throw Error('LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>128*1024*1024)
  throw Error('LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED');
    let originalBytes,candidateBytes;
    try{
      if(!(candidate instanceof Blob)||candidate===original)
        throw Error('NOT_DISTINCT');
      originalBytes=trueBlobSize(original);
      candidateBytes=trueBlobSize(candidate);
    }catch{
      throw Error('LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED');
    }
    if(candidateBytes!==originalBytes||candidateBytes===0||
       !Number.isSafeInteger(candidateBytes)||
       candidateBytes>maxBytes)
      throw Error('LOCAL_BACKUP_CANDIDATE_NOT_DISTINCT_BOUNDED');
    const step=1024*1024;
    for(let start=0;start<originalBytes;start+=step){
      if(!current())throw Error('LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED');
      const end=Math.min(start+step,originalBytes);
      let left,right;
      try{
        [left,right]=await Promise.all([
          trueBlobChunk(original,start,end),
          trueBlobChunk(candidate,start,end)
        ]);
      }catch{
        throw Error('LOCAL_BACKUP_CANDIDATE_LOCAL_READ_FAILED');
      }
      if(!current())throw Error('LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED');
      if(left.byteLength!==end-start||right.byteLength!==end-start)
        throw Error('LOCAL_BACKUP_CANDIDATE_CHUNK_LENGTH_MISMATCH');
      const a=new Uint8Array(left),b=new Uint8Array(right);
      for(let i=0;i<a.length;i++){
        if(a[i]!==b[i])throw Error('LOCAL_BACKUP_CANDIDATE_BYTES_DIFFER');
      }
    }
    if(!current())throw Error('LOCAL_BACKUP_CANDIDATE_SESSION_REVOKED');

 return originalBytes;
}
