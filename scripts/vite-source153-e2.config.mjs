import {sveltekit} from '@sveltejs/kit/vite';
import {defineConfig} from 'vite';

// EPHEMERAL CI RUNNER ONLY. This configuration is not used by production
// builds or the normal Vite dev command. It preserves real GoTrue/Edge
// response headers, making Vary/CDN/Surrogate visible to the existing
// strict WEB267 decoder without fabricating or relaxing any header.
if(process.env.DDVRE_E2_LOCAL_DISPOSABLE!=='APPROVED' ||
   process.env.VITE_DDVRE_E2_OWNER_READONLY!=='LOCAL_DISPOSABLE_ONLY')
 throw Error('SIGNED_OWNER_E2_PROXY_REQUIRES_DISPOSABLE_LOCAL_RUNNER');
export default defineConfig({
 plugins:[sveltekit()],
 server:{strictPort:true,proxy:{
  '/__source153_e2':{
   target:'http://127.0.0.1:54321',
   changeOrigin:false,
   rewrite:path=>path.replace(/^\/__source153_e2(?=\/)/,''),
   secure:false
  }
 }}
});
