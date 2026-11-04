/** Pure source-only 626 browser count gate. No private file or browser input. */
const rec=x=>x!==null && typeof x==='object' && !Array.isArray(x);
export function raw626GridObjectEntries(profile){
  const grids=profile?.World?.GridCollection?.Grids;
  if(!rec(grids))return null;
  let n=0;
  for(const grid of Object.values(grids)){
    if(!rec(grid)||!rec(grid.Objects))return null;
    n+=Object.keys(grid.Objects).length;
    if(!Number.isSafeInteger(n))return null;
  }
  return n;
}
export function evaluate626BrowserCount(rawCount,renderedText,sourceIssueCount){
  if(!Number.isSafeInteger(rawCount)||rawCount<0 ||
     typeof renderedText!=='string' ||
     !/^(0|[1-9][0-9]*)$/.test(renderedText.trim()) ||
     !Number.isSafeInteger(sourceIssueCount)||sourceIssueCount<0)
    return Object.freeze({status:'PARTIAL',reason:'UNRESOLVED_626_SOURCE_COUNT'});
  const parsed=Number(renderedText.trim());
  if(!Number.isSafeInteger(parsed)||parsed!==rawCount)
    return Object.freeze({status:'PARTIAL',reason:'626_BROWSER_RAW_GRIDOBJECT_COUNT_MISMATCH'});
  if(sourceIssueCount!==0)
    return Object.freeze({status:'PARTIAL',reason:'626_NATIVE_REFERENCE_ISSUES_PRESENT'});
  return Object.freeze({status:'SOURCE_ONLY_MATCH',reason:'626_RAW_GRIDOBJECT_ENTRY_COUNT_MATCH'});
}
