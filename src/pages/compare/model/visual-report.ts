import type { ReportPair } from './automation-types';
import type { ComparisonNote } from './annotations';
import type { Rect } from './geometry';
import { cropBitmapEvidence, loadEvidenceBitmap, safeRasterDataUrl } from './image-evidence';

export const REPORT_CROP_LIMIT=100;
type Crop={kind:'region'|'note';index:number;site:string;figma:string};
export type ReportEvidence={site:string;figma:string;mask:string;crops:Crop[];omitted?:number};
type EvidenceNote=ComparisonNote & {origin?:'AUTO';evidence?:{site:string;figma:string};verification?:'CLEARED'|'REMAINING'|'UNCHECKED'};
const escapeHtml=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const numeric=(value:number)=>Number.isFinite(value)?String(value):'0';
const coordinates=(rect:Rect)=>`${numeric(rect.x)}, ${numeric(rect.y)} · ${numeric(rect.width)} × ${numeric(rect.height)}`;
const imageTag=(value:string,label:string)=>{const safe=safeRasterDataUrl(value);return safe?`<img src="${safe}" alt="${escapeHtml(label)}" loading="lazy">`:'<p class="missing">Нет изображения / вне границ</p>';};
function annotatedImage(value:string,pair:ReportPair,label:string) {
 const regions=pair.analysis.regions.map((r,i)=>({rect:r,label:`Δ${i+1}`,note:false}));
 const notes=pair.notes.map((n,i)=>({rect:n.rect,label:`N${i+1}`,note:true}));
 const boxes=[...regions,...notes].map(({rect,label,note})=>`<span class="box ${note?'note-box':''}" style="left:${numeric(rect.x/pair.analysis.width*100)}%;top:${numeric(rect.y/pair.analysis.height*100)}%;width:${numeric(rect.width/pair.analysis.width*100)}%;height:${numeric(rect.height/pair.analysis.height*100)}%"><b>${label}</b></span>`).join('');
 return `<figure><figcaption>${escapeHtml(label)}</figcaption><div class="annotated" style="aspect-ratio:${numeric(pair.analysis.width)}/${numeric(pair.analysis.height)}">${imageTag(value,label)}${boxes}</div></figure>`;
}

