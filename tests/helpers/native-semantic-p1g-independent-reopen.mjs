// Fresh Node process validates independently encoded PUBLIC SYNTHETIC P1G.
// No actual private Save or filename is ever printed.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {p1gPackagedProfileCodec} from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const [path,oldSha,oldBytesSha] = process.argv.slice(2);
const deny=()=>{process.stderr.write('SYNTHETIC_P1G_INDEPENDENT_REOPEN_DENIED\n');process.exit(12)};
if(!path||!/^[0-9a-f]{64}$/.test(oldSha??'')||
   !/^[0-9a-f]{64}$/.test(oldBytesSha??''))deny();
const sha=b=>createHash('sha256').update(b).digest('hex');
try {
 const ciphertext=new Uint8Array(await readFile(path));
 if(sha(ciphertext)!==oldBytesSha)deny();
 const opened=await p1gPackagedProfileCodec.loadProfile(ciphertext);
 const root=JSON.parse(opened.jsonText);
 const inventory=root.Player?.ListInventories?.['4']?.Inventory?.['30000001']?.Amount;
 const chest=root.Player?.ContainerInventories?.['12']?.Inventory?.[0]?.Amount;
 if(root.GameInfo.Version!==626||inventory!==49||chest!==11||
    root.Player.ListInventories['4'].Inventory['30000001'].Unknown?.future!==true||
    root.Other?.OriginalUnknown!==true||
    sha(opened.jsonText)===oldSha)deny();
 process.stdout.write('INDEPENDENT_FRESH_NODE_P1G_ZIP_CRC_REOPEN_SEMANTIC_AMOUNT_49_11_PASS\n');
}catch{deny()}
