// Collection → the existing local Moodboards store. No second storage model.
import {
  MOODBOARD_STORAGE_KEY,
  addMoodboardReference, createEmptyMoodboardDocument, createMoodboard,
  parseMoodboardDocument, removeMoodboardReference, serializeMoodboardDocument
} from '../moodboards/store.js';
import { withExclusiveMoodboardCommit } from '../moodboards/write-coordinator.mjs';

export function readCollectionMoodboards(storage) {
  if (!storage || typeof storage.getItem !== 'function') throw new TypeError('Local Moodboard storage unavailable.');
  const raw = storage.getItem(MOODBOARD_STORAGE_KEY);
  return raw === null ? createEmptyMoodboardDocument() : parseMoodboardDocument(raw);
}

export async function toggleCollectionMoodboardInspiration(storage, boardId, itemId, verifiedRecords, familyLabel = '', options = {}) {
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || !Array.isArray(verifiedRecords))
    throw new TypeError('Verified Collection ItemID required.');
  const trusted = verifiedRecords.find(row =>
    row?.itemId === itemId && typeof row.label === 'string' && row.label.trim() !== ''
  );
  if (!trusted) throw new TypeError('ItemID is absent from the verified visible Collection scope.');
  if (typeof boardId !== 'string' || !boardId) throw new RangeError('Select a Moodboard.');
  return withExclusiveMoodboardCommit(storage, current => {
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
    return {document: next, action: existing ? 'removed' : 'added', entityId};
  },options);
}


// Explicit first-board flow: validate the *visible verified* Catalog item, create
// the board and add its ITEM in memory, then commit ONE primary local write.
// No implicit creation when the user simply tries the existing add/remove button.
export async function createFirstCollectionMoodboardWithItem(storage, title, itemId, verifiedRecords, familyLabel = '', options = {}) {
  const name = typeof title === 'string' ? title.trim() : '';
  if (!name || name.length > 120) throw new TypeError('Enter a Moodboard title (1–120 characters).');
  if (!Number.isSafeInteger(itemId) || itemId <= 0 || !Array.isArray(verifiedRecords))
    throw new TypeError('Verified Collection ItemID required.');
  const trusted = verifiedRecords.find(row =>
    row?.itemId === itemId && typeof row.label === 'string' && row.label.trim() !== ''
  );
  if (!trusted) throw new TypeError('ItemID is absent from the verified visible Collection scope.');

  return withExclusiveMoodboardCommit(storage, latest => {
    // The latest document is read only inside the exclusive same-origin writer
    // coordination. If any cooperating tab has created a Board, deny; do not
    // interpret a stale Collection view as permission to overwrite it.
    if (latest.boards.length !== 0)
      throw new RangeError('A Moodboard now exists. Select it before saving.');
    const created = createMoodboard(latest, {title: name});
    const next = addMoodboardReference(created.document, created.board.id, {
      type: 'ITEM', entityId: String(itemId), label: trusted.label,
      note: typeof familyLabel === 'string' ? familyLabel : ''
    }).document;
    return {document: next, boardId: created.board.id, entityId: String(itemId)};
  },options);
}
