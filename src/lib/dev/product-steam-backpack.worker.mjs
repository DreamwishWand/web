import {loadProtectedSteamBackpackRustWasm,STEAM_BACKPACK_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626BackpackLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalBackpackDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSteamBackpackRustWasm,createProductSteam626BackpackLocalAdapter,installLocalBackpackDevWorker,STEAM_BACKPACK_RELEASE.operation);
