import type { ReportPair } from './automation-types';
import { loadEvidenceBitmap } from './image-evidence';
export async function buildAnnotatedPng(pair:ReportPair):Promise<Blob>{
 const site=await loadEvidenceBitmap(pair.site);
 try{
  const mask=await createImageBitmap(pair.analysis.blob);
  try{
   const canvas=document.createElement('canvas');canvas.width=pair.analysis.width;canvas.height=pair.analysis.height;
   const context=canvas.getContext('2d');if(!context)throw new Error('Не удалось создать изображение отчёта.');
   context.fillStyle='#e9edf2';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(site,0,0);
   context.globalAlpha=.75;context.drawImage(mask,0,0);context.globalAlpha=1;
   context.strokeStyle='#a31a41';context.lineWidth=2;
   for(const rect of pair.analysis.regions)context.strokeRect(rect.x,rect.y,rect.width,rect.height);
   context.setLineDash([6,4]);context.strokeStyle='#475569';context.fillStyle='#64748b33';
   for(const rect of pair.settings.exclusions){context.fillRect(rect.x,rect.y,rect.width,rect.height);context.strokeRect(rect.x,rect.y,rect.width,rect.height);}
   return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось сохранить PNG.')),'image/png'));
  }finally{mask.close();}
 }finally{site.close();}
}
