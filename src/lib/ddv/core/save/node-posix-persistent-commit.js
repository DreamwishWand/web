import { promises as fs, constants as FSC } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  PERSISTENT_COMMIT_VERIFICATION_BINDING
} from './persistent-commit-engine.js';

export const NODE_POSIX_ADAPTER_CONTRACT='dreamwish.ddv.persistent-commit-filesystem-adapter@1';
export const NODE_POSIX_SURFACE_CONTRACT='dreamwish.ddv.node-posix-local-commit-surface@1';
const PROOF_MARKER='.dreamwish-wand-commit-proof-root';

export function createNodePosixFilesystemAdapter({allowNonLinuxForTests=false}={}){
  return {
    contract:NODE_POSIX_ADAPTER_CONTRACT,
    environmentDescriptor:Object.freeze({
      contract:NODE_POSIX_SURFACE_CONTRACT,
      os:process.platform,
      node:process.version,
      browser:false,
      atomicReplace:'POSIX_RENAME_OVER_EXISTING_SAME_MOUNT',
      fileDurability:'FSYNC_REQUIRED',
      directoryDurability:'PARENT_DIRECTORY_FSYNC_REQUIRED',
      networkFilesystemSupport:false,
      persistentWriteAuthorized:false
    }),
    processId:process.pid,
    hostId:os.hostname(),
    proofRoot:null,
    dirname:path.dirname,
    normalizePath:p=>path.resolve(p),
    async derivePaths({targetPath,backupDirectory,transactionId,sourceSha256}){
      const target=path.resolve(targetPath),backupDir=path.resolve(backupDirectory),base=path.basename(target),parent=path.dirname(target),short=sourceSha256.slice(0,12);
      return Object.freeze({
        targetPath:target,
        lockPath:path.join(parent,`.${base}.wand.lock`),
        tempPath:path.join(parent,`.${base}.${transactionId}.candidate.tmp`),
        rollbackTempPath:path.join(parent,`.${base}.${transactionId}.rollback.tmp`),
        backupPath:path.join(backupDir,`${base}.${transactionId}.${short}.backup`),
        journalPath:path.join(backupDir,`${base}.${transactionId}.journal.json`)
      });
    },
    async assertEnvironment({targetPath,backupDirectory,paths,mode,proofRoot,recovery=false}){
      if(process.platform!=='linux'&&!allowNonLinuxForTests)throw pcError('PC_ENV_LINUX_REQUIRED');
      const target=path.resolve(targetPath),parent=path.dirname(target),backupDir=path.resolve(backupDirectory);
      if(mode==='AUTHORIZED')throw pcError('PC_PERSISTENT_WRITE_NOT_AUTHORIZED');
      let proofRealRoot=null;
      if(mode==='PROOF_ONLY'){
        const root=path.resolve(proofRoot||'');
        if(!isInside(root,target)||!isInside(root,backupDir))throw pcError('PC_PROOF_PATH_OUTSIDE_ROOT');
        const marker=path.join(root,PROOF_MARKER);
        const markerText=await fs.readFile(marker,'utf8').catch(()=>null);
        if(markerText!=='DREAMWISH_WAND_COMMIT_PROOF_ROOT_V1\n')throw pcError('PC_PROOF_ROOT_MARKER_REQUIRED');
        proofRealRoot=await fs.realpath(root).catch(()=>{throw pcError('PC_PROOF_ROOT_REALPATH_REQUIRED');});
        const realParent=await fs.realpath(parent).catch(()=>{throw pcError('PC_PROOF_PARENT_REALPATH_REQUIRED');});
        if(!isInside(proofRealRoot,realParent))throw pcError('PC_PROOF_REALPATH_OUTSIDE_ROOT');
      }
      const lst=await fs.lstat(target).catch(()=>null);
      if(!lst&&!recovery)throw pcError('PC_TARGET_MUST_BE_REGULAR_NON_SYMLINK_FILE');
      if(lst&&(!lst.isFile()||lst.isSymbolicLink()))throw pcError('PC_TARGET_MUST_BE_REGULAR_NON_SYMLINK_FILE');
      const parentStat=await fs.stat(parent);
      if(lst){
        const targetStat=await fs.stat(target);
        if(parentStat.dev!==targetStat.dev)throw pcError('PC_TARGET_PARENT_DEVICE_MISMATCH');
        if(proofRealRoot){
          const realTarget=await fs.realpath(target).catch(()=>{throw pcError('PC_PROOF_TARGET_REALPATH_REQUIRED');});
          if(!isInside(proofRealRoot,realTarget))throw pcError('PC_PROOF_REALPATH_OUTSIDE_ROOT');
        }
      }
      await fs.mkdir(backupDir,{recursive:true,mode:0o700});
      const bd=await fs.lstat(backupDir);
      if(!bd.isDirectory()||bd.isSymbolicLink())throw pcError('PC_BACKUP_DIRECTORY_INVALID');
      if(proofRealRoot){
        const realBackup=await fs.realpath(backupDir).catch(()=>{throw pcError('PC_PROOF_BACKUP_REALPATH_REQUIRED');});
        if(!isInside(proofRealRoot,realBackup))throw pcError('PC_PROOF_REALPATH_OUTSIDE_ROOT');
      }
      await probeDirectoryFsync(parent);
      await probeDirectoryFsync(backupDir);
      await probeAtomicReplace(parent);
      // Temp must be a sibling, so the atomic replacement path is by construction on one mount.
      if(path.dirname(paths.tempPath)!==parent)throw pcError('PC_TEMP_NOT_SIBLING');
      return true;
    },
    async acquireLock(lockPath,record){
      const bytes=new TextEncoder().encode(JSON.stringify(record,null,2)+'\n');
      let h;
      try{h=await fs.open(lockPath,'wx',0o600);}catch(e){if(e?.code==='EEXIST')throw pcError('PC_LOCK_EXISTS');throw e;}
      try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
      await syncDir(path.dirname(lockPath));
    },
    async releaseLock(lockPath){await fs.unlink(lockPath).catch(e=>{if(e?.code!=='ENOENT')throw e;});await syncDir(path.dirname(lockPath));},
    async readFile(p){return new Uint8Array(await fs.readFile(p));},
    async writeFileExclusive(p,bytes){
      let h;try{h=await fs.open(p,'wx',0o600);}catch(e){if(e?.code==='EEXIST')throw pcError('PC_EXCLUSIVE_FILE_EXISTS',p);throw e;}
      try{await h.writeFile(bytes);}finally{await h.close();}
    },
    async syncFile(p){const h=await fs.open(p,'r+');try{await h.sync();}finally{await h.close();}},
    async syncDirectory(p){await syncDir(p);},
    async atomicReplace(from,to){
      const a=await fs.stat(from),b=await fs.stat(path.dirname(to));
      if(a.dev!==b.dev)throw pcError('PC_ATOMIC_REPLACE_CROSS_DEVICE');
      await fs.rename(from,to);
    },
    async removeFileIfExists(p){await fs.unlink(p).catch(e=>{if(e?.code!=='ENOENT')throw e;});},
    async writeJournalDurable(p,journal){
      const parent=path.dirname(p);await fs.mkdir(parent,{recursive:true,mode:0o700});
      const tmp=`${p}.next-${process.pid}-${Date.now()}`;const bytes=new TextEncoder().encode(JSON.stringify(journal,null,2)+'\n');
      let h;try{h=await fs.open(tmp,'wx',0o600);await h.writeFile(bytes);await h.sync();}finally{if(h)await h.close();}
      await fs.rename(tmp,p);await syncDir(parent);
    },
    async readJson(p){return JSON.parse(await fs.readFile(p,'utf8'));},
    async exists(p){try{await fs.access(p,FSC.F_OK);return true;}catch{return false;}},
    async isProcessAlive(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(e){return e?.code==='EPERM';}}
  };
}

