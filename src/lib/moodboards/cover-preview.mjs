// Stable local-only preview: never load artwork, network URLs, personal Save or legacy URL references.
// Stage 1 DEC-UX-43 partial cover presentation (not persisted rich collage/DEC-UX-44 acceptance).
const TYPES=new Set(['ITEM','WAND_PRESET','NOTE']);
const EMPTY=Object.freeze({type:'EMPTY',text:''});
const safeText=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,42):'';
export function moodboardCoverTiles(board){
  const references=Array.isArray(board?.references)?board.references:[];
  const tiles=[];
  for(const reference of references){
    if(tiles.length===4)break;
    if(!reference||!TYPES.has(reference.type))continue;
    const text=safeText(reference.type==='NOTE'?(reference.note||reference.label):reference.label);
    if(!text)continue;
    tiles.push(Object.freeze({type:reference.type,text}));
  }
  while(tiles.length<4)tiles.push(EMPTY);
  return Object.freeze(tiles);
}
