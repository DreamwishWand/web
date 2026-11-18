// 08 WEB DEC-UX-25/49: local Moodboard main+previous document safety.
// Synchronous Web Storage has per-key atomic writes, not a two-key transaction.
// Compensate and READ BACK both original raw values after any denial or a
// silently incomplete write. This is not a Save Writer/Backup or Cloud adapter.
import {
 MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY,serializeMoodboardDocument
} from './store.js';
const fail=code=>{throw Error('MOODBOARD_LOCAL_'+code)};
export function persistMoodboardLocalChange(storage,next,expectedRaw){
 if(!storage||typeof storage.getItem!=='function'||
    typeof storage.setItem!=='function'||
    !(expectedRaw===null||typeof expectedRaw==='string'))
  fail('STORAGE_UNAVAILABLE');
 // Serialize/validate BEFORE changing either stored document.
 const nextRaw=serializeMoodboardDocument(next);
 const currentRaw=storage.getItem(MOODBOARD_STORAGE_KEY);
 const originalBackup=storage.getItem(MOODBOARD_BACKUP_KEY);
 // A newer tab or a separately imported portable backup must never be
 // overwritten by a stale in-memory board and a new previous snapshot.
 if(currentRaw!==expectedRaw)fail('STALE');
 if(currentRaw===nextRaw)return nextRaw;

 try{
  if(currentRaw!==null)storage.setItem(MOODBOARD_BACKUP_KEY,currentRaw);
  storage.setItem(MOODBOARD_STORAGE_KEY,nextRaw);
  if(storage.getItem(MOODBOARD_STORAGE_KEY)!==nextRaw||
     (currentRaw!==null&&storage.getItem(MOODBOARD_BACKUP_KEY)!==currentRaw))
    fail('COMMIT_UNVERIFIED');
 }catch(error){
  // Restore recoverable PREVIOUS first, even if restoring current fails.
  // A failed compensation must not be reported as a successful Moodboard.
  let restored=true;
  for(const [key,raw] of [
   [MOODBOARD_BACKUP_KEY,originalBackup],[MOODBOARD_STORAGE_KEY,currentRaw]
  ]){
   try{
    if(storage.getItem(key)===raw)continue;
    if(raw===null){
     if(typeof storage.removeItem!=='function')fail('REMOVE_UNAVAILABLE');
     storage.removeItem(key);
    }else storage.setItem(key,raw);
   }catch{restored=false}
  }
  try{
   if(storage.getItem(MOODBOARD_BACKUP_KEY)!==originalBackup||
      storage.getItem(MOODBOARD_STORAGE_KEY)!==currentRaw)restored=false;
  }catch{restored=false}
  if(!restored)throw Error('MOODBOARD_LOCAL_ROLLBACK_UNVERIFIED',{cause:error});
  throw error;
 }
 return nextRaw;
}
