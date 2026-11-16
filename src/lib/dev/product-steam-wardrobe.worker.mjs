import {loadProtectedSteamWardrobeRustWasm,STEAM_WARDROBE_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626WardrobeLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalWardrobeDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSteamWardrobeRustWasm,createProductSteam626WardrobeLocalAdapter,installLocalWardrobeDevWorker,STEAM_WARDROBE_RELEASE.operation);
