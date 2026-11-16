import {loadProtectedComp03RustWasm,COMP03_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626Comp03LocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalComp03DevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedComp03RustWasm,createProductSteam626Comp03LocalAdapter,installLocalComp03DevWorker,COMP03_RELEASE.operation);
