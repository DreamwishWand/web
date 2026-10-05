export const MOODBOARD_SCHEMA = 'wand.moodboards.local@1';
export const MOODBOARD_VERSION = 2;
export const MOODBOARD_STORAGE_KEY = 'dreamwishwand:moodboards:v1';
export const MOODBOARD_BACKUP_KEY = 'dreamwishwand:moodboards:v1:backup';
export const MOODBOARD_MAX_BOARDS = 100;
export const MOODBOARD_MAX_REFERENCES = 500;
export const MOODBOARD_MAX_GROUPS = 100;
export const MOODBOARD_REFERENCE_TYPES = Object.freeze(['ITEM', 'WAND_PRESET', 'NOTE']);
const LEGACY_REFERENCE_TYPES = Object.freeze(['GALLERY_WORK', 'URL']);

function cleanText(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanOptional(value, max = 4000) {
  const text = cleanText(value, max);
  return text || null;
}

function normalizeDate(value, fallback) {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function makeId(prefix, idFactory) {
  const supplied = typeof idFactory === 'function' ? idFactory() : null;
  if (supplied) return `${prefix}_${String(supplied).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function normalizeUrl(value) {
  const raw = cleanOptional(value, 2000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeGroup(group, index) {
  return {
    id: cleanText(group?.id, 120) || makeId('group'),
    title: cleanText(group?.title, 120) || 'Untitled Group',
    order: Number.isSafeInteger(Number(group?.order)) ? Number(group.order) : index,
    collapsed: group?.collapsed === true
  };
}

function normalizeReference(reference, now, validGroupIds) {
  const rawType = String(reference?.type ?? '');
  const type = MOODBOARD_REFERENCE_TYPES.includes(rawType)
    ? rawType
    : LEGACY_REFERENCE_TYPES.includes(rawType)
      ? rawType
      : 'NOTE';
  const label = cleanText(reference?.label, 160) || (type === 'NOTE' ? 'Note' : type.replaceAll('_', ' '));
  const groupIds = Array.from(
    new Set(
      (Array.isArray(reference?.groupIds) ? reference.groupIds : [])
        .map((value) => cleanText(value, 120))
        .filter((value) => value && validGroupIds.has(value))
    )
  );
  return {
    id: cleanText(reference?.id, 120) || makeId('ref'),
    type,
    label,
    url: type === 'URL' ? normalizeUrl(reference?.url) : null,
    entityId: cleanOptional(reference?.entityId, 180),
    note: cleanOptional(reference?.note, 2000),
    groupIds,
    createdAt: normalizeDate(reference?.createdAt, now)
  };
}

function normalizeBoard(board, now) {
  const rawGroups = Array.isArray(board?.groups) ? board.groups.slice(0, MOODBOARD_MAX_GROUPS) : [];
  const groups = rawGroups.map(normalizeGroup);
  const groupIds = new Set();
  for (const group of groups) {
    if (groupIds.has(group.id)) throw new TypeError(`Duplicate Moodboard Group id: ${group.id}`);
    groupIds.add(group.id);
  }
  groups.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  groups.forEach((group, index) => { group.order = index; });

  const rawReferences = Array.isArray(board?.references)
    ? board.references.slice(0, MOODBOARD_MAX_REFERENCES).map((entry) => normalizeReference(entry, now, groupIds))
    : [];
  const references = [];
  const referenceIds = new Set();
  const canonicalEntityIndex = new Map();
  for (const reference of rawReferences) {
    if (referenceIds.has(reference.id)) continue;
    referenceIds.add(reference.id);
    if ((reference.type === 'ITEM' || reference.type === 'WAND_PRESET') && reference.entityId) {
      const key = `${reference.type}:${reference.entityId}`;
      const existingIndex = canonicalEntityIndex.get(key);
      if (existingIndex !== undefined) {
        references[existingIndex] = {
          ...references[existingIndex],
          groupIds: Array.from(
            new Set([
              ...references[existingIndex].groupIds,
              ...reference.groupIds
            ])
          )
        };
        continue;
      }
      canonicalEntityIndex.set(key, references.length);
    }
    references.push(reference);
  }
  const createdAt = normalizeDate(board?.createdAt, now);
  return {
    id: cleanText(board?.id, 120) || makeId('board'),
    title: cleanText(board?.title, 120) || 'Untitled Moodboard',
    description: cleanOptional(board?.description, 1000),
    createdAt,
    updatedAt: normalizeDate(board?.updatedAt, createdAt),
    groups,
    references
  };
}

export function createEmptyMoodboardDocument(now = new Date().toISOString()) {
  const stamp = normalizeDate(now, new Date().toISOString());
  return { schema: MOODBOARD_SCHEMA, version: MOODBOARD_VERSION, updatedAt: stamp, boards: [] };
}

export function normalizeMoodboardDocument(input, now = new Date().toISOString()) {
  if (!input || typeof input !== 'object') throw new TypeError('Moodboard document must be an object.');
  if (input.schema !== MOODBOARD_SCHEMA) throw new TypeError(`Unsupported Moodboard schema: ${String(input.schema ?? 'missing')}`);
  const stamp = normalizeDate(now, new Date().toISOString());
  const boards = Array.isArray(input.boards)
    ? input.boards.slice(0, MOODBOARD_MAX_BOARDS).map((board) => normalizeBoard(board, stamp))
    : [];
  const ids = new Set();
  for (const board of boards) {
    if (ids.has(board.id)) throw new TypeError(`Duplicate Moodboard id: ${board.id}`);
    ids.add(board.id);
  }
  return { schema: MOODBOARD_SCHEMA, version: MOODBOARD_VERSION, updatedAt: normalizeDate(input.updatedAt, stamp), boards };
}

export function parseMoodboardDocument(text, now = new Date().toISOString()) {
  let parsed;
  try { parsed = JSON.parse(String(text)); }
  catch { throw new TypeError('Moodboard backup is not valid JSON.'); }
  return normalizeMoodboardDocument(parsed, now);
}

export function serializeMoodboardDocument(document) {
  return JSON.stringify(normalizeMoodboardDocument(document), null, 2) + '\n';
}

function touch(document, boards, now) {
  const stamp = normalizeDate(now, new Date().toISOString());
  return { ...document, schema: MOODBOARD_SCHEMA, version: MOODBOARD_VERSION, updatedAt: stamp, boards };
}

export function createMoodboard(document, input = {}, { now = new Date().toISOString(), idFactory } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  if (current.boards.length >= MOODBOARD_MAX_BOARDS) throw new RangeError(`Moodboard limit reached (${MOODBOARD_MAX_BOARDS}).`);
  const stamp = normalizeDate(now, new Date().toISOString());
  const board = {
    id: makeId('board', idFactory),
    title: cleanText(input.title, 120) || 'Untitled Moodboard',
    description: cleanOptional(input.description, 1000),
    createdAt: stamp,
    updatedAt: stamp,
    groups: [],
    references: []
  };
  return { document: touch(current, [...current.boards, board], stamp), board };
}

export function updateMoodboard(document, boardId, patch = {}, { now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let found = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    found = true;
    return {
      ...board,
      title: patch.title === undefined ? board.title : (cleanText(patch.title, 120) || 'Untitled Moodboard'),
      description: patch.description === undefined ? board.description : cleanOptional(patch.description, 1000),
      updatedAt: stamp
    };
  });
  if (!found) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  return touch(current, boards, stamp);
}

export function deleteMoodboard(document, boardId, { now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const boards = current.boards.filter((board) => board.id !== boardId);
  if (boards.length === current.boards.length) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  return touch(current, boards, now);
}

export function createMoodboardGroup(document, boardId, title, { now = new Date().toISOString(), idFactory } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let group = null;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    if (board.groups.length >= MOODBOARD_MAX_GROUPS) throw new RangeError(`Moodboard Group limit reached (${MOODBOARD_MAX_GROUPS}).`);
    group = {
      id: makeId('group', idFactory),
      title: cleanText(title, 120) || 'Untitled Group',
      order: board.groups.length,
      collapsed: false
    };
    return { ...board, groups: [...board.groups, group], updatedAt: stamp };
  });
  if (!group) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  return { document: touch(current, boards, stamp), group };
}

export function updateMoodboardGroup(document, boardId, groupId, patch = {}, { now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let found = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    const groups = board.groups.map((group) => {
      if (group.id !== groupId) return group;
      found = true;
      return {
        ...group,
        title: patch.title === undefined ? group.title : (cleanText(patch.title, 120) || 'Untitled Group'),
        collapsed: patch.collapsed === undefined ? group.collapsed : patch.collapsed === true
      };
    });
    return found ? { ...board, groups, updatedAt: stamp } : board;
  });
  if (!found) throw new RangeError(`Unknown Moodboard Group: ${groupId}`);
  return touch(current, boards, stamp);
}

export function reorderMoodboardGroups(document, boardId, orderedGroupIds, { now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let found = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    found = true;
    const ids = Array.from(new Set((orderedGroupIds ?? []).map(String)));
    if (ids.length !== board.groups.length || ids.some((id) => !board.groups.some((group) => group.id === id))) {
      throw new TypeError('Moodboard Group reorder must include each Group exactly once.');
    }
    const byId = new Map(board.groups.map((group) => [group.id, group]));
    return {
      ...board,
      groups: ids.map((id, order) => ({ ...byId.get(id), order })),
      updatedAt: stamp
    };
  });
  if (!found) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  return touch(current, boards, stamp);
}

export function assignMoodboardReferenceGroups(document, boardId, referenceId, groupIds, { now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let foundBoard = false;
  let foundReference = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    foundBoard = true;
    const valid = new Set(board.groups.map((group) => group.id));
    const nextIds = Array.from(new Set((groupIds ?? []).map(String)));
    if (nextIds.some((id) => !valid.has(id))) throw new RangeError('Unknown Moodboard Group assignment.');
    const references = board.references.map((reference) => {
      if (reference.id !== referenceId) return reference;
      foundReference = true;
      return { ...reference, groupIds: nextIds };
    });
    return foundReference ? { ...board, references, updatedAt: stamp } : board;
  });
  if (!foundBoard) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  if (!foundReference) throw new RangeError(`Unknown Moodboard reference: ${referenceId}`);
  return touch(current, boards, stamp);
}

export function deleteMoodboardGroup(document, boardId, groupId, { deleteExclusiveContents = false, now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let found = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    if (!board.groups.some((group) => group.id === groupId)) return board;
    found = true;
    const groups = board.groups.filter((group) => group.id !== groupId).map((group, order) => ({ ...group, order }));
    const references = board.references
      .filter((reference) => !deleteExclusiveContents || !(reference.groupIds.length === 1 && reference.groupIds[0] === groupId))
      .map((reference) => ({ ...reference, groupIds: reference.groupIds.filter((id) => id !== groupId) }));
    return { ...board, groups, references, updatedAt: stamp };
  });
  if (!found) throw new RangeError(`Unknown Moodboard Group: ${groupId}`);
  return touch(current, boards, stamp);
}

export function addMoodboardReference(document, boardId, input = {}, { now = new Date().toISOString(), idFactory } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let created = null;
  let found = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    found = true;
    const type = MOODBOARD_REFERENCE_TYPES.includes(input.type) ? input.type : 'NOTE';
    const entityId = cleanOptional(input.entityId, 180);
    if ((type === 'ITEM' || type === 'WAND_PRESET') && entityId) {
      const existing = board.references.find((reference) => reference.type === type && reference.entityId === entityId);
      if (existing) {
        created = existing;
        return board;
      }
    }
    if (board.references.length >= MOODBOARD_MAX_REFERENCES) throw new RangeError(`Reference limit reached (${MOODBOARD_MAX_REFERENCES}).`);
    const validGroups = new Set(board.groups.map((group) => group.id));
    const groupIds = Array.from(new Set((input.groupIds ?? []).map(String)));
    if (groupIds.some((id) => !validGroups.has(id))) throw new RangeError('Unknown Moodboard Group assignment.');
    created = normalizeReference({
      ...input,
      id: makeId('ref', idFactory),
      type,
      entityId,
      groupIds,
      createdAt: stamp
    }, stamp, validGroups);
    return { ...board, updatedAt: stamp, references: [...board.references, created] };
  });
  if (!found) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  return { document: touch(current, boards, stamp), reference: created };
}

export function removeMoodboardReference(document, boardId, referenceId, { now = new Date().toISOString() } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let foundBoard = false;
  let foundReference = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    foundBoard = true;
    const references = board.references.filter((reference) => reference.id !== referenceId);
    foundReference = references.length !== board.references.length;
    return foundReference ? { ...board, updatedAt: stamp, references } : board;
  });
  if (!foundBoard) throw new RangeError(`Unknown Moodboard: ${boardId}`);
  if (!foundReference) throw new RangeError(`Unknown Moodboard reference: ${referenceId}`);
  return touch(current, boards, stamp);
}

export function moodboardSections(board) {
  if (!board) return [];
  const sections = board.groups.map((group) => ({
    kind: 'GROUP',
    id: group.id,
    title: group.title,
    collapsed: group.collapsed,
    references: board.references.filter((reference) => reference.groupIds.includes(group.id))
  }));
  const unsorted = board.references.filter((reference) => reference.groupIds.length === 0);
  return [
    ...sections,
    {
      kind: 'UNSORTED',
      id: null,
      title: 'Unsorted',
      collapsed: false,
      references: unsorted
    }
  ];
}
