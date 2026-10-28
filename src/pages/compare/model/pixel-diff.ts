import { maskExcludedZones } from './excluded-zones';
import type { Rect } from './geometry';
import pixelmatch from 'pixelmatch';
export type PixelImage = { width:number; height:number; data:Uint8ClampedArray };
export function comparePixels(site:PixelImage,figma:PixelImage,threshold:number,includeAA:boolean,exclusions:readonly Rect[]=[]):PixelImage & {count:number;excludedPixels:number;totalPixels:number} {
 if(site.width!==figma.width) throw new Error('Для автоматического сравнения ширины изображений должны совпадать.');
 const width=site.width,height=Math.max(site.height,figma.height),sharedHeight=Math.min(site.height,figma.height);
 const sharedBytes=width*sharedHeight*4;
 const data=new Uint8ClampedArray(width*height*4);
 let count=pixelmatch(site.data.subarray(0,sharedBytes),figma.data.subarray(0,sharedBytes),data.subarray(0,sharedBytes),width,sharedHeight,{threshold,includeAA,diffMask:true,diffColor:[255,0,80]});
 // A missing row is always a difference, even when its pixels are white or transparent.
 for(let offset=sharedBytes;offset<data.length;offset+=4) {data[offset]=255;data[offset+2]=80;data[offset+3]=255;}
 count+=width*(height-sharedHeight);
 const {excludedPixels,removedDifferences}=maskExcludedZones({width,height,data},exclusions);
 return {width,height,data,count:count-removedDifferences,excludedPixels,totalPixels:width*height-excludedPixels};
}
