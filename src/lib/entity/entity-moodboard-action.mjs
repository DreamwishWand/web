import { addMoodboardReference } from '../moodboards/store.js';

// Local inspiration only. This action neither interprets a personal Save nor authorizes an item Writer.
export function addCatalogEntityToMoodboard(document, boardId, resolved, options) {
  if (resolved?.status !== 'FOUND' || resolved?.canExplore !== true ||
      resolved?.source?.platform !== 'Nintendo Switch' ||
      resolved?.source?.gameVersion !== '1.25.0' ||
      resolved?.source?.buildID !== '52BD625D9B4E0053' ||
      !Number.isSafeInteger(resolved?.item?.itemId) || resolved.item.itemId <= 0 ||
      typeof resolved.item.label !== 'string' || !resolved.item.label.trim()) {
    throw new TypeError('SHARED_ENTITY_MOODBOARD_SOURCE_NOT_VERIFIED');
  }
  if (typeof boardId !== 'string' || !boardId.trim()) throw new TypeError('MOODBOARD_SELECTION_REQUIRED');
  return addMoodboardReference(document, boardId, {
    type: 'ITEM',
    entityId: String(resolved.item.itemId),
    label: resolved.item.label,
    note: resolved.item.family
  }, options);
}
