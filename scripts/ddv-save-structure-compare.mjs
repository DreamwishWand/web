/**
 * 01E offline-only, value-free observed save shape comparison.
 * Inputs are already decoded DDV profile JSON. Never publish decoded sources.
 * Output is deliberately lossy: only allowlisted schema field names, JSON kinds,
 * and conditional observation statuses; no user values, IDs, amounts, coordinates,
 * timestamps, map keys, file paths, or hashes of user-specific data.
 * Not a save decoder, codec writer, eligibility oracle, or schema migration.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const OBSERVED_SHAPE_CONTRACT = 'ddv.01e.save-observed-shape-diff@1';

const BUILDS = Object.freeze({
  switch: Object.freeze({
    left: Object.freeze({ version: 624, build: '52BD625D9B4E0053' }),
    right: Object.freeze({ version: 626, build: '9A239D3DB569756D' })
  }),
  'steam-windows': Object.freeze({
    left: Object.freeze({ version: 624, build: 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14' }),
    right: Object.freeze({ version: 626, build: 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22' })
  })
});

const KEYS = new Set([
  'ListInventories', 'Inventory', 'CompatibleItemType', 'Data', 'Amount', 'Marker',
  'CollectionSets', 'CollectionDefinitionID', 'GroupData', 'GroupIndex', 'GroupsCollectionItems',
  'Grid', 'Grids', 'GridCollection', 'Objects', 'GridObjects', 'Areas', 'Area', 'AreaID', 'GridIDs',
  'SubGrid', 'SubGrids', 'FloatingIslands', 'PlayerHouses', 'NextGridObjectID', 'TessellationFactor',
  'State', 'Road', 'Roads', 'Fence', 'Fences', 'FenceMode', 'ID', 'ItemID', 'X', 'Y', 'Orientation',
  'SceneItemId', 'HouseData', 'PlayerHouseIndex'
]);

// These native dictionaries are keyed by user/item/object IDs. Even keys that happen
// to equal allowlisted schema field names must never be treated as fields.
const DYNAMIC_MAP_FIELDS = new Set(['Inventory', 'Objects', 'GridObjects', 'GroupsCollectionItems', 'Grids', 'FloatingIslands']);

const CATEGORIES = Object.freeze({
  'serialized-root': ['$.GameInfo', '$.Player', '$.World'],
  'ownership': ['ListInventories', 'Inventory', 'CompatibleItemType', 'Amount', 'Marker'],
  'collection': ['CollectionSets', 'CollectionDefinitionID', 'GroupData', 'GroupIndex', 'GroupsCollectionItems'],
  'world-grid': ['Grid', 'Grids', 'GridCollection', 'Objects', 'GridObjects', 'Areas', 'Area', 'AreaID', 'GridIDs', 'SubGrid', 'SubGrids', 'NextGridObjectID', 'TessellationFactor'],
  'road-fence': ['Road', 'Roads', 'Fence', 'Fences', 'FenceMode'],
  'world-object': ['ItemID', 'State', 'X', 'Y', 'Orientation'],
  'floating-island-playerhouse': ['FloatingIslands', 'PlayerHouses', 'HouseData', 'PlayerHouseIndex', 'SceneItemId']
});

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function kind(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  if (typeof v === 'number') return Number.isFinite(v) ? 'number' : 'invalid-number';
  return typeof v;
}

function asVersion(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

function assertValidProfile(v, expectedVersion) {
  if (!isObj(v) || !isObj(v.GameInfo) || !isObj(v.Player) || !isObj(v.World) ||
      asVersion(v.GameInfo.Version) !== expectedVersion) {
    throw new Error('PROFILE_IDENTITY_OR_ROOT_INVALID');
  }
}

/** Bounded traversal; ignores non-core roots and redacts ALL dynamic object keys. */
export function observeProfileShape(profile, { maxNodes = 400000, maxPaths = 1500, maxDepth = 24 } = {}) {
  if (!isObj(profile)) throw new Error('INVALID_ROOT');
  if (![maxNodes, maxPaths, maxDepth].every(x => Number.isSafeInteger(x) && x > 0)) {
    throw new Error('INVALID_BUDGET');
  }
  const paths = new Map();
  const stack = [
    { value: profile.GameInfo, path: '$.GameInfo', depth: 0 },
    { value: profile.Player, path: '$.Player', depth: 0 },
    { value: profile.World, path: '$.World', depth: 0 }
  ];
  let visited = 0;
  let truncated = false;
  const enqueue = (entry) => {
    if (visited + stack.length >= maxNodes) { truncated = true; return false; }
    stack.push(entry);
    return true;
  };
  const add = (path, value) => {
    const type = kind(value);
    if (!paths.has(path)) {
      if (paths.size >= maxPaths) { truncated = true; return; }
      paths.set(path, new Set());
    }
    paths.get(path).add(type);
  };
  while (stack.length) {
    if (visited >= maxNodes) { truncated = true; break; }
    const { value, path, depth } = stack.pop();
    visited++;
    if (depth > maxDepth) { truncated = true; continue; }
    if (path === '$.GameInfo') { add(path, value); continue; } // no save metadata values
    add(path, value);
    if (Array.isArray(value)) {
      for (const child of value) {
        if (!enqueue({ value: child, path: `${path}[]`, depth: depth + 1 })) break;
      }
    } else if (isObj(value)) {
      for (const [name, child] of Object.entries(value)) {
        // All unknown/dynamic map keys (including player names/IDs) collapse to '*'.
        // Only the canonical DDV schema allowlist can be emitted verbatim.
        const parentKey = path.slice(path.lastIndexOf('.') + 1);
        const safe = path === '$.World' && name === 'DecorationPresets' ? name
          : (!DYNAMIC_MAP_FIELDS.has(parentKey) && KEYS.has(name) ? name : '*');
        if (!enqueue({ value: child, path: `${path}.${safe}`, depth: depth + 1 })) break;
      }
    }
  }
  return {
    complete: !truncated,
    paths: [...paths.entries()].map(([path, types]) => ({ path, types: [...types].sort() }))
      .sort((a, b) => a.path.localeCompare(b.path, 'en'))
  };
}

