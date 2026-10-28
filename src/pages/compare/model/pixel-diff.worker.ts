import { checkRectDifferences } from './check-rects';
import type { Rect } from './geometry';
import { groupDifferences } from './diff-regions';
import { comparePixels, type PixelImage } from './pixel-diff';
async function readPixels(url:string):Promise<PixelImage> {
 const response=await fetch(url);
 if(!response.ok) throw new Error('Не удалось прочитать изображение.');
 const bitmap=await createImageBitmap(await response.blob());
 try {
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
  const context=canvas.getContext('2d');
  if(!context) throw new Error('Не удалось создать холст для сравнения.');
  context.drawImage(bitmap,0,0);
  return context.getImageData(0,0,bitmap.width,bitmap.height);
 } finally {bitmap.close();}
}
self.onmessage=async(event:MessageEvent<{site:string;figma:string;threshold:number;includeAA:boolean;minPixels:number;exclusions:Rect[];checks?:Rect[]}>)=>{
 try {
  const {site,figma,threshold,includeAA,minPixels,exclusions,checks}=event.data;
  const [a,b]=await Promise.all([readPixels(site),readPixels(figma)]);
  const result=comparePixels(a,b,threshold,includeAA,exclusions);
  const grouped=groupDifferences(result,minPixels);
  const checked=checks?checkRectDifferences(result,checks,exclusions):undefined;
  const canvas=new OffscreenCanvas(result.width,result.height);
  const context=canvas.getContext('2d');
  if(!context) throw new Error('Не удалось создать подсветку отличий.');
  const pixels=context.createImageData(result.width,result.height);
  pixels.data.set(result.data);context.putImageData(pixels,0,0);
  const blob=await canvas.convertToBlob({type:'image/png'});
  self.postMessage({blob,...(checked?{checks:checked}:{}),count:grouped.count,totalPixels:result.totalPixels,excludedPixels:result.excludedPixels,regions:grouped.regions,hiddenPixels:grouped.hiddenPixels,width:result.width,height:result.height});
 } catch(error) {self.postMessage({error:error instanceof Error?error.message:'Не удалось сравнить изображения.'});}
};
