import type { PixelImage } from './pixel-diff';
import type { Rect } from './geometry';
import { normalizeExcludedZone } from './excluded-zones';
// Evaluate integral-image corner queries using one row of prefix totals, keeping
// memory proportional to width, even with hundreds of notes on long screenshots.
export function checkRectDifferences(image:PixelImage,rects:readonly Rect[],exclusions:readonly Rect[]):number[]{
 const counts=rects.map(()=>0),excluded=rects.map(()=>0),areas=rects.map(()=>0);
 const events:{x:number;y:number;index:number;sign:number}[]=[];
 rects.forEach((rect,index)=>{
  const normalized=normalizeExcludedZone(rect,image);
  if(!normalized||rect.x<0||rect.y<0||rect.x+rect.width>image.width||rect.y+rect.height>image.height){counts[index]=-1;return;}
  const {x,y,width,height}=normalized;areas[index]=width*height;
  for(const [cx,cy,sign] of [[x,y,1],[x+width,y,-1],[x,y+height,-1],[x+width,y+height,1]])if(cx&&cy)events.push({x:cx!,y:cy!,index,sign:sign!});
 });
 events.sort((a,b)=>a.y-b.y);
 const zones=exclusions.map(zone=>normalizeExcludedZone(zone,image)).filter((zone):zone is Rect=>zone!==null);
 const prefix=new Uint32Array(image.width+1),excludedPrefix=new Uint32Array(image.width+1),rowMask=new Uint8Array(image.width);
 let eventIndex=0;
 for(let y=0;y<image.height&&eventIndex<events.length;y++){
  rowMask.fill(0);
  for(const zone of zones)if(y>=zone.y&&y<zone.y+zone.height)rowMask.fill(1,zone.x,zone.x+zone.width);
  let rowCount=0,rowExcluded=0;
  for(let x=0;x<image.width;x++){
   if(image.data[(y*image.width+x)*4+3])rowCount++;
   rowExcluded+=rowMask[x]!;
   prefix[x+1]=prefix[x+1]!+rowCount;excludedPrefix[x+1]=excludedPrefix[x+1]!+rowExcluded;
  }
  while(eventIndex<events.length&&events[eventIndex]!.y===y+1){
   const event=events[eventIndex++]!;
   counts[event.index]=counts[event.index]!+event.sign*prefix[event.x]!;
   excluded[event.index]=excluded[event.index]!+event.sign*excludedPrefix[event.x]!;
  }
 }
 return counts.map((count,index)=>count<0||excluded[index]===areas[index]?-1:count);
}
