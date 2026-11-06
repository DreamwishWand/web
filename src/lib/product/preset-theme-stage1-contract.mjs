// 06 PRODUCT — owner-closed Presets Stage 1 semantics, not a published theme registry.
// SSoT: PRESET-UX-30, 43 (over 36), 51..61, 73 (over 72), 105, 106 (over 103).
// A CANDIDATE or a matching facet is never evidence of an authorized public Work,
// a current-version DDV icon, Creator rights, an accepted Save, or a Native writer.

export const PRESET_THEME_STAGE1_CONTRACT = 'wand.presets.theme.stage1-product@1';

export const PRESET_THEME_PICKER_GROUPS = Object.freeze([
  'Style & Aesthetic',
  'Era & Design',
  'Mood & Atmosphere',
  'Regional & Cultural',
  'Fantasy & Genre',
  'Nature & Landscape',
  'Place & Setting',
  'Venue & Function'
]);

export const PRESET_THEME_FACETS = Object.freeze([
  'season', 'seasonalEvent', 'decorationTheme', 'featuredWork'
]);

export const PRESET_THEME_LIFECYCLE = Object.freeze([
  'CANDIDATE', 'ACTIVE', 'DEPRECATED', 'MERGED'
]);

// This is a historical working normalization batch, NOT an ACTIVE/public registry.
export const PRESET_THEME_WORKING_BATCH = Object.freeze({
  highConfidenceCandidates: 148,
  aliasMergeCandidates: 31,
  heldCandidates: 48,
  publicActiveCount: null
});

export const PRESET_THEME_STAGE1_BOUNDARIES = Object.freeze({
  draftDefaultState: 'CANDIDATE',
  publicRegistryApproved: false,
  numericAssignmentCapApproved: false,
  typicalAssignmentCountApproved: false,
  featuredWorkRequiresCurrentDdvNativeIdentityAndIcon: true,
  featuredWorkMustBeAuthorSelected: true,
  automaticFeaturedWorkAssignmentFromItems: false,
  themeRequestAutomaticallyPublic: false,
  candidateAutomaticallyActive: false,
  createdOrPublishedByThisModule: false
});

export function isPresetThemePickerGroup(value) {
  return typeof value === 'string' && PRESET_THEME_PICKER_GROUPS.includes(value);
}

// A fail-closed PURE query predicate only; NEVER a public visibility/rights gate.
// Each facet is OR within itself and AND against other selected facet families.
// The caller must supply authoritative, source-verified canonical facet IDs.
export function matchesPresetThemeFacets(record, selected) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      !selected || typeof selected !== 'object' || Array.isArray(selected)) return false;
  if (Object.keys(selected).some(key => !PRESET_THEME_FACETS.includes(key))) return false;

  for (const facet of PRESET_THEME_FACETS) {
    const chosen = selected[facet];
    if (chosen === undefined) continue;
    if (!Array.isArray(chosen) || chosen.some(id => typeof id !== 'string' || id.length === 0)) return false;
    if (chosen.length === 0) continue;
    const values = record[facet];
    if (!Array.isArray(values) || values.some(id => typeof id !== 'string' || id.length === 0)) return false;
    if (!chosen.some(id => values.includes(id))) return false;
  }
  return true;
}
