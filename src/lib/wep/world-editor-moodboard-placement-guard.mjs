import {
  MOODBOARD_SCHEMA,
  MOODBOARD_VERSION,
  MOODBOARD_STORAGE_KEY,
  parseMoodboardDocument
} from '../moodboards/store.js';

// Local draft placement only. Never creates a Save writer, copies item media,
// accepts a user-supplied ItemID as provenance, or updates the Moodboard store.
/**
 * @param {any} storage
 * @param {{boardId:string,referenceId:string|null,groupId:string|null,itemId:number|null}} pending
 * @param {Map<number,any>} verifiedItemById
 */
export function verifyCurrentMoodboardItemPlacement(
  storage,
  { boardId, referenceId, groupId = null, itemId },
  verifiedItemById
) {
  const stale = (reason) => {
    throw new Error('WEP_MOODBOARD_STALE_REFERENCE_' + reason);
  };
  if (typeof boardId !== 'string' || !boardId ||
      typeof referenceId !== 'string' || !referenceId ||
      !Number.isSafeInteger(itemId) || itemId <= 0) stale('IDENTITY');
  if (!(verifiedItemById instanceof Map)) stale('ITEM_SCOPE');
  const verifiedItem = verifiedItemById.get(itemId);
  if (!verifiedItem ||
      Number(verifiedItem.itemId) !== itemId ||
      typeof verifiedItem.label !== 'string' ||
      !verifiedItem.label.trim()) stale('ITEM_NOT_VERIFIED');
  if (!storage || typeof storage.getItem !== 'function') stale('STORAGE_UNAVAILABLE');
  let stored;
  try {
    stored = storage.getItem(MOODBOARD_STORAGE_KEY);
  } catch {
    stale('STORAGE_UNAVAILABLE');
  }
  if (typeof stored !== 'string' || !stored) stale('DOCUMENT_MISSING');

  // The general Moodboard normalizer is deliberately migration-tolerant.
  // Placement may NOT infer authorizations from an unknown local version.
  let source;
  try {
    source = JSON.parse(stored);
  } catch {
    stale('DOCUMENT_INVALID');
  }
  if (source?.schema !== MOODBOARD_SCHEMA ||
      source?.version !== MOODBOARD_VERSION) stale('DOCUMENT_VERSION');

  let document;
  try {
    document = parseMoodboardDocument(stored);
  } catch {
    stale('DOCUMENT_INVALID');
  }
  const board = document.boards.find(entry => entry.id === boardId);
  if (!board) stale('BOARD_MISSING');
  const reference = board.references.find(entry => entry.id === referenceId);
  if (!reference || reference.type !== 'ITEM' ||
      reference.entityId !== String(itemId)) stale('ITEM_RETARGETED');

  const assignedGroups = reference.groupIds;
  if (groupId === null) {
    // Unsorted is a concrete section: newly grouped Items cannot retain an
    // old Unsorted placement intent.
    if (assignedGroups.length !== 0) stale('GROUP_CHANGED');
  } else if (typeof groupId !== 'string' || !groupId ||
             !board.groups.some(group => group.id === groupId) ||
             !assignedGroups.includes(groupId)) {
    stale('GROUP_CHANGED');
  }

  return { board, reference, verifiedItem, persistentWriteAuthorized: false };
}

/**
 * @param {any} session
 * @param {any} editorDocument
 * @param {{selectedSession?:any,selectedTarget?:string|null}} options
 */
export function verifyCurrentMoodboardEditorSession(
  session,
  editorDocument,
  { selectedSession = null, selectedTarget = null } = {}
) {
  if (!session || !editorDocument ||
      typeof session.getDocument !== 'function') {
    throw new Error('WEP_MOODBOARD_STALE_EDITOR_SESSION');
  }
  const source = session.getDocument();
  if (!source || !source.target || !editorDocument.target ||
      JSON.stringify(source.target) !== JSON.stringify(editorDocument.target) ||
      (selectedSession !== null && selectedSession !== session) ||
      (selectedTarget !== null &&
        selectedTarget !== JSON.stringify(editorDocument.target))) {
    throw new Error('WEP_MOODBOARD_STALE_EDITOR_TARGET');
  }
  return true;
}
