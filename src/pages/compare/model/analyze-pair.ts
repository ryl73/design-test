import type { ComparisonImage } from './image-file';
import type { DiffAnalysis,DiffSettings } from './automation-types';
import type { Rect } from './geometry';
export function analyzePair(site:ComparisonImage,figma:ComparisonImage,settings:DiffSettings,signal?:AbortSignal,checks?:readonly Rect[]):Promise<DiffAnalysis> {
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Проверка отменена.','AbortError'));return;}
  if(site.width!==figma.width){reject(new Error('Для автоматического сравнения ширины изображений должны совпадать.'));return;}
  let worker:Worker|undefined;
  const dispose=()=>{worker?.terminate();signal?.removeEventListener('abort',abort);};
  const fail=(error:unknown)=>{dispose();reject(error);};
  const abort=()=>fail(new DOMException('Проверка отменена.','AbortError'));
  try{
   worker=new Worker(new URL('./pixel-diff.worker.ts',import.meta.url),{type:'module'});
   worker.onmessage=(event:MessageEvent<DiffAnalysis & {error?:string}>)=>{
    if(event.data.error){fail(new Error(event.data.error));return;}
    dispose();resolve(event.data);
   };
   worker.onerror=()=>fail(new Error('Не удалось запустить сравнение. Попробуйте ещё раз в современном браузере.'));
   worker.onmessageerror=()=>fail(new Error('Не удалось прочитать результат сравнения.'));
   signal?.addEventListener('abort',abort,{once:true});
   worker.postMessage({site:site.url,figma:figma.url,...settings,checks});
  }catch(error){fail(error);}
 });
}
