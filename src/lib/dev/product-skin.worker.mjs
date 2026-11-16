import {loadProtectedSkinRustWasm,SKIN_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626SkinLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalAppearanceDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSkinRustWasm,createProductSteam626SkinLocalAdapter,installLocalAppearanceDevWorker,SKIN_RELEASE.operation);
