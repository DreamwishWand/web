import {loadProtectedSr03RustWasm,SR03_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626Sr03LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalSr03DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSr03RustWasm,createProductSteam626Sr03LocalAdapter,installLocalSr03DevWorker,SR03_RELEASE.operation);
