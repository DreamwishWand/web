import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOODBOARD_SCHEMA,
  addMoodboardReference,
  createEmptyMoodboardDocument,
  createMoodboard,
  createMoodboardGroup,
  assignMoodboardReferenceGroups,
  deleteMoodboard,
  deleteMoodboardGroup,
  moodboardSections,
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

test('Moodboard Groups are many-to-many views over canonical references and legacy duplicates collapse safely', () => {
  let doc = createMoodboard(createEmptyMoodboardDocument(t0), { title: 'Grouped' }, { now: t0, idFactory: ids('grouped') }).document;
  const boardId = doc.boards[0].id;
  let result = createMoodboardGroup(doc, boardId, 'Entrance', { now: t0, idFactory: ids('entrance') });
  doc = result.document;
  const entrance = result.group.id;
  result = createMoodboardGroup(doc, boardId, 'Night', { now: t0, idFactory: ids('night') });
  doc = result.document;
  const night = result.group.id;

  const added = addMoodboardReference(doc, boardId, {
    type: 'ITEM',
    label: 'Lamp',
    entityId: '40000001'
  }, { now: t0, idFactory: ids('lamp') });
  doc = assignMoodboardReferenceGroups(
    added.document,
    boardId,
    added.reference.id,
    [entrance, night],
    { now: t0 }
  );

  const sections = moodboardSections(doc.boards[0]);
  assert.equal(sections.find(section => section.id === entrance).references.length, 1);
  assert.equal(sections.find(section => section.id === night).references.length, 1);
  assert.equal(doc.boards[0].references.length, 1, 'Group membership duplicated canonical Item record');

  doc = deleteMoodboardGroup(doc, boardId, entrance, { now: t0 });
  assert.equal(doc.boards[0].references.length, 1, 'Deleting one Group deleted shared reference');
  assert.deepEqual(doc.boards[0].references[0].groupIds, [night]);

  const legacy = structuredClone(doc);
  legacy.boards[0].references.push({
    ...legacy.boards[0].references[0],
    id: 'legacy-duplicate',
    groupIds: []
  });
  const migrated = normalizeMoodboardDocument(legacy, t0);
  assert.equal(migrated.boards[0].references.length, 1);
  assert.equal(migrated.boards[0].references[0].entityId, '40000001');
});

test('Moodboard placement-source reads do not mutate planning membership or acquisition-adjacent state', () => {
  let doc = createMoodboard(createEmptyMoodboardDocument(t0), { title: 'Invariant' }, { now: t0, idFactory: ids('invariant') }).document;
  const boardId = doc.boards[0].id;
  const before = addMoodboardReference(doc, boardId, {
    type: 'ITEM',
    label: 'Chair',
    entityId: '40000123'
  }, { now: t0, idFactory: ids('chair') }).document;
  const snapshot = structuredClone(before);
  const sections = moodboardSections(before.boards[0]);
  assert.equal(sections.at(-1).references[0].entityId, '40000123');
  assert.deepEqual(before, snapshot, 'Browsing Moodboard sections mutated stored planning state');
  assert.equal('owned' in before.boards[0].references[0], false);
  assert.equal('favorite' in before.boards[0].references[0], false);
  assert.equal('hidden' in before.boards[0].references[0], false);
});
