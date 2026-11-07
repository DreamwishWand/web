// Collection → the existing local Moodboards store. No second storage model.
import {
  MOODBOARD_STORAGE_KEY, MOODBOARD_BACKUP_KEY,
  addMoodboardReference, createEmptyMoodboardDocument,
  parseMoodboardDocument, removeMoodboardReference, serializeMoodboardDocument
} from '../moodboards/store.js';

export function readCollectionMoodboards(storage) {
  if (!storage || typeof storage.getItem !== 'function') throw new TypeError('Local Moodboard storage unavailable.');
  const raw = storage.getItem(MOODBOARD_STORAGE_KEY);
  return raw === null ? createEmptyMoodboardDocument() : parseMoodboardDocument(raw);
}

export function toggleCollectionMoodboardInspiration(storage, boardId, itemId, verifiedRecords, familyLabel = '') {
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || !Array.isArray(verifiedRecords))
    throw new TypeError('Verified Collection ItemID required.');
  const trusted = verifiedRecords.find(row =>
    row?.itemId === itemId && typeof row.label === 'string' && row.label.trim() !== ''
  );
  if (!trusted) throw new TypeError('ItemID is absent from the verified visible Collection scope.');
  if (typeof boardId !== 'string' || !boardId) throw new RangeError('Select a Moodboard.');
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
    throw new TypeError('Local Moodboard storage unavailable.');

  // Always re-read: never write a stale in-memory snapshot over another tab's change.
  const previous = storage.getItem(MOODBOARD_STORAGE_KEY);
  const current = previous === null ? createEmptyMoodboardDocument() : parseMoodboardDocument(previous);
  const board = current.boards.find(entry => entry.id === boardId);
  if (!board) throw new RangeError('Selected Moodboard is missing.');
  const entityId = String(itemId);
  const existing = board.references.find(ref => ref.type === 'ITEM' && ref.entityId === entityId);
  const next = existing
    ? removeMoodboardReference(current, boardId, existing.id)
    : addMoodboardReference(current, boardId, {
        type: 'ITEM', entityId, label: trusted.label,
        note: typeof familyLabel === 'string' ? familyLabel : ''
      }).document;

  // Serialize first; if the backup or primary write fails, the UI must not report success.
  const serialized = serializeMoodboardDocument(next);
  if (previous !== null) storage.setItem(MOODBOARD_BACKUP_KEY, previous);
  storage.setItem(MOODBOARD_STORAGE_KEY, serialized);
  return {document: next, action: existing ? 'removed' : 'added', entityId};
}
