import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOODBOARD_SCHEMA,
  addMoodboardReference,
  createEmptyMoodboardDocument,
  createMoodboard,
  deleteMoodboard,
  normalizeMoodboardDocument,
  parseMoodboardDocument,
  removeMoodboardReference,
  serializeMoodboardDocument,
  updateMoodboard
} from '../src/lib/moodboards/store.js';

const t0 = '2026-10-04T00:00:00.000Z';
const ids = (...values) => { let index = 0; return () => values[index++]; };

test('Moodboard local document supports create, edit and reference lifecycle without server state', () => {
  let doc = createEmptyMoodboardDocument(t0);
  const created = createMoodboard(doc, { title: 'Plaza ideas', description: 'Autumn' }, { now: t0, idFactory: ids('board-a') });
  doc = created.document;
  assert.equal(doc.schema, MOODBOARD_SCHEMA);
  assert.equal(doc.boards.length, 1);
  assert.equal(created.board.title, 'Plaza ideas');

  doc = updateMoodboard(doc, created.board.id, { title: 'Plaza at night' }, { now: '2026-10-04T01:00:00Z' });
  assert.equal(doc.boards[0].title, 'Plaza at night');

  const added = addMoodboardReference(doc, created.board.id, {
    type: 'WAND_PRESET', label: 'Lantern corner', entityId: 'preset_123', url: 'https://dreamwishwand.com/presets/123'
  }, { now: '2026-10-04T02:00:00Z', idFactory: ids('ref-a') });
  doc = added.document;
  assert.equal(doc.boards[0].references.length, 1);
  assert.equal(doc.boards[0].references[0].entityId, 'preset_123');

  doc = removeMoodboardReference(doc, created.board.id, added.reference.id, { now: '2026-10-04T03:00:00Z' });
  assert.equal(doc.boards[0].references.length, 0);

  doc = deleteMoodboard(doc, created.board.id, { now: '2026-10-04T04:00:00Z' });
  assert.equal(doc.boards.length, 0);
});

test('Moodboard backup serialization round-trips through strict versioned schema', () => {
  const first = createMoodboard(createEmptyMoodboardDocument(t0), { title: 'Forest' }, { now: t0, idFactory: ids('forest') }).document;
  const serialized = serializeMoodboardDocument(first);
  const restored = parseMoodboardDocument(serialized, t0);
  assert.deepEqual(restored, normalizeMoodboardDocument(first, t0));
  assert.throws(() => parseMoodboardDocument('{"schema":"wand.moodboards.local@99","boards":[]}'), /Unsupported Moodboard schema/);
  assert.throws(() => parseMoodboardDocument('not-json'), /not valid JSON/);
});

test('Moodboard reference URLs fail closed for unsupported schemes', () => {
  const created = createMoodboard(createEmptyMoodboardDocument(t0), { title: 'Safe links' }, { now: t0, idFactory: ids('safe') });
  const added = addMoodboardReference(created.document, created.board.id, {
    type: 'URL', label: 'unsafe', url: 'javascript:alert(1)'
  }, { now: t0, idFactory: ids('unsafe') });
  assert.equal(added.reference.url, null);
});
