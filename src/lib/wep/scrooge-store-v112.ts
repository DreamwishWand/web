type AnyRecord = Record<string, any>;
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const SCROOGE_STORE_V112_STATIC_PATH =
  '/ddv/core/world/v1.25/scrooge-store-state-v125.json';
export const SCROOGE_STORE_V112_SHA256 =
  '322cd1768a5a75fa8ceea60a0ed7dd65d048666849067ed5ab034a483c60c578';
export const SCROOGE_STORE_V112_SCHEMA =
  'ddv.scrooge-store-state@1';

function clone<T>(value:T):T {
  return structuredClone(value);
}

async function sha256Hex(bytes:Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WEP_SCROOGE_STORE_V112_SHA256_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function fetchPinnedContract(
  url:string,
  fetchImpl:FetchLike
) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('WEP_SCROOGE_STORE_V112_CONTRACT_FETCH_FAILED');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256Hex(bytes)) !== SCROOGE_STORE_V112_SHA256) {
    throw new Error('WEP_SCROOGE_STORE_V112_CONTRACT_HASH_MISMATCH');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return JSON.parse(text);
}

function validateContract(contract:AnyRecord) {
  if (
    contract?.schema !== SCROOGE_STORE_V112_SCHEMA ||
    contract?.artifactId !== 'DDV-SCROOGE-STORE-STATE-V125-V1_12' ||
    contract?.version !== 'v1.12' ||
    contract?.status !== 'PROMOTED' ||
    contract?.target?.platform !== 'Nintendo Switch' ||
    contract?.target?.gameVersion !== '1.25.0' ||
    contract?.target?.buildId !== '52BD625D9B4E0053' ||
    Number(contract?.target?.profileSchemaVersion) !== 624 ||
    contract?.collectionBoundary?.authoritativeStoreCollection !==
      'ProfileWorld.Stores' ||
    contract?.collectionBoundary?.distinctCollection !==
      'ProfileWorld.Shops' ||
    contract?.identity?.selectedWorldObjectKey !==
      'GridObject.ItemID' ||
    contract?.identity?.serializedStoreKey !==
      'StoreInfo.BuildingItemID' ||
    contract?.writerBoundary?.persistentWriteAuthorized !== false ||
    contract?.writerBoundary?.WORLD_PERSISTENT_WRITE_V125 !== false ||
    contract?.wepActivation?.mutationHandlerAuthorized !== false
  ) {
    throw new Error('WEP_SCROOGE_STORE_V112_CONTRACT_MISMATCH');
  }
  return true;
}

