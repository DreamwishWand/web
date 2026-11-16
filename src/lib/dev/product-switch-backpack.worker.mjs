import {loadProtectedSwitchBackpackRustWasm,SWITCH_BACKPACK_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626BackpackLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalBackpackDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSwitchBackpackRustWasm,createProductSwitch626BackpackLocalAdapter,installLocalBackpackDevWorker,SWITCH_BACKPACK_RELEASE.operation);
