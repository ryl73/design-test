import type { Rect,Size } from './geometry';
import type { PixelImage } from './pixel-diff';
export type ExcludedZone = Rect & { id:string };
export function normalizeExcludedZone(rect:Rect,size:Size):Rect|null {
 if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
 const x=Math.max(0,Math.floor(rect.x)),y=Math.max(0,Math.floor(rect.y));
 const right=Math.min(size.width,Math.ceil(rect.x+rect.width)),bottom=Math.min(size.height,Math.ceil(rect.y+rect.height));
 return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
}
/** Merge intervals per row, so overlapping zones do not double-count area or differences. */
export function maskExcludedZones(image:PixelImage,zones:readonly Rect[]) {
 const normalized=zones.map(zone=>normalizeExcludedZone(zone,image)).filter((zone):zone is Rect=>zone!==null);
 let excludedPixels=0,removedDifferences=0;
 if(!normalized.length)return {excludedPixels,removedDifferences};
 const startY=Math.min(...normalized.map(zone=>zone.y)),endY=Math.max(...normalized.map(zone=>zone.y+zone.height));
 for(let y=startY;y<endY;y++){
  const intervals=normalized.filter(zone=>y>=zone.y&&y<zone.y+zone.height).map(zone=>[zone.x,zone.x+zone.width] as const).sort((a,b)=>a[0]-b[0]);
  let previousRight=0;
  for(const [left,right] of intervals){
   const start=Math.max(left,previousRight);previousRight=Math.max(previousRight,right);
   if(start>=right)continue;
   excludedPixels+=right-start;
   for(let x=start;x<right;x++){
    const alpha=(y*image.width+x)*4+3;
    if(image.data[alpha])removedDifferences++;
    image.data[alpha]=0;
   }
  }
 }
 return {excludedPixels,removedDifferences};
}
