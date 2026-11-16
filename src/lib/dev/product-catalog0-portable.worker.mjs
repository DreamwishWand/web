import {loadProtectedCatalog0PortableRustWasm,CATALOG0_PORTABLE_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createProductCatalog0PortableLocalAdapter} from '../ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {installLocalCatalog0PortableWorker} from './local-scoped-edit-worker-port.mjs';
import {bootPlacement} from './product-placement-worker-boot.mjs';
void bootPlacement(loadProtectedCatalog0PortableRustWasm,createProductCatalog0PortableLocalAdapter,installLocalCatalog0PortableWorker,CATALOG0_PORTABLE_RELEASE.operation);
