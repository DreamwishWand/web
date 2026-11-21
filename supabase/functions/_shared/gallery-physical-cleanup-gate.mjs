/**
 * #124 Physical origin deletion is separately gated from Gallery SQL claims.
 * One SQL boolean is insufficient release evidence: all four reviewed gate
 * fields must be present and each positive proof explicitly true before the
 * worker may reach Storage.remove. This helper does not grant permission.
 */
const REQUIRED_PROOFS = Object.freeze([
  'signedActorPhysicalAbsenceProven',
  'externalStorageRaceCertified',
  'cloudDependencyGraphComplete'
]);

export function classifyGalleryPhysicalCleanupGate(gate) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate) ||
      typeof gate.physicalDeleteAuthorized !== 'boolean' ||
      typeof gate.conditional72hEnabled !== 'boolean' ||
      REQUIRED_PROOFS.some(key => typeof gate[key] !== 'boolean')) {
    return 'invalid';
  }
  if (gate.physicalDeleteAuthorized === false) return 'disabled';
  return REQUIRED_PROOFS.every(key => gate[key] === true)
    ? 'authorized' : 'invalid';
}