export function createPromotedCandidateVerificationBinding({verifyWriteCandidate,SafeProfileEditSession,codec,contracts}){
  if(typeof verifyWriteCandidate!=='function'||!SafeProfileEditSession?.open||!codec)throw pcError('PC_VERIFICATION_DEPENDENCIES_REQUIRED');
  return Object.freeze({
    contract:PERSISTENT_COMMIT_VERIFICATION_BINDING,
    async verifyCandidate(candidate){return verifyWriteCandidate({candidate,codec,contracts});},
    async verifyOriginal(bytes,candidate){
      const m=candidate.manifest;const session=await SafeProfileEditSession.open({sourceBytes:bytes,codec,sourcePlatform:m.input.platform,contracts});
      const ctx=session.getPreflightContext();
      if(ctx.saveIdentity.sourceRawSha256!==m.input.originalSha256)throw pcError('PC_ORIGINAL_VERIFICATION_HASH_MISMATCH');
      if(session.source.length!==m.input.originalFileLength)throw pcError('PC_ORIGINAL_VERIFICATION_LENGTH_MISMATCH');
      if(ctx.saveIdentity.profileGameInfoVersion!==m.input.profileGameInfoVersion)throw pcError('PC_ORIGINAL_VERIFICATION_SCHEMA_MISMATCH');
      if(ctx.codecContract!==m.input.codecContract)throw pcError('PC_ORIGINAL_VERIFICATION_CODEC_MISMATCH');
      return Object.freeze({status:'PASS'});
    }
  });
}

async function probeDirectoryFsync(dir){try{await syncDir(dir);}catch(e){throw pcError('PC_DIRECTORY_FSYNC_UNSUPPORTED',e?.code||String(e));}}
async function probeAtomicReplace(dir){
  const tag=`.wand-rename-probe-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const a=path.join(dir,`${tag}.a`),b=path.join(dir,`${tag}.b`);
  try{
    await durableSmall(a,'A');await durableSmall(b,'B');await fs.rename(a,b);await syncDir(dir);const got=await fs.readFile(b,'utf8');if(got!=='A')throw pcError('PC_ATOMIC_REPLACE_PROBE_FAILED');
  }finally{await fs.unlink(a).catch(()=>{});await fs.unlink(b).catch(()=>{});await syncDir(dir).catch(()=>{});}
}
async function durableSmall(p,text){const h=await fs.open(p,'wx',0o600);try{await h.writeFile(text);await h.sync();}finally{await h.close();}}
async function syncDir(dir){const h=await fs.open(dir,'r');try{await h.sync();}finally{await h.close();}}
function isInside(root,p){const rel=path.relative(root,p);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
function pcError(code,detail=''){const e=new Error(detail?`${code}: ${detail}`:code);e.code=code;return e;}