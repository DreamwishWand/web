import {loadProtectedChestPortableRustWasm,CHEST_PORTABLE_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductChestPortableLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalChestPortableWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedChestPortableRustWasm,createProductChestPortableLocalAdapter,installLocalChestPortableWorker,CHEST_PORTABLE_RELEASE.operation);
