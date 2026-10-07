export * from './transaction-foundation-base-v125.js';
export {
  STORAGE_FURNITURE_TRANSITION_TARGET_KIND,
  STORAGE_FURNITURE_TRANSITION_IDENTITY_POLICY
} from './storage-transaction-target-v125.js';

import {
  createVerifiedWriteCandidate as createBaseCandidate,
  verifyWriteCandidate as verifyBaseCandidate
} from './transaction-foundation-base-v125.js';
import {
  STORAGE_FURNITURE_TRANSITION_TARGET_KIND,
  createVerifiedStorageTransitionCandidate,
  verifyStorageTransitionCandidate
} from './storage-transaction-target-v125.js';

export async function createVerifiedWriteCandidate(args){
  if(args?.plan?.target?.kind===STORAGE_FURNITURE_TRANSITION_TARGET_KIND)
    return createVerifiedStorageTransitionCandidate(args);
  return createBaseCandidate(args);
}

export async function verifyWriteCandidate(args){
  const kind=args?.candidate?.plan?.target?.kind??args?.candidate?.manifest?.target?.kind;
  if(kind===STORAGE_FURNITURE_TRANSITION_TARGET_KIND)
    return verifyStorageTransitionCandidate(args);
  return verifyBaseCandidate(args);
}