function categorize(path) {
  if (path === '$.GameInfo' || path === '$.Player' || path === '$.World') return 'serialized-root';
  if (path.startsWith('$.Player.')) {
    if (CATEGORIES.collection.some(k => path.includes(`.${k}`))) return 'collection';
    if (CATEGORIES.ownership.some(k => path.includes(`.${k}`))) return 'ownership';
  }
  if (path.startsWith('$.World.')) {
    // DDV-native DecorationPresets are in-save game objects, not Wand Presets.
    if (path.startsWith('$.World.DecorationPresets[]')) return 'ddv-native-preset';
    if (CATEGORIES['floating-island-playerhouse'].some(k => path.includes(`.${k}`))) return 'floating-island-playerhouse';
    if (CATEGORIES['road-fence'].some(k => path.includes(`.${k}`))) return 'road-fence';
    if (CATEGORIES['world-object'].some(k => path.includes(`.${k}`))) return 'world-object';
    if (CATEGORIES['world-grid'].some(k => path.includes(`.${k}`))) return 'world-grid';
  }
  return null; // unknown noncanonical path is not emitted
}

/** Compare observed *shape*, never a schema or gameplay compatibility verdict. */
export function compareObservedSaveStructure(left, right, { platform, leftBuild, rightBuild, budgets } = {}) {
  const pair = BUILDS[platform];
  if (!pair || pair.left.build !== leftBuild || pair.right.build !== rightBuild) {
    throw new Error('BUILD_SOURCE_ATTESTATION_REQUIRED');
  }
  assertValidProfile(left, pair.left.version);
  assertValidProfile(right, pair.right.version);
  const a = observeProfileShape(left, budgets);
  const b = observeProfileShape(right, budgets);
  const A = new Map(a.paths.map(x => [x.path, x.types]));
  const B = new Map(b.paths.map(x => [x.path, x.types]));
  const entries = [...new Set([...A.keys(), ...B.keys()])].sort((x, y) => x.localeCompare(y, 'en'))
    .filter(x => categorize(x))
    .map(path => ({
      path,
      feature: categorize(path),
      leftTypes: A.get(path) ?? null,
      rightTypes: B.get(path) ?? null,
      observation: !a.complete || !b.complete ? 'INCOMPLETE_NO_VERDICT'
        : !A.has(path) || !B.has(path) ? 'OPTIONAL_OR_STATE_DEPENDENT_UNOBSERVED'
        : JSON.stringify(A.get(path)) === JSON.stringify(B.get(path)) ? 'OBSERVED_SHAPE_MATCH'
        : 'DIFFERENT_OBSERVED_KIND_NEEDS_REVIEW'
    }));
  return {
    contract: OBSERVED_SHAPE_CONTRACT,
    platform,
    sourceIdentity: 'OPERATOR_ATTESTED_NOT_PROVEN_BY_GAMEINFO',
    left: { gameVersion: '1.25.0', schema: 624, build: pair.left.build, complete: a.complete },
    right: { gameVersion: '1.25.3', schema: 626, build: pair.right.build, complete: b.complete },
    comparisonScope: 'ALLOWLISTED_FIELD_KINDS_ONLY_NO_VALUES_NO_MAP_KEYS',
    acceptance: { read: 'REFER_TO_CANONICAL_EXACT_BUILD_REGISTRY', model: 'OBSERVED_ONLY_NOT_RUNTIME_VALIDATED', write: 'NOT_AUTHORIZED', productApply: false },
    interpretation: 'Different play-state specimens; absent paths and differing kinds are review candidates, never proof of schema deletion or unsafe game semantics.',
    complete: a.complete && b.complete,
    entries
  };
}

function parseArgs(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) throw new Error('USAGE');
    const key = argv[i].slice(2);
    if (!['left', 'right', 'platform', 'left-build', 'right-build'].includes(key) || flags.has(key)) throw new Error('USAGE');
    flags.set(key, argv[i + 1]);
  }
  if (flags.size !== 5) throw new Error('USAGE');
  return flags;
}

function readPrivateProfile(filename) {
  try { return JSON.parse(readFileSync(filename, 'utf8')); }
  catch {
    // V8 JSON.parse and Node fs errors may include fragments of personal source
    // bytes or a private local path. Never propagate their messages.
    throw new Error('PROFILE_INPUT_UNREADABLE_OR_INVALID');
  }
}

export function cli(argv) {
  const args = parseArgs(argv);
  const left = readPrivateProfile(args.get('left'));
  const right = readPrivateProfile(args.get('right'));
  return compareObservedSaveStructure(left, right, {
    platform: args.get('platform'), leftBuild: args.get('left-build'), rightBuild: args.get('right-build')
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(`${JSON.stringify(cli(process.argv.slice(2)), null, 2)}\n`); }
  catch { process.stderr.write('01E structural comparison rejected: PRIVATE_INPUT_OR_VALIDATION_ERROR\n'); process.exitCode = 1; }
}
