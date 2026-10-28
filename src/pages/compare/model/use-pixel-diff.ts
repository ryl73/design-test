import { useEffect,useMemo,useState } from 'react';
import type { Rect } from './geometry';
import type { ComparisonImage } from './image-file';
import type { DiffAnalysis } from './automation-types';
import { analyzePair } from './analyze-pair';
type Result={key:object;url?:string;error?:string} & Partial<DiffAnalysis>;
export function usePixelDiff(site:ComparisonImage|undefined,figma:ComparisonImage|undefined,enabled:boolean,threshold:number,includeAA:boolean,minPixels:number,exclusions:readonly Rect[]) {
 const key=useMemo(()=>({site,figma,enabled,threshold,includeAA,minPixels,exclusions}),[site,figma,enabled,threshold,includeAA,minPixels,exclusions]);
 const [result,setResult]=useState<Result>();
 const widthError=site&&figma&&site.width!==figma.width?'Для автоматического сравнения ширины изображений должны совпадать. Высоты могут отличаться.':undefined;
 useEffect(()=>{
  if(!enabled||!site||!figma||site.width!==figma.width)return;
  const controller=new AbortController();let url:string|undefined;
  const timer=window.setTimeout(()=>{
   void analyzePair(site,figma,{threshold,includeAA,minPixels,exclusions},controller.signal).then(analysis=>{
    if(controller.signal.aborted)return;
    url=URL.createObjectURL(analysis.blob);setResult({key,url,...analysis});
   }).catch(error=>{if(!controller.signal.aborted)setResult({key,error:error instanceof Error?error.message:'Не удалось сравнить изображения.'});});
  },200);
  return()=>{window.clearTimeout(timer);controller.abort();if(url)URL.revokeObjectURL(url);};
 },[site,figma,enabled,threshold,includeAA,minPixels,exclusions,key]);
 const current=enabled&&result?.key===key?result:undefined;
 return {result:current,error:widthError??current?.error,loading:enabled&&!widthError&&!current};
}
