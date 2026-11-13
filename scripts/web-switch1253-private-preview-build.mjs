// Build the actual shared Svelte ItemThumb and resolver for an isolated private
// local-browser test. This is a test-only artifact, never a Pages route or
// production release authority. CI carries only public source-derived JS/CSS;
// it does not receive any DDV pixels or raw archive. Local tester supplies
// the SHA-pinned WebP bytes via loopback after the build.
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {build} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';

const repo=resolve('.');
const root=await mkdtemp(join(repo,'.switch1253-private-preview-'));
const out=await mkdtemp(join(tmpdir(),'switch1253-preview-'));
try{
 await writeFile(join(root,'paths.mjs'),"export const base='/web';\n");
 await writeFile(join(root,'Harness.svelte'),`<script>
 import ItemThumb from '$lib/ui/ItemThumb.svelte';
 </script>
 <main data-private-preview="test-only">
  <h1>Private test fixture — not published</h1>
  <div class="cards">
   <article data-preview-item="40000047"><ItemThumb itemId={40000047} label="Wardrobe" /><span>Wardrobe</span></article>
   <article data-preview-item="40006096"><ItemThumb itemId={40006096} label="Dice Tree" /><span>Dice Tree</span></article>
   <article data-preview-item="40002422"><ItemThumb itemId={40002422} label="Excluded" /><span>Excluded</span></article>
  </div>
 </main>
 <style>
 .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr));gap:8px;min-width:0}
 article{min-width:0;display:flex;flex-direction:column;align-items:start;gap:4px;overflow-wrap:anywhere}
 </style>`);
 await writeFile(join(root,'entry.mjs'),`import {mount,tick} from 'svelte';
 import Harness from './Harness.svelte';
 import {prepareSwitch1253ItemImageManifest,validateSwitch1253ItemImageCatalog,
 switch1253PublicItemImageSource,loadSwitch1253PublicItemImageSource} from '$lib/item-media/switch1253-public-item-images.mjs';
 import {itemImagePreferences} from '$lib/item-media/public-item-images.mjs';
 mount(Harness,{target:document.body});
 const draft=prepareSwitch1253ItemImageManifest();
 function fixture(){
  const m=structuredClone(draft);
  const {gate,...pending}=m.publication;
  const release={...pending,mediaPublic:true,rightsReview:'OPERATOR_ACCEPTED',
   receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',
   attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',
   operatorReceiptSha256:'b'.repeat(64),items:{}};
  for(const [id,e] of Object.entries(m.items)){
   e.publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
   release.items[id]={originalNativeStreamSha256:e.originalNativeStreamSha256,sourcePngSha256:e.sourcePngSha256,
    webpSha256:e.webpSha256,rightsStatus:e.rightsStatus,publicationDecision:e.publicationDecision,visibility:e.visibility};
  }
  const {mediaPublic,items,...pub}=release;
  m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...pub};
  return {manifest:m,release};
 }
 async function init(){
  await tick();
  window.act418PrivateTest={draft:()=>structuredClone(draft),fixture,
   apply:(m,r)=>{const catalog=validateSwitch1253ItemImageCatalog(m,r);
    switch1253PublicItemImageSource.set({status:'VERIFIED',catalog,reason:null});return catalog.count;},
   off:()=>loadSwitch1253PublicItemImageSource('/web'),
   prefs:(size,fit)=>itemImagePreferences.set({size,fit,density:'comfortable'})
  };
 }
 void init();`);
 await build({root,configFile:false,plugins:[svelte({configFile:false})],
  resolve:{alias:{'$lib':join(repo,'src/lib'),'$app/paths':join(root,'paths.mjs')}},
  build:{outDir:out,emptyOutDir:true,cssCodeSplit:false,
   lib:{entry:join(root,'entry.mjs'),formats:['es'],fileName:()=> 'preview.js',cssFileName:'preview'},
   rollupOptions:{output:{inlineDynamicImports:true}}}});
 const names=(await readdir(out)).sort();
 if(JSON.stringify(names)!==JSON.stringify(['preview.css','preview.js']))throw Error('UNEXPECTED_TEST_BUNDLE_FILES '+names.join(','));
 for(const name of names){
  const bytes=await readFile(join(out,name)),b64=bytes.toString('base64');
  console.log('ACT418_PRIVATE_BUNDLE '+name+' '+bytes.length+' '+createHash('sha256').update(bytes).digest('hex'));
  for(let i=0;i<b64.length;i+=4000)console.log('ACT418_PRIVATE_CHUNK '+name+' '+(i/4000)+' '+b64.slice(i,i+4000));
 }
 console.log('ACT418_PRIVATE_PREVIEW_BUILD_NO_GAME_BYTES_PASS');
}finally{
 await rm(root,{recursive:true,force:true});await rm(out,{recursive:true,force:true});
}
