export const QA_CONTEXT_TAGS = Object.freeze([
  { id: 'system:decorating', labelKey: 'qa.tag.decorating' },
  { id: 'system:world-editor', labelKey: 'qa.tag.worldEditor' },
  { id: 'system:presets', labelKey: 'qa.tag.presets' },
  { id: 'system:gallery', labelKey: 'qa.tag.gallery' },
  { id: 'system:dreamsnaps', labelKey: 'qa.tag.dreamsnaps' },
  { id: 'system:collection', labelKey: 'qa.tag.collection' },
  { id: 'system:quests', labelKey: 'qa.tag.quests' },
  { id: 'system:events', labelKey: 'qa.tag.events' }
] as const);

export type QaContextTagId = (typeof QA_CONTEXT_TAGS)[number]['id'];
