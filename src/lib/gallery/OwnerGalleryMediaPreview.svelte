<script lang="ts">
  import {onMount,onDestroy} from 'svelte';
  import {locale,ct as t} from '$lib/i18n/community.js';
  import PhotoPreview from '$lib/gallery/PhotoPreview.svelte';
  import {OwnerGalleryObjectUrlLease} from '$lib/community/gallery-owner-media.js';
  import type {CommunityClient} from '$lib/community/staging-http-client';

  export let client:CommunityClient;
  export let mediaIds:string[]=[];
  export let workId='';
  export let title='',description='',creator='',category='';
  const lease=new OwnerGalleryObjectUrlLease();
  let imageUrls:string[]=[];
  let state:'loading'|'ready'|'error'|'empty'='loading';
  let errorCode='';
  let mounted=false;
  let originUserId='';
  let originAccessToken='';
  let originExpiresAt=0;
  let lastKey='';
  $: key=workId+':'+mediaIds.map(String).join(':');
  $: if(mounted&&key!==lastKey){lastKey=key;void load();}
  function activeIdentity(){
    const session=client?.session;
    return Boolean(session&&session.userId===originUserId&&
      session.accessToken===originAccessToken&&session.expiresAt===originExpiresAt&&
      session.expiresAt>Date.now());
  }
  function release(){
    lease.close();imageUrls=[];state='empty';errorCode='';
    originUserId='';originAccessToken='';originExpiresAt=0;
  }
  async function load(){
    const {generation,signal}=lease.begin();
    imageUrls=[];errorCode='';state='loading';
    const session=client?.session;
    if(!session||session.expiresAt<=Date.now()){
      lease.close();state='error';errorCode='OWNER_MEDIA_AUTH_REQUIRED';return;
    }
    originUserId=session.userId;originAccessToken=session.accessToken;
    originExpiresAt=session.expiresAt;
    try{
      for(const mediaId of mediaIds.slice(0,10)){
        if(!lease.current(generation)||!activeIdentity())throw new Error('OWNER_MEDIA_SESSION_CHANGED');
        const result=await client.readGalleryOwnerMedia(String(mediaId),signal);
        if(!activeIdentity()||!lease.current(generation))throw new Error('OWNER_MEDIA_SESSION_CHANGED');
        const url=lease.append(result.blob,generation);
        if(!url)return;
        imageUrls=[...imageUrls,url];
      }
      if(lease.current(generation))state=imageUrls.length?'ready':'empty';
    }catch(e){
      if(!lease.current(generation))return;
      // On any integrity/authority failure, revoke all partially loaded URLs.
      const code=e instanceof Error&&'code' in e?String(e.code):'OWNER_MEDIA_REQUEST_FAILED';
      lease.close();imageUrls=[];errorCode=code;state='error';
    }
  }
  function checkSession(){
    if(mounted&&originUserId&&!activeIdentity()){
      release();state='error';errorCode='OWNER_MEDIA_SESSION_CHANGED';
    }
  }
  onMount(()=>{
    mounted=true;lastKey=key;void load();
    const interval=setInterval(checkSession,1000);
    window.addEventListener('focus',checkSession);
    document.addEventListener('visibilitychange',checkSession);
    return ()=>{
      mounted=false;clearInterval(interval);
      window.removeEventListener('focus',checkSession);
      document.removeEventListener('visibilitychange',checkSession);
      lease.destroy();imageUrls=[];
    };
  });
  onDestroy(()=>{lease.destroy();imageUrls=[]});
</script>

<section class="owner-media-read" aria-label={t('galleryv1.ownerMediaRead',{},$locale)}>
  {#if state==='loading'}<p role="status">{t('galleryv1.ownerMediaLoading',{},$locale)}</p>
  {:else if state==='error'}
    <p role="alert">{t('galleryv1.ownerMediaFailure',{},$locale)}:
      {errorCode==='OWNER_MEDIA_CHECKSUM_MISMATCH'||errorCode==='OWNER_MEDIA_SIZE_MISMATCH'||errorCode==='OWNER_MEDIA_MIME_MISMATCH'?
        t('galleryv1.ownerIntegrityFailure',{},$locale):
        errorCode==='GALLERY_OWNER_MEDIA_FORBIDDEN'||errorCode==='OWNER_MEDIA_SESSION_CHANGED'||errorCode==='OWNER_MEDIA_AUTH_REQUIRED'?
        t('galleryv1.ownerSessionRequired',{},$locale):
        errorCode==='GALLERY_OWNER_MEDIA_BYTES_UNAVAILABLE'?t('galleryv1.ownerMissing',{},$locale):
        t('galleryv1.ownerMediaFailure',{},$locale)}
    </p>
    <button type="button" on:click={load}>{t('galleryv1.retry',{},$locale)}</button>
  {:else if state==='ready'}
    <PhotoPreview {title} {description} {creator} {category} {imageUrls}/>
  {:else}<p role="status">{t('galleryv1.ownerMissing',{},$locale)}</p>{/if}
  <p class="private-note">{t('galleryv1.ownerMediaEphemeral',{},$locale)}</p>
</section>
<style>
 .owner-media-read{display:grid;gap:12px;min-width:0;overflow-wrap:anywhere}
 .owner-media-read p{margin:0}
 .owner-media-read button{justify-self:start;min-height:44px}
 .private-note{font-size:12px;color:var(--ink-muted)}
</style>
