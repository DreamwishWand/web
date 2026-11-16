import {loadProtectedSwitchWardrobeRustWasm,SWITCH_WARDROBE_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626WardrobeLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalWardrobeDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSwitchWardrobeRustWasm,createProductSwitch626WardrobeLocalAdapter,installLocalWardrobeDevWorker,SWITCH_WARDROBE_RELEASE.operation);