/** Pure renderer also validates every embedded media source, including restored note evidence. */
export function renderHtmlReport(pairs:ReportPair[],evidence:ReportEvidence[]):string {
 const sections=pairs.map((pair,index)=>{
  const media=evidence[index]??{site:'',figma:'',mask:'',crops:[]};
  const cropFor=(kind:Crop['kind'],i:number)=>{const crop=media.crops.find(c=>c.kind===kind&&c.index===i);return crop?`<div class="images crops"><figure><figcaption>Сайт</figcaption>${imageTag(crop.site,'Фрагмент сайта')}</figure><figure><figcaption>Figma</figcaption>${imageTag(crop.figma,'Фрагмент Figma')}</figure></div>`:'';};
  const notes=pair.notes.map((original,i)=>{const note=original as EvidenceNote;return `<li><h4>N${i+1} · ${note.state==='RESOLVED'?'Решено':'Открыто'}${note.origin==='AUTO'?' · AUTO':''}</h4><p class="body">${escapeHtml(note.body)}</p><p>${coordinates(note.rect)}${note.verification?` · ${escapeHtml(note.verification==='CLEARED'?'Совпало при последней проверке':note.verification==='REMAINING'?'Остались отличия':'Не проверено')}`:''}</p>${cropFor('note',i)}</li>`;}).join('');
  return `<section><h2>${index+1}. ${escapeHtml(pair.label)}</h2><p>Сайт: ${escapeHtml(pair.site.name)} (${numeric(pair.site.width)} × ${numeric(pair.site.height)}) · Figma: ${escapeHtml(pair.figma.name)} (${numeric(pair.figma.width)} × ${numeric(pair.figma.height)})</p><p>Отличается пикселей: ${numeric(pair.analysis.count)} / ${numeric(pair.analysis.totalPixels)} · Областей: ${pair.analysis.regions.length} · Исключено пикселей: ${numeric(pair.analysis.excludedPixels)} · Скрыто малых отличий: ${numeric(pair.analysis.hiddenPixels)}</p><h3>Настройки</h3><p>Чувствительность: ${numeric(Math.round((1-pair.settings.threshold)*100))}% · Учитывать сглаживание: ${pair.settings.includeAA?'да':'нет'} · Минимум изменённых пикселей в области: ${numeric(pair.settings.minPixels)}</p><h3>Исключённые зоны (${pair.settings.exclusions.length})</h3><ul>${pair.settings.exclusions.map(r=>`<li>${coordinates(r)}</li>`).join('')}</ul><h3>Скриншоты с областями отличий и замечаний</h3><p>Δ — отличие, N — замечание. Серый фон обозначает отсутствующую часть изображения.</p><div class="images">${annotatedImage(media.site,pair,'Сайт')}${annotatedImage(media.figma,pair,'Figma')}${annotatedImage(media.mask,pair,'Маска отличий')}</div><h3>Области отличий</h3>${media.omitted?`<p class="limit">Фрагменты пропущены: ${media.omitted}. Лимит фрагментов: ${REPORT_CROP_LIMIT} на отчёт. Все координаты сохранены.</p>`:''}<ol>${pair.analysis.regions.map((r,i)=>`<li><h4>Δ${i+1} · ${coordinates(r)}</h4><p>${numeric(r.pixels)} пикселей</p>${cropFor('region',i)}</li>`).join('')}</ol><h3>Замечания (${pair.notes.length})</h3><ol>${notes}</ol><h3>История повторных проверок</h3><table><thead><tr><th>Дата</th><th>Скриншот</th><th>Пикселей</th><th>Областей</th><th>Совпало при проверке</th><th>Осталось</th></tr></thead><tbody>${(pair.history??[]).map(h=>`<tr><td>${escapeHtml(h.at)}</td><td>${escapeHtml(h.siteName)}</td><td>${numeric(h.count)}</td><td>${numeric(h.regions)}</td><td>${numeric(h.cleared)}</td><td>${numeric(h.remaining)}</td></tr>`).join('')}</tbody></table></section>`;
 }).join('');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Отчёт Design QA</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#192534;background:#f4f6f9;margin:0;padding:32px}main{max-width:1400px;margin:auto}section{background:white;padding:24px;margin:24px 0;border:1px solid #ccd3dd;border-radius:12px}h1,h2,h3,h4{line-height:1.25}h3{margin-top:28px}figure{margin:0;min-width:0}figcaption{font-weight:600;margin:8px 0}.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.crops{grid-template-columns:repeat(2,minmax(0,1fr));max-width:900px}img{display:block;max-width:100%;height:auto}.annotated{position:relative;background:#e9edf2;overflow:hidden}.annotated>img{width:100%;height:100%;object-fit:fill}.box{position:absolute;box-sizing:border-box;border:2px solid #df2756;min-width:2px;min-height:2px}.box b{position:absolute;background:#aa173f;color:white;font-size:11px;top:0;left:0;padding:0 2px}.note-box{border-color:#1267ba}.note-box b{background:#1267ba}.body{white-space:pre-wrap;overflow-wrap:anywhere}li{margin:12px 0}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #dce1e8;overflow-wrap:anywhere}.limit,.missing{color:#665023}.limit{background:#fff5d9;padding:12px}@media(max-width:700px){body{padding:10px}section{padding:14px}.images{grid-template-columns:1fr}}@media print{body{padding:0;background:white}section{break-before:page;border:0}li,figure{break-inside:avoid}}</style></head><body><main><h1>Отчёт Design QA</h1><p>Пар изображений: ${pairs.length}. Фрагменты: до ${REPORT_CROP_LIMIT} на весь отчёт, максимум 1024 px по стороне. Изображения встроены в документ.</p>${sections}</main></body></html>`;
}

export async function buildHtmlReport(pairs:ReportPair[]):Promise<Blob> {
 if(!pairs.length)throw new Error('Добавьте хотя бы одну пару для отчёта.');
 const evidence:ReportEvidence[]=[];let remaining=REPORT_CROP_LIMIT;
 for(const pair of pairs){
  const site=await loadEvidenceBitmap(pair.site);
  try{
   const figma=await loadEvidenceBitmap(pair.figma);
   try{
    const mask=await createImageBitmap(pair.analysis.blob);
    try{
     const world={x:0,y:0,width:pair.analysis.width,height:pair.analysis.height};
     const media:ReportEvidence={site:cropBitmapEvidence(site,world,10000),figma:cropBitmapEvidence(figma,world,10000),mask:cropBitmapEvidence(mask,world,10000),crops:[],omitted:0};
     const items=[...pair.analysis.regions.map((rect,index)=>({rect,index,kind:'region' as const})),...pair.notes.map((note,index)=>({rect:note.rect,index,kind:'note' as const}))];
     for(const item of items){
      if(!remaining){media.omitted=(media.omitted??0)+1;continue;}
      const saved=item.kind==='note'?(pair.notes[item.index] as EvidenceNote).evidence:undefined;
      media.crops.push({kind:item.kind,index:item.index,site:safeRasterDataUrl(saved?.site??'')||cropBitmapEvidence(site,item.rect),figma:safeRasterDataUrl(saved?.figma??'')||cropBitmapEvidence(figma,item.rect)});remaining--;
     }
     evidence.push(media);
    }finally{mask.close();}
   }finally{figma.close();}
  }finally{site.close();}
 }
 return new Blob([renderHtmlReport(pairs,evidence)],{type:'text/html;charset=utf-8'});
}

export function downloadBlob(blob:Blob,filename:string):void {
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=filename;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
