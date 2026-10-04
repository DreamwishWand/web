export const MOODBOARD_SCHEMA = 'wand.moodboards.local@1';
export const MOODBOARD_STORAGE_KEY = 'dreamwishwand:moodboards:v1';
export const MOODBOARD_BACKUP_KEY = 'dreamwishwand:moodboards:v1:backup';
export const MOODBOARD_MAX_BOARDS = 100;
export const MOODBOARD_MAX_REFERENCES = 500;
export const MOODBOARD_REFERENCE_TYPES = Object.freeze(['ITEM', 'GALLERY_WORK', 'WAND_PRESET', 'URL', 'NOTE']);

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

function normalizeReference(reference, now) {
  const type = MOODBOARD_REFERENCE_TYPES.includes(reference?.type) ? reference.type : 'NOTE';
  const label = cleanText(reference?.label, 160) || (type === 'NOTE' ? 'Note' : type.replaceAll('_', ' '));
  return {
    id: cleanText(reference?.id, 120) || makeId('ref'),
    type,
    label,
    url: normalizeUrl(reference?.url),
    entityId: cleanOptional(reference?.entityId, 180),
    note: cleanOptional(reference?.note, 2000),
    createdAt: normalizeDate(reference?.createdAt, now)
  };
}

function normalizeBoard(board, now) {
  const references = Array.isArray(board?.references)
    ? board.references.slice(0, MOODBOARD_MAX_REFERENCES).map((entry) => normalizeReference(entry, now))
    : [];
  const createdAt = normalizeDate(board?.createdAt, now);
  return {
    id: cleanText(board?.id, 120) || makeId('board'),
    title: cleanText(board?.title, 120) || 'Untitled Moodboard',
    description: cleanOptional(board?.description, 1000),
    createdAt,
    updatedAt: normalizeDate(board?.updatedAt, createdAt),
    references
  };
}

export function createEmptyMoodboardDocument(now = new Date().toISOString()) {
  const stamp = normalizeDate(now, new Date().toISOString());
  return { schema: MOODBOARD_SCHEMA, version: 1, updatedAt: stamp, boards: [] };
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
  return { schema: MOODBOARD_SCHEMA, version: 1, updatedAt: normalizeDate(input.updatedAt, stamp), boards };
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
  return { ...document, schema: MOODBOARD_SCHEMA, version: 1, updatedAt: stamp, boards };
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

export function addMoodboardReference(document, boardId, input = {}, { now = new Date().toISOString(), idFactory } = {}) {
  const current = normalizeMoodboardDocument(document, now);
  const stamp = normalizeDate(now, new Date().toISOString());
  let created = null;
  let found = false;
  const boards = current.boards.map((board) => {
    if (board.id !== boardId) return board;
    found = true;
    if (board.references.length >= MOODBOARD_MAX_REFERENCES) throw new RangeError(`Reference limit reached (${MOODBOARD_MAX_REFERENCES}).`);
    const type = MOODBOARD_REFERENCE_TYPES.includes(input.type) ? input.type : 'NOTE';
    created = normalizeReference({ ...input, id: makeId('ref', idFactory), type, createdAt: stamp }, stamp);
    if (!created.label) throw new TypeError('Reference label is required.');
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
