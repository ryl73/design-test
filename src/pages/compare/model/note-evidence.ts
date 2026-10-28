import type { ComparisonNote } from './annotations';
import type { ComparisonImage } from './image-file';
import { cropBitmapEvidence,loadEvidenceBitmap } from './image-evidence';
export async function attachNoteEvidence(notes:ComparisonNote[],site:ComparisonImage,figma:ComparisonImage,signal:AbortSignal):Promise<ComparisonNote[]>{
 const siteBitmap=await loadEvidenceBitmap(site);
 try{
  const figmaBitmap=await loadEvidenceBitmap(figma);
  try{
   const result:ComparisonNote[]=[];
   for(let index=0;index<notes.length;index++){
    if(signal.aborted)throw new DOMException('Создание замечаний отменено.','AbortError');
    const note=notes[index]!;
    result.push({...note,evidence:{site:cropBitmapEvidence(siteBitmap,note.rect,320),figma:cropBitmapEvidence(figmaBitmap,note.rect,320)}});
    if(index%10===9)await new Promise(resolve=>setTimeout(resolve,0));
   }
   return result;
  }finally{figmaBitmap.close();}
 }finally{siteBitmap.close();}
}
