import { useEffect, useRef, useState } from 'react';
import type { DiffSettings, ReportPair } from '../model/automation-types';
import { analyzePair } from '../model/analyze-pair';
import { BATCH_PAIR_LIMIT, matchBatchPairs, type BatchPair } from '../model/batch-pairs';
import { loadImageFile, releaseImage, type ComparisonImage } from '../model/image-file';
import { buildHtmlReport, downloadBlob } from '../model/visual-report';
import './batch.css';
type BatchResult={pair:BatchPair;status:'pending'|'running'|'success'|'error'|'cancelled';report?:ReportPair;error?:string};
export function BatchComparison({settings,onOpen}:{settings:DiffSettings;onOpen:(site:File,figma:File)=>void}){
 const [siteFiles,setSiteFiles]=useState<File[]>([]);const [figmaFiles,setFigmaFiles]=useState<File[]>([]);
 const [results,setResults]=useState<BatchResult[]>([]);const [running,setRunning]=useState(false);const [exporting,setExporting]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const owned=useRef<ComparisonImage[]>([]);const controller=useRef<AbortController|null>(null);const mounted=useRef(false);const generation=useRef(0);
 const matches=matchBatchPairs(siteFiles,figmaFiles);
 function releaseResults(){owned.current.forEach(releaseImage);owned.current=[];}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;controller.current?.abort();owned.current.forEach(releaseImage);owned.current=[];};},[]);
 function reset(){releaseResults();setResults([]);setMessage('');setError('');}
 function choose(side:'site'|'figma',files:File[]){reset();if(side==='site')setSiteFiles(files);else setFigmaFiles(files);}
 async function run(){
  if(running||!matches.pairs.length)return;
  reset();const current=++generation.current;const abort=new AbortController();controller.current=abort;
  const active=()=>mounted.current&&generation.current===current;
  const batchSettings:DiffSettings={...settings,exclusions:[]};
  const rows:BatchResult[]=matches.pairs.map(pair=>({pair,status:'pending'}));
  const update=()=>{if(active())setResults([...rows]);};
  setRunning(true);update();let completed=0;
  try{
   for(let index=0;index<rows.length;index++){
    if(abort.signal.aborted||!active())break;
    const row=rows[index]!;rows[index]={...row,status:'running'};update();
    let site:ComparisonImage|undefined;let figma:ComparisonImage|undefined;
    try{
     site=await loadImageFile(row.pair.site);
     if(abort.signal.aborted||!active())break;
     figma=await loadImageFile(row.pair.figma);
     if(abort.signal.aborted||!active())break;
     const analysis=await analyzePair(site,figma,batchSettings,abort.signal);
     if(abort.signal.aborted||!active())break;
     const report:ReportPair={label:row.pair.key,site,figma,analysis,settings:batchSettings,notes:[]};
     owned.current.push(site,figma);site=undefined;figma=undefined;
     rows[index]={...row,status:'success',report};completed++;
    }catch(cause){
     if(abort.signal.aborted||!active())break;
     rows[index]={...row,status:'error',error:cause instanceof Error?cause.message:'Не удалось сравнить эту пару.'};completed++;
    }finally{if(site)releaseImage(site);if(figma)releaseImage(figma);}
    update();
   }
  }finally{
   if(active()){
    if(abort.signal.aborted){for(let index=0;index<rows.length;index++)if(rows[index]!.status==='pending'||rows[index]!.status==='running')rows[index]={...rows[index]!,status:'cancelled'};}
    update();setRunning(false);setMessage(abort.signal.aborted?`Проверка отменена. Обработано ${completed} из ${rows.length}.`:`Проверка завершена. Обработано ${completed} из ${rows.length}.`);controller.current=null;
   }
  }
 }
 async function exportReport(){
  const reports=results.flatMap(row=>row.report?[row.report]:[]);if(!reports.length||running||exporting)return;
  const current=generation.current;setExporting(true);setError('');
  try{const blob=await buildHtmlReport(reports);if(mounted.current&&generation.current===current)downloadBlob(blob,'design-qa-batch-report.html');}
  catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'Не удалось создать отчёт.');}
  finally{if(mounted.current)setExporting(false);}
 }
 const successful=results.filter(row=>row.status==='success').length;const failed=results.filter(row=>row.status==='error').length;
 const finished=successful+failed;const busy=running||exporting;
 return <section className="batch-comparison" aria-labelledby="batch-title">
  <div className="batch-heading"><div><h2 id="batch-title">Пакетная проверка</h2><p>Несколько страниц и разрешений за один запуск.</p></div><span className="batch-limit">До {BATCH_PAIR_LIMIT} пар</span></div>
  <p className="batch-help">Имена файлов без расширения должны совпадать: например, home-1440.png и home-1440.jpg. Включайте ширину в имя, чтобы различать разрешения.</p>
  <div className="batch-pickers"><label>Скриншоты сайта<input aria-label="Скриншоты сайта для пакета" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple disabled={busy} onChange={event=>choose('site',Array.from(event.currentTarget.files??[]))}/><small>Выбрано: {siteFiles.length}</small></label><label>Макеты из Figma<input aria-label="Макеты Figma для пакета" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple disabled={busy} onChange={event=>choose('figma',Array.from(event.currentTarget.files??[]))}/><small>Выбрано: {figmaFiles.length}</small></label></div>
  <p className="batch-help">Чувствительность, сглаживание и минимальная область берутся из текущих настроек. Координатные исключения текущей пары не применяются к пакетной проверке. Пары обрабатываются последовательно в браузере.</p>
  {(siteFiles.length>0||figmaFiles.length>0)&&<div className="batch-matching"><strong>Готово к проверке: {matches.pairs.length} пар</strong>{matches.overflow>0&&<p role="alert">Лимит — {BATCH_PAIR_LIMIT} пар за запуск. Ещё {matches.overflow} пар не будут проверены. Выберите их отдельным пакетом.</p>}{matches.issues.length>0&&<><p>Следующие файлы пропущены:</p><ul>{matches.issues.map(issue=><li key={issue.key}><b>{issue.key}</b> — {issue.kind==='ambiguous'?'неоднозначное имя: несколько файлов с одинаковым именем без расширения':issue.kind==='missing-site'?'нет скриншота сайта':'нет макета Figma'}<span>{issue.names.join(', ')}</span></li>)}</ul></>}{matches.pairs.length>0&&<details><summary>Подобранные пары ({matches.pairs.length})</summary><ul>{matches.pairs.map(pair=><li key={pair.key}>{pair.site.name} ↔ {pair.figma.name}</li>)}</ul></details>}</div>}
  <div className="batch-actions"><button className="primary" disabled={busy||!matches.pairs.length} onClick={()=>void run()}>Проверить пакет</button>{running&&<button onClick={()=>controller.current?.abort()}>Отменить пакет</button>}<button disabled={busy||!successful} onClick={()=>void exportReport()}>{exporting?'Готовим отчёт…':'Скачать отчёт пакета'}</button>{results.length>0&&<button disabled={busy} onClick={reset}>Очистить результаты</button>}</div>
  <div className="batch-progress" role="status" aria-live="polite">{running?`Проверка ${Math.min(finished+1,results.length)} из ${results.length}. Готово: ${successful}, ошибок: ${failed}.`:message}{!running&&results.length>0&&<span>Успешно: {successful} · Ошибок: {failed}</span>}</div>
  {running&&<progress aria-label="Прогресс пакетной проверки" max={results.length} value={finished}/>}
  {error&&<p role="alert">{error}</p>}
  {results.length>0&&<ol className="batch-results">{results.map(row=><li key={row.pair.key} data-status={row.status}><div><strong>{row.pair.key}</strong><span>{row.pair.site.name} ↔ {row.pair.figma.name}</span>{row.status==='success'&&row.report?<p>Отличий: {row.report.analysis.count.toLocaleString('ru-RU')} px · Областей: {row.report.analysis.regions.length} · {row.report.analysis.width} × {row.report.analysis.height} px</p>:<p>{row.status==='running'?'Проверяется…':row.status==='pending'?'Ожидает проверки':row.status==='cancelled'?'Отменено':`Ошибка: ${row.error}`}</p>}</div><button disabled={busy} aria-label={`Открыть пару ${row.pair.key}`} onClick={()=>onOpen(row.pair.site,row.pair.figma)}>Открыть пару</button></li>)}</ol>}
 </section>;
}
