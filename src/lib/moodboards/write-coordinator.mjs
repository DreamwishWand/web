// Local-only Moodboard cross-tab writer coordination.
// Web Locks are an exclusive SAME-ORIGIN protocol for cooperating app clients,
// NOT localStorage CAS and NOT a guarantee against stale/uncooperative old builds.
// Fail closed when unavailable; no timer, cloud, or second Moodboard data model.
import {
 MOODBOARD_STORAGE_KEY, MOODBOARD_BACKUP_KEY,
 createEmptyMoodboardDocument, parseMoodboardDocument, serializeMoodboardDocument
} from './store.js';

export const MOODBOARD_EXCLUSIVE_LOCK = 'dreamwishwand:moodboards:v1:exclusive-write';
export const MOODBOARD_WRITE_OPERATION = 'COOPERATIVE_WEB_LOCK_FAIL_CLOSED_NOT_ATOMIC_LOCALSTORAGE_CAS';

export async function withExclusiveMoodboardCommit(storage, createNext, {
 locks = globalThis.navigator?.locks,
 expectedRaw = undefined
} = {}) {
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
  throw Error('MOODBOARD_STORAGE_UNAVAILABLE');
 if(typeof createNext!=='function')throw Error('MOODBOARD_MUTATION_UNAVAILABLE');
 if(!locks||typeof locks.request!=='function')
  throw Error('MOODBOARD_EXCLUSIVE_LOCK_UNAVAILABLE');
 // Do not silently fall back to localStorage read/check/write. This lock is
 // shared by EVERY modern first-party writer (Moodboards/Collection/Explore/Item).
 return locks.request(MOODBOARD_EXCLUSIVE_LOCK, {mode:'exclusive'}, async lock=>{
  if(!lock)throw Error('MOODBOARD_EXCLUSIVE_LOCK_NOT_GRANTED');
  const previous=storage.getItem(MOODBOARD_STORAGE_KEY);
  if(expectedRaw!==undefined && previous!==expectedRaw)
   throw Error('MOODBOARD_STALE_REVISION_DENIED');
  const current=previous===null?createEmptyMoodboardDocument():parseMoodboardDocument(previous);
  const outcome=createNext(current);
  const next=outcome?.document??outcome;
  const serialized=serializeMoodboardDocument(next);
  // Exact prior backup, with failure never claiming the new primary write.
  if(previous!==null)storage.setItem(MOODBOARD_BACKUP_KEY,previous);
  // Defense against an actor not using our lock, including a backup-triggered
  // synchronous interleave. This check alone is NOT described as atomic CAS.
  if(storage.getItem(MOODBOARD_STORAGE_KEY)!==previous)
   throw Error('MOODBOARD_CONCURRENT_NONCOOPERATING_WRITE_DENIED');
  storage.setItem(MOODBOARD_STORAGE_KEY,serialized);
  // Verify acknowledgement; a side-effecting/injected adapter cannot report
  // success after replacing our write with another value.
  if(storage.getItem(MOODBOARD_STORAGE_KEY)!==serialized)
   throw Error('MOODBOARD_WRITE_VERIFICATION_FAILED');
  return Object.freeze({...outcome,document:next,committedRaw:serialized});
 });
}
