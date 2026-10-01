type AnyRecord = Record<string, any>;

export type WepBlockerExplanation = {
  code: string;
  title: string;
  message: string;
  action: string | null;
};

const MESSAGES: Record<
  string,
  Omit<WepBlockerExplanation, 'code'>
> = Object.freeze({
  WEP_WORLD_PROFILE_SCHEMA_UNSUPPORTED: {
    title: 'Unsupported DDV save version',
    message:
      'This save is outside the currently verified DDV v1.25.0 / schema 624 World Editor contract.',
    action:
      'Use a supported save or wait for the matching Core compatibility contract.'
  },
  FULL_DESIGN_DESTINATION_PLATFORM_CONTRACT_UNAVAILABLE: {
    title: 'Destination platform contract unavailable',
    message:
      'The selected destination platform is not covered by the current full-design destination contract.',
    action:
      'Use a currently supported destination platform.'
  },
  DIRECT_GRID_ROUTE_UNRESOLVED: {
    title: 'Grid route unresolved',
    message:
      'Wand cannot resolve an exact portable GridDataPath route for this operation.',
    action:
      'Choose a route with authoritative GridDataPath identity.'
  },
  ROOT_GRID_BOUNDS_UNRESOLVED: {
    title: 'Grid bounds unavailable',
    message:
      'Authoritative GridData dimensions are unavailable for this root.',
    action:
      'Keep the draft read-only for bounds-dependent operations.'
  },
  AUTHORITATIVE_GRIDDATAPATH_BOUNDS_NOT_BOUND: {
    title: 'Grid bounds unavailable',
    message:
      'Authoritative GridDataPath dimensions are not bound for this destination root.',
    action:
      'Do not apply placement until the destination bounds contract is available.'
  },
  GRID_BOUNDS_EXCEEDED: {
    title: 'Outside Grid bounds',
    message:
      'The draft extends beyond authoritative GridData bounds.',
    action:
      'Move the selection back inside the valid Grid extent.'
  },
  NATIVE_EXACT_BUILD_UNVERIFIED: {
    title: 'Exact DDV build unverified',
    message:
      'The save identifies the supported schema, but it does not prove the exact DDV executable Build ID. The local draft may continue, but native placement is not promoted to verified.',
    action:
      'Treat this as a draft-only result; persistent Apply remains unavailable.'
  },
  NATIVE_PLACEMENT_INVALID: {
    title: 'Native placement rejected',
    message:
      'The promoted DDV native placement classifier rejects this draft position.',
    action:
      'Move or rotate the affected object and run validation again.'
  },
  NATIVE_PLACEMENT_UNVERIFIED: {
    title: 'Native placement unverified',
    message:
      'Native placement could not be verified for this object, geometry, occupancy, or conflict state.',
    action:
      'Do not treat UNKNOWN as VALID. Adjust the draft or wait for the missing Core evidence.'
  },
  NATIVE_REPLACEMENT_OR_REMOVAL_POLICY_REQUIRED: {
    title: 'Replacement/removal policy unresolved',
    message:
      'DDV placement may require replacing or removing an existing object, but Wand does not yet have complete safe CanBeCleared/replacement policy coverage.',
    action:
      'Keep the operation draft-only and avoid persistent mutation.'
  },
  FULL_DESIGN_DESTINATION_NATIVE_REPLACEMENT_POLICY_REQUIRED: {
    title: 'Replacement/removal policy unresolved',
    message:
      'Destination placement is native-valid only through replacement/removal behavior whose persistent policy is not closed.',
    action:
      'Do not Apply until Core closes the replacement/removal policy contract.'
  },
  FULL_DESIGN_DESTINATION_NATIVE_PLACEMENT_INVALID: {
    title: 'Destination placement invalid',
    message:
      'At least one destination object placement is rejected by native placement legality.',
    action:
      'Review the affected object and destination placement.'
  },
  FULL_DESIGN_DESTINATION_NATIVE_PLACEMENT_UNVERIFIED: {
    title: 'Destination placement unverified',
    message:
      'At least one destination object remains NATIVE_UNKNOWN_UNVERIFIED.',
    action:
      'Do not promote the destination to Apply-ready.'
  },
  GEOMETRY_UNRESOLVED: {
    title: 'Object geometry unresolved',
    message:
      'The object footprint or geometry required for safe placement validation is unresolved.',
    action:
      'Keep this object read-only for geometry-dependent draft operations.'
  },
  GEOMETRY_ADAPTER_REQUIRED: {
    title: 'Rotation geometry unavailable',
    message:
      'The current Core geometry adapter is not bound for this rotation.',
    action:
      'Leave the object unchanged.'
  },
  SELECTION_GEOMETRY_ADAPTER_REQUIRED: {
    title: 'Multi-selection rotation unavailable',
    message:
      'The current Core contract cannot resolve the requested multi-selection rotation.',
    action:
      'Leave the selection unchanged.'
  },
  CUSTOM_SELECTION_PIVOT_UNSUPPORTED: {
    title: 'Custom pivot unsupported',
    message:
      'The current Core rotation contract does not support a custom selection pivot.',
    action:
      'Use the supported selection rotation behavior.'
  },
  WEP_EDITOR_DRAFT_OPERATION_UNSUPPORTED: {
    title: 'Draft operation unsupported',
    message:
      'This command is outside the current v1.25 World Editor authoring contract.',
    action:
      'Use one of the currently supported draft commands.'
  },
  BUILDING_DESTINATION_SEMANTICS_UNRESOLVED: {
    title: 'Building semantics pending',
    message:
      'Building, Building Skin, or PlayerHouse destination behavior is still provisional while 01B Core resolves the native semantics.',
    action:
      'Keep Building-containing designs fail-closed until the 01B contract is promoted.'
  },
  TOPOLOGY_CLIPPED_UNSUPPORTED: {
    title: 'Road/Fence topology crosses the capture boundary',
    message:
      'The selected Capture Region would cut through a native Road/Fence component.',
    action:
      'Expand the Capture Region so the entire connected component is contained.'
  },
  ROADFENCE_NATIVE_READER_NOT_SUPPORTED: {
    title: 'Road/Fence model unavailable',
    message:
      'The current root cannot be represented through the promoted Road/Fence logical reader.',
    action:
      'Keep Road/Fence authoring read-only for this root.'
  },
  WEP_ROADFENCE_DRAFT_LATTICE_UNRESOLVED: {
    title: 'Road/Fence lattice unresolved',
    message:
      'Wand cannot prove the native logical-to-save coordinate lattice for this Road/Fence family in the current root.',
    action:
      'Start from an existing network of the same family or keep new topology creation blocked.'
  },
  WEP_FENCE_REPRESENTATION_LAYOUT_PRESET_NOT_BOUND: {
    title: 'Portable Fence post layout unresolved',
    message:
      'Wand could not bind exactly one Core-valid representation layout to the captured artifact-local Fence topology.',
    action:
      'Keep the capture fail-closed; restore a valid representation model or undo the topology change.'
  },
  FENCE_POST_SEMANTIC_ANCHOR_IMMUTABLE: {
    title: 'Semantic Fence anchor cannot move',
    message:
      'Endpoint, corner, junction, and mode-boundary anchors are topology semantics, not representation-only posts.',
    action:
      'Use a topology operation instead of a post-layout operation.'
  },
  FENCE_POST_INTERVAL_OVER_MAX: {
    title: 'Fence post interval too large',
    message:
      'The requested post spacing exceeds the family/mode interval supported by the versioned Core catalog.',
    action:
      'Insert or move a post to produce a supported interval.'
  },
  FENCE_POST_INTERVAL_UNSUPPORTED: {
    title: 'Fence post interval unsupported',
    message:
      'The requested interval is not present in the exact Core extension vocabulary for this Fence family and mode.',
    action:
      'Choose spacing that the current family/mode catalog can represent.'
  },
  FENCE_POST_OFF_RUN: {
    title: 'Fence post is off its semantic run',
    message:
      'Representation-only posts must remain on the same straight semantic run.',
    action:
      'Move the post within its current run or use a topology edit.'
  },
  FENCE_POST_LAYOUT_TOPOLOGY_CHANGED: {
    title: 'Fence topology changed',
    message:
      'The previous representation layout no longer matches the logical Fence topology.',
    action:
      'Regenerate and preflight representation layout.'
  },
  FENCE_POST_LAYOUT_QUANTITY_CHANGED: {
    title: 'Fence logical quantity changed',
    message:
      'A representation-only operation cannot change logical Fence quantity.',
    action:
      'Use a topology operation and then regenerate representation layout.'
  },
  FULL_DESIGN_ROOT_OBJECT_COMPOSITION_UNRESOLVED: {
    title: 'Placed-object composition unresolved',
    message:
      'One or more direct-root objects are not portable under the current Core contract.',
    action:
      'Review the unresolved root objects before publication or reuse.'
  },
  FULL_DESIGN_ROOT_OBJECT_ROUTE_DOCUMENTS_MISSING: {
    title: 'Direct-root document missing',
    message:
      'One or more direct-root EditorDocuments could not be bound into the full-design artifact.',
    action:
      'Load all authoritative direct roots before treating the design as complete.'
  },
  FULL_DESIGN_ROADFENCE_CAPTURE_REGION_BOUNDS_UNAVAILABLE: {
    title: 'Road/Fence capture bounds unavailable',
    message:
      'The logical reader is available, but authoritative full-root bounds are missing.',
    action:
      'Keep full-root Road/Fence capture blocked.'
  },
  FULL_DESIGN_DESTINATION_ROADFENCE_CAPTURE_MISSING: {
    title: 'Road/Fence destination capture missing',
    message:
      'The full-design artifact does not contain the required portable Road/Fence network capture for destination preflight.',
    action:
      'Rebuild the source artifact from all required direct roots.'
  },
  FULL_DESIGN_DESTINATION_ROADFENCE_ROUTE_UNRESOLVED: {
    title: 'Road/Fence destination route unresolved',
    message:
      'A portable Road/Fence capture could not be rebound to its destination-local direct Grid.',
    action:
      'Keep destination reuse blocked for this root.'
  },
  FULL_DESIGN_DESTINATION_ROADFENCE_BOUNDS_UNAVAILABLE: {
    title: 'Road/Fence destination bounds unavailable',
    message:
      'Authoritative GridData bounds evidence is unavailable for the destination Road/Fence root.',
    action:
      'Keep Road/Fence destination reuse blocked until authoritative bounds are available.'
  },
  FULL_DESIGN_DESTINATION_ROADFENCE_TESSELLATION_MISMATCH: {
    title: 'Road/Fence destination Grid mismatch',
    message:
      'The resolved destination Grid tessellation does not match the authoritative portable root contract.',
    action:
      'Do not reinterpret or rescale the Road/Fence artifact; keep the destination blocked.'
  },
  FULL_DESIGN_BUILDING_SOURCE_RECOGNITION_INCOMPLETE: {
    title: 'Building recognition incomplete',
    message:
      'One or more Building-related source states are not safely recognized.',
    action:
      'Keep the Building category provisional and blocked.'
  },
  FULL_DESIGN_BUILDING_RESTORATION_CAPTURE_UNRESOLVED: {
    title: 'Building restoration state unresolved',
    message:
      'A Building Skin or PlayerHouse restoration state could not be captured safely.',
    action:
      'Do not publish or reuse the full design as complete.'
  },
  FULL_DESIGN_REQUIRED_CATEGORY_EXCLUDED: {
    title: 'Required design category excluded',
    message:
      'A required full-design category was excluded, so the artifact is not complete.',
    action:
      'Include every required category or keep the design incomplete.'
  },
  FULL_DESIGN_COMMUNITY_PUBLICATION_ADAPTER_NOT_BOUND: {
    title: 'Full-design publication adapter unavailable',
    message:
      'The source artifact candidate is complete, but Community publication for this full-design type is not yet connected.',
    action:
      'Keep publicationReady=false until the Community adapter is bound.'
  },
  CORE_COMMIT_ADAPTER_NOT_BOUND: {
    title: 'DDV Apply unavailable',
    message:
      'The WEP preflight path is available, but no authorized Core persistent commit adapter is bound.',
    action:
      'Review the preflight only; do not write the DDV save.'
  },
  NO_PERSISTENT_WRITER_BOUND: {
    title: 'Persistent writer unavailable',
    message:
      'No authorized persistent DDV save writer is bound to this World Editor session.',
    action:
      'Export/review the draft only; do not replace the source save.'
  },
  CORE_ATOMIC_PERSISTENT_COMMIT_NOT_AUTHORIZED: {
    title: 'Atomic persistent commit unavailable',
    message:
      'The current Core contract does not authorize atomic persistent world commit.',
    action:
      'Stop after preview and preflight.'
  }
});

function fallbackMessage(code: string) {
  const readable = code
    .replace(/^WEP_/, '')
    .replace(/^FULL_DESIGN_/, '')
    .replace(/_/g, ' ')
    .toLocaleLowerCase();
  return {
    title: 'Operation blocked',
    message: readable
      ? `Wand reported an unresolved contract condition: ${readable}.`
      : 'Wand reported an unresolved contract condition.',
    action: 'Keep the operation fail-closed and review the detailed code.'
  };
}

export function explainWepBlocker(
  codeInput: unknown,
  _detail: AnyRecord | null = null
): WepBlockerExplanation {
  const code = String(codeInput ?? 'WEP_UNKNOWN_BLOCKER');
  const known = MESSAGES[code] ?? fallbackMessage(code);
  return Object.freeze({
    code,
    title: known.title,
    message: known.message,
    action: known.action
  });
}

export function explainFirstWepBlocker(
  issues: AnyRecord[] | null | undefined
) {
  const issue = (issues ?? []).find(
    (entry) => entry?.severity === 'BLOCK'
  );
  return issue
    ? explainWepBlocker(issue.code, issue.detail ?? issue)
    : null;
}
