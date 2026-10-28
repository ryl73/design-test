/** Sequential processing limits decoded image and diff memory pressure. */
export const BATCH_PAIR_LIMIT = 20;
export type BatchPair = { key:string; site:File; figma:File };
export type BatchPairIssue = { key:string; kind:'ambiguous'|'missing-site'|'missing-figma'; names:string[] };
export function matchBatchPairs(siteFiles:readonly File[],figmaFiles:readonly File[]):{pairs:BatchPair[];issues:BatchPairIssue[];overflow:number}{
 const groups=new Map<string,{site:File[];figma:File[]}>();
 for(const [side,files] of [['site',siteFiles],['figma',figmaFiles]] as const){
  for(const file of files){
   const key=file.name.replace(/\.[^.]+$/,'').toLowerCase();
   const group=groups.get(key)??{site:[],figma:[]};group[side].push(file);groups.set(key,group);
  }
 }
 const pairs:BatchPair[]=[];const issues:BatchPairIssue[]=[];
 for(const [key,group] of groups){
  const names=[...group.site,...group.figma].map(file=>file.name);
  if(group.site.length>1||group.figma.length>1)issues.push({key,kind:'ambiguous',names});
  else if(!group.site.length)issues.push({key,kind:'missing-site',names});
  else if(!group.figma.length)issues.push({key,kind:'missing-figma',names});
  else pairs.push({key,site:group.site[0]!,figma:group.figma[0]!});
 }
 return {pairs:pairs.slice(0,BATCH_PAIR_LIMIT),issues,overflow:Math.max(0,pairs.length-BATCH_PAIR_LIMIT)};
}
