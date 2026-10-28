import type { ComparisonImage } from './image-file';
import type { Rect, Size } from './geometry';

/** Only raster data URLs can enter an exported document, including stored note evidence. */
export function safeRasterDataUrl(value: string): string {
 return /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
}

/** Preserve comparison coordinates when one input is shorter. Missing pixels remain blank. */
export function evidenceBounds(size:Size,rect:Rect) {
 if(![size.width,size.height,rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||size.width<1||size.height<1||rect.width<=0||rect.height<=0) throw new Error('Недопустимая область фрагмента.');
 const x=Math.max(0,Math.floor(rect.x)),y=Math.max(0,Math.floor(rect.y));
 const width=Math.ceil(rect.x+rect.width)-x,height=Math.ceil(rect.y+rect.height)-y;
 if(width<1||height<1) throw new Error('Область фрагмента пуста.');
 const scale=Math.min(1,1024/width,1024/height);
 return {x,y,width,height,sourceWidth:Math.max(0,Math.min(width,size.width-x)),sourceHeight:Math.max(0,Math.min(height,size.height-y)),outputWidth:Math.max(1,Math.round(width*scale)),outputHeight:Math.max(1,Math.round(height*scale))};
}

export async function loadEvidenceBitmap(image:ComparisonImage):Promise<ImageBitmap> {
 // Uploaded images are blob URLs. Do not fetch arbitrary remote URLs from restored data.
 if(!image.url.startsWith('blob:')&&!safeRasterDataUrl(image.url)) throw new Error('Источник изображения должен быть локальным PNG или JPEG.');
 const response=await fetch(image.url);
 if(!response.ok)throw new Error('Не удалось прочитать изображение для отчёта.');
 return createImageBitmap(await response.blob());
}

export function cropBitmapEvidence(bitmap:ImageBitmap,rect:Rect,maxSide=1024):string {
 const bounds=evidenceBounds(bitmap,rect);
 const scale=Math.min(1,maxSide/bounds.width,maxSide/bounds.height);
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bounds.width*scale));canvas.height=Math.max(1,Math.round(bounds.height*scale));
 const context=canvas.getContext('2d');if(!context)throw new Error('Не удалось создать фрагмент изображения.');
 context.fillStyle='#e9edf2';context.fillRect(0,0,canvas.width,canvas.height);
 if(bounds.sourceWidth&&bounds.sourceHeight)context.drawImage(bitmap,bounds.x,bounds.y,bounds.sourceWidth,bounds.sourceHeight,0,0,bounds.sourceWidth*scale,bounds.sourceHeight*scale);
 return canvas.toDataURL('image/png');
}

export async function cropImageEvidence(image:ComparisonImage,rect:Rect):Promise<string> {
 evidenceBounds(image,rect);
 const bitmap=await loadEvidenceBitmap(image);
 try{return cropBitmapEvidence(bitmap,rect);}finally{bitmap.close();}
}
