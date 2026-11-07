// Separate CI-only Worker entry point, never linked from owner-local HTML.
import {installOwnerLocalSteamV1Worker}
  from '../../tools/owner-local-steam-v1/worker-core.mjs';
installOwnerLocalSteamV1Worker({allowSyntheticFixture:true});
