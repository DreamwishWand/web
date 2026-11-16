import {loadProtectedSwitchHairRustWasm,SWITCH_HAIR_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSwitch626HairLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalAppearanceDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedSwitchHairRustWasm,createProductSwitch626HairLocalAdapter,installLocalAppearanceDevWorker,SWITCH_HAIR_RELEASE.operation);
