import type { DiffRegion } from './diff-regions';
import type { ComparisonNote } from './annotations';
import type { Rect,Size } from './geometry';
const rectKey=(rect:Rect)=>[rect.x,rect.y,rect.width,rect.height].map(Math.round).join(':');
export function draftAutomaticNotes(regions:DiffRegion[],existing:ComparisonNote[],site:Size,figma:Size,limit=500):ComparisonNote[]{
 const known=new Set(existing.map(note=>rectKey(note.rect))),drafts:ComparisonNote[]=[];
 for(const region of regions){
  if(existing.length+drafts.length>=limit)break;
  const {x,y,width,height,pixels}=region,rect={x,y,width,height},key=rectKey(rect);
  if(known.has(key))continue;
  known.add(key);
  const heightDifference=y+height>Math.min(site.height,figma.height)&&site.height!==figma.height;
  drafts.push({id:crypto.randomUUID(),rect,origin:'AUTO',state:'OPEN',body:`${heightDifference?'Проверить различие высоты изображений':'Проверить визуальное расхождение'}: x=${x}, y=${y}, область ${width} × ${height} px, изменено ${pixels} пикселей. Причину необходимо проверить вручную.`});
 }
 return drafts;
}
export function verifyNotes(notes:ComparisonNote[],counts:number[]):ComparisonNote[]{
 return notes.map((note,index)=>note.state==='RESOLVED'?note:{...note,verification:counts[index]===undefined||counts[index]!<0?'UNCHECKED':counts[index]===0?'CLEARED':'REMAINING'});
}
