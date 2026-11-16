import {loadProtectedSwitchSkinRustWasm,SWITCH_SKIN_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626SkinLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalAppearanceDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSwitchSkinRustWasm,createProductSwitch626SkinLocalAdapter,installLocalAppearanceDevWorker,SWITCH_SKIN_RELEASE.operation);