function finiteInteger(value:unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function normalizeItem(raw:AnyRecord|null|undefined) {
  if (raw === null || raw === undefined) return null;
  const id = finiteInteger(raw?.id);
  const amount = finiteInteger(raw?.amount);
  if (id === null || amount === null || amount < 0) {
    return {
      status: 'invalid',
      id: null,
      amount: null
    };
  }
  return {
    status: 'resolved',
    id,
    amount
  };
}

function normalizeSlot(raw:AnyRecord, slotIndex:number) {
  return {
    slotIndex,
    item: normalizeItem(raw?.Item),
    isAvailable:
      typeof raw?.IsAvailable === 'boolean'
        ? raw.IsAvailable
        : null,
    currencyId: finiteInteger(raw?.CurrencyId)
  };
}

function normalizeDisplay(raw:AnyRecord, displayIndex:number) {
  const info =
    raw?.DisplayInfo && typeof raw.DisplayInfo === 'object'
      ? raw.DisplayInfo
      : {};
  const slots = Array.isArray(info?.Slots)
    ? info.Slots.map((slot:AnyRecord, slotIndex:number) =>
        normalizeSlot(slot, slotIndex)
      )
    : [];
  return {
    displayIndex,
    displayItemId: finiteInteger(raw?.DisplayItemID),
    layoutType:
      typeof info?.LayoutType === 'string'
        ? info.LayoutType
        : null,
    lastRefresh:
      typeof info?.LastRefresh === 'string'
        ? info.LastRefresh
        : null,
    slots
  };
}

function normalizeStore(raw:AnyRecord) {
  const displays = Array.isArray(raw?.Displays)
    ? raw.Displays.map((display:AnyRecord, displayIndex:number) =>
        normalizeDisplay(display, displayIndex)
      )
    : [];
  const totalSlotCount = displays.reduce(
    (sum:number, display:AnyRecord) =>
      sum + display.slots.length,
    0
  );
  const availableSlotCount = displays.reduce(
    (sum:number, display:AnyRecord) =>
      sum +
      display.slots.filter(
        (slot:AnyRecord) => slot.isAvailable === true
      ).length,
    0
  );
  const weightedItems =
    raw?.WeightedItems &&
    typeof raw.WeightedItems === 'object' &&
    !Array.isArray(raw.WeightedItems)
      ? clone(raw.WeightedItems)
      : {};
  const sequence = Array.isArray(
    raw?.CurrentSequenceIndexPerUpgrade
  )
    ? raw.CurrentSequenceIndexPerUpgrade
        .map((value:unknown) => finiteInteger(value))
    : [];
  return {
    buildingItemId: finiteInteger(raw?.BuildingItemID),
    lastRefresh:
      typeof raw?.LastRefresh === 'string'
        ? raw.LastRefresh
        : null,
    weightedItems,
    weightedItemCount: Object.keys(weightedItems).length,
    currentSequenceIndexPerUpgrade: sequence,
    displayCount: displays.length,
    totalSlotCount,
    availableSlotCount,
    displays
  };
}

function storesFromProfile(profile:AnyRecord) {
  if (Array.isArray(profile?.ProfileWorld?.Stores)) {
    return profile.ProfileWorld.Stores;
  }
  return Array.isArray(profile?.World?.Stores)
    ? profile.World.Stores
    : null;
}

function createBindingFromContract(contract:AnyRecord) {
  validateContract(contract);

  function resolveStoreForItem(
    profile:AnyRecord,
    itemIdInput:unknown
  ) {
    const itemId = finiteInteger(itemIdInput);
    if (itemId === null || itemId <= 0) {
      return Object.freeze({
        schema: 'ddv.scrooge-store-resolution@1',
        status: 'blocked',
        code: 'SCROOGE_STORE_ITEM_ID_INVALID',
        itemId: null,
        store: null,
        persistentWriteAuthorized: false
      });
    }

    const stores = storesFromProfile(profile);
    if (!stores) {
      return Object.freeze({
        schema: 'ddv.scrooge-store-resolution@1',
        status: 'blocked',
        code: 'SCROOGE_STORE_COLLECTION_UNAVAILABLE',
        itemId,
        store: null,
        persistentWriteAuthorized: false
      });
    }

    const matches = stores.filter(
      (store:AnyRecord) =>
        finiteInteger(store?.BuildingItemID) === itemId
    );

    if (matches.length === 0) {
      return Object.freeze({
        schema: 'ddv.scrooge-store-resolution@1',
        status: 'not-store',
        code: null,
        itemId,
        store: null,
        persistentWriteAuthorized: false
      });
    }
    if (matches.length !== 1) {
      return Object.freeze({
        schema: 'ddv.scrooge-store-resolution@1',
        status: 'blocked',
        code: 'SCROOGE_STORE_IDENTITY_AMBIGUOUS',
        itemId,
        matchCount: matches.length,
        store: null,
        persistentWriteAuthorized: false
      });
    }

    const store = normalizeStore(matches[0]);
    if (store.buildingItemId !== itemId) {
      return Object.freeze({
        schema: 'ddv.scrooge-store-resolution@1',
        status: 'blocked',
        code: 'SCROOGE_STORE_IDENTITY_MISMATCH',
        itemId,
        store: null,
        persistentWriteAuthorized: false
      });
    }

    return Object.freeze({
      schema: 'ddv.scrooge-store-resolution@1',
      status: 'resolved',
      code: null,
      itemId,
      store: clone(store),
      sourceCollection: 'ProfileWorld.Stores',
      addressPolicy:
        'BuildingItemID + DisplayIndex + SlotIndex',
      persistentWriteAuthorized: false
    });
  }

  return Object.freeze({
    schema: SCROOGE_STORE_V112_SCHEMA,
    artifactId: 'DDV-SCROOGE-STORE-STATE-V125-V1_12',
    contractSha256: SCROOGE_STORE_V112_SHA256,
    platform: 'Nintendo Switch',
    gameVersion: '1.25.0',
    buildId: '52BD625D9B4E0053',
    profileSchemaVersion: 624,
    resolveStoreForItem,
    contractSnapshot: Object.freeze(clone(contract)),
    persistentWriteAuthorized: false,
    mutationHandlerAuthorized: false
  });
}

export async function createSwitchV125ScroogeStoreBinding({
  basePath = '',
  fetchImpl = globalThis.fetch
}: {
  basePath?: string;
  fetchImpl?: FetchLike;
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('WEP_SCROOGE_STORE_V112_FETCH_UNAVAILABLE');
  }
  const prefix = String(basePath ?? '').replace(/\/$/, '');
  const contract = await fetchPinnedContract(
    `${prefix}${SCROOGE_STORE_V112_STATIC_PATH}`,
    fetchImpl
  );
  return createBindingFromContract(contract);
}

export function createSwitchV125ScroogeStoreBindingFromContract(
  contract:AnyRecord
) {
  return createBindingFromContract(clone(contract));
}
