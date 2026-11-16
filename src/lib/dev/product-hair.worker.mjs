import {loadProtectedHairRustWasm,HAIR_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductSteam626HairLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalAppearanceDevWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedHairRustWasm,createProductSteam626HairLocalAdapter,installLocalAppearanceDevWorker,HAIR_RELEASE.operation);
