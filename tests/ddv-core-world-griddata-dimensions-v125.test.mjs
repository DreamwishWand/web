import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const world = require('../static/ddv/core/world/v1.25/adapter-v125.cjs');
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/ddv-world/core-world-v125-observed-fixture.json', import.meta.url), 'utf8'));
const raw = fs.readFileSync(new URL('../static/ddv/core/world/v1.25/griddata-dimensions-v125.json', import.meta.url));
const dims = JSON.parse(raw);
const source = {
  gameVersion: '1.25.0',
  platform: 'Nintendo Switch',
  buildIdentity: '52BD625D9B4E0053',
  profileSchemaVersion: 624
};

assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),
  '75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa');
assert.equal(Object.keys(dims).length, 152);

assert.deepEqual(dims['GridData/Villages/Village04-SnowLevel-GridData.json'], {
  sizeX: 230,
  sizeY: 175,
  sourceSha256: 'd7abc8d74eb10c6e0df07090546c4d821c327b6e7ba7a56548fbb07bdd81c282'
});
assert.deepEqual(dims['GridData/Furniture/PrincessFrog_Update12/BistroTables01-GridData.json'].sizeX, 3);
assert.deepEqual(dims['GridData/Furniture/PrincessFrog_Update12/BistroTables01-GridData.json'].sizeY, 3);

const adapter = world.createAdapter({
  geometryIndex: fx.geometryIndex,
  scopeIndex: fx.scopeIndex,
  gridDataDimensions: dims
});

{
  const d = adapter.loadAreaGrid(fx.profile, {
    villageIndex: 0,
    areaId: 7,
    rootGridId: 0,
    source
  });
  assert.deepEqual(d.metadata.rootGridBounds, {
    x: 0,
    y: 0,
    w: 460,
    h: 350,
    status: 'AUTHORITATIVE_GRIDDATAPATH'
  });
}

{
  const d = adapter.loadAreaGrid(fx.profile, {
    villageIndex: 0,
    areaId: 3,
    rootGridId: 5,
    source
  });
  const bistro = d.objects.find((x) => x.itemId === 40003102);
  const table = d.objects.find((x) => x.itemId === 40000178);
  assert.equal(bistro.portableState.child.width, 6);
  assert.equal(bistro.portableState.child.height, 6);
  assert.equal(table.portableState.child.width, 2);
  assert.equal(table.portableState.child.height, 2);
}

{
  const p = structuredClone(fx.profile);
  p.World.GridCollection.Grids['0'].GridDataPath = 'GridData/Unknown/NoSuch-GridData.json';
  const d = adapter.loadAreaGrid(p, {
    villageIndex: 0,
    areaId: 7,
    rootGridId: 0,
    source
  });
  assert.equal(d.metadata.rootGridBounds, null);
  assert.ok(d.metadata.diagnostics.some((x) => x.code === 'ROOT_GRID_BOUNDS_UNRESOLVED'));
}

console.log('GridData dimensions v1.25 contract PASS');