import {loadProtectedSwitchChestPortableRustWasm,SWITCH_CHEST_PORTABLE_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitchChestPortableLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalSwitchChestPortableWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSwitchChestPortableRustWasm,createProductSwitchChestPortableLocalAdapter,installLocalSwitchChestPortableWorker,SWITCH_CHEST_PORTABLE_RELEASE.operation);
