export const HOME_STAGE1_CONSUMER = Object.freeze({
  coreProducts: Object.freeze([
    { id: 'decorate', href: '/decorate/', icon: 'palette' },
    { id: 'collection', href: '/collection/', icon: 'collection' },
    { id: 'guide', href: '/guide/', icon: 'book' },
    { id: 'presets', href: '/presets/', icon: 'preset' },
    { id: 'gallery', href: '/gallery/', icon: 'gallery' },
    { id: 'dreamsnaps', href: '/dreamsnaps/', icon: 'camera' }
  ]),
  qa: Object.freeze({ id: 'qa', href: '/qa/', icon: 'qa', variant: 'horizontal' })
});

export const COLLECTION_STAGE1_CONSUMER = Object.freeze({
  personalStateControl: Object.freeze(['all', 'owned', 'missing']),
  activeFilterPresentation: 'removable-chip',
  filterPresentation: Object.freeze({ desktop: 'end', mobile: 'bottom' }),
  collectionInfoPresentation: Object.freeze({ desktop: 'end', mobile: 'full' }),
  mobileBulkActionPattern: 'sticky-action-bar'
});

export const DECORATE_STAGE1_CONSUMER = Object.freeze({
  entryCards: Object.freeze([
    { id: 'explore', href: '/explore/', icon: 'search', descriptionKey: 'exploreDescription' },
    { id: 'moodboards', href: '/moodboards/', icon: 'gallery', descriptionKey: 'moodboardsDescription' },
    { id: 'worldEditor', href: '/editor/world/', icon: 'sparkle', descriptionKey: 'worldEditorDescription' }
  ]),
  moodboardOrganization: Object.freeze({
    pointerAndTouchDrag: true,
    equivalentNonDragActionsRequired: true
  }),
  worldEditorCommonActionPattern: 'controlled-icon-with-accessible-name'
});
