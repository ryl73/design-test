import { BatchComparison } from './BatchComparison';
import { AutomationControls } from './AutomationControls';
import { draftAutomaticNotes } from '../model/automatic-notes';
import { attachNoteEvidence } from '../model/note-evidence';
import { buildHtmlReport,downloadBlob } from '../model/visual-report';
import { buildAnnotatedPng } from '../model/annotated-png';
import type { DiffAnalysis,ReportPair } from '../model/automation-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePixelDiff } from '../model/use-pixel-diff';
import { normalizeExcludedZone, type ExcludedZone } from '../model/excluded-zones';
import { useComparison } from '../model/use-comparison';
import { clampZoom, fitCamera, type Camera, type ComparisonMode, type Rect, type Size } from '../model/geometry';
import { createReport, validateNoteRect } from '../model/annotations';
import { ImagePicker } from './ImagePicker';
import { ComparisonView } from './ComparisonView';
import { CompareToolbar } from './CompareToolbar';
import { ComparisonCanvas } from './ComparisonCanvas';
import { ExclusionControls } from './ExclusionControls';
import { DiffControls } from './DiffControls';
import { NotesPanel } from './NotesPanel';
import './compare.css';
const EMPTY_EXCLUSIONS:ExcludedZone[]=[];
export function ComparePage(){
 const model=useComparison();const {site,figma}=model.images;const ready=!!(site&&figma);
 const [mode,setMode]=useState<ComparisonMode>('overlay');const [camera,setCamera]=useState<Camera>({center:{x:0,y:0},zoom:1});const [tool,setTool]=useState<'pan'|'draw'|'exclude'>('pan');const [opacity,setOpacity]=useState(50);const [divider,setDivider]=useState(50);const [draft,setDraft]=useState<Rect|null>(null);const [selected,setSelected]=useState<string>();const [error,setError]=useState('');
 const [threshold,setThreshold]=useState(10);const [includeAA,setIncludeAA]=useState(false);
 const [minPixels,setMinPixels]=useState(12);
 const [exclusionState,setExclusionState]=useState<{revision:number;zones:ExcludedZone[]}>({revision:model.pairRevision,zones:[]});
 const exclusions=exclusionState.revision===model.pairRevision?exclusionState.zones:EMPTY_EXCLUSIONS;
 const diff=usePixelDiff(site,figma,ready&&mode==='diff',threshold/100,includeAA,minPixels,exclusions);
 const settings=useMemo(()=>({threshold:threshold/100,includeAA,minPixels,exclusions}),[threshold,includeAA,minPixels,exclusions]);
 const [automationBusy,setAutomationBusy]=useState(false),[automationMessage,setAutomationMessage]=useState('');
 const automationController=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{automationController.current?.abort();setAutomationBusy(false);setAutomationMessage('');return()=>automationController.current?.abort();},[site,figma,settings]);
 useEffect(()=>{model.cancelRecheck();model.setNotes(previous=>previous.some(note=>note.verification)?previous.map(note=>({...note,verification:'UNCHECKED' as const})):previous);},[settings]);
 const [regionSelection,setRegionSelection]=useState<{key:object;index:number}>();
 const regions=diff.result?.regions;
 const activeIndex=diff.result&&regionSelection?.key===diff.result.key?regionSelection.index:-1;
 const activeRegion=regions?.[activeIndex];
 const viewport=useRef<Size>({width:1,height:1}); const fittedRevision=useRef(-1);
 const fit=useCallback(()=>{if(site&&figma&&viewport.current.width>1)setCamera(fitCamera({width:Math.max(site.width,figma.width),height:Math.max(site.height,figma.height)},viewport.current));},[site,figma]);
 const measure=useCallback((size:Size)=>{viewport.current=size;if(fittedRevision.current!==model.revision&&size.width>1){fittedRevision.current=model.revision;fit();}},[fit,model.revision]);
 useEffect(()=>{setDraft(null);setSelected(undefined);setError('');setTool(value=>value==='exclude'?'pan':value);},[model.revision]);
 useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){setDraft(null);setTool(value=>value==='exclude'?'pan':value);}};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[]);
 function focusRect(rect:Rect){
  const focused=fitCamera({width:rect.width+64,height:rect.height+64},viewport.current);
  setCamera({...focused,center:{x:rect.x+rect.width/2,y:rect.y+rect.height/2}});
 }
 function addExclusion(rect:Rect){
  if(!site||!figma)return;
  if(exclusions.length>=100){setError('Достигнут лимит: 100 исключаемых зон.');return;}
  const normalized=normalizeExcludedZone(rect,{width:Math.max(site.width,figma.width),height:Math.max(site.height,figma.height)});
  if(!normalized)return;
  setExclusionState({revision:model.pairRevision,zones:[...exclusions,{...normalized,id:crypto.randomUUID()}]});
  setTool('pan');setError('');
 }
 function navigateRegion(step:number){
  if(!diff.result||!regions?.length)return;
  const index=activeIndex<0?(step>0?0:regions.length-1):(activeIndex+step+regions.length)%regions.length;
  const region=regions[index]!;
  focusRect(region);
  setRegionSelection({key:diff.result.key,index});
 }
 async function createAutomaticNotes(){
  if(!site||!figma||!regions?.length||automationBusy)return;
  const drafts=draftAutomaticNotes(regions,model.notes,site,figma);
  if(!drafts.length){setAutomationMessage(model.notes.length>=500?'Достигнут лимит: 500 замечаний.':'Для найденных областей уже есть замечания.');return;}
  const controller=new AbortController();automationController.current?.abort();automationController.current=controller;
  setAutomationBusy(true);setAutomationMessage('Готовим фрагменты и черновики…');
  try{
   const notes=await attachNoteEvidence(drafts,site,figma,controller.signal);
   if(controller.signal.aborted)return;
   model.setNotes(previous=>[...previous,...notes.filter(note=>!previous.some(old=>old.rect.x===note.rect.x&&old.rect.y===note.rect.y&&old.rect.width===note.rect.width&&old.rect.height===note.rect.height)).slice(0,Math.max(0,500-previous.length))]);
   setAutomationMessage(`Создано черновиков: ${notes.length}. Проверьте текст и фрагменты.`);
  }catch(error){if(!controller.signal.aborted)setAutomationMessage(error instanceof Error?error.message:'Не удалось создать черновики.');}
  finally{if(automationController.current===controller)setAutomationBusy(false);}
 }
 function currentReportPair():ReportPair|undefined{
  if(!site||!figma||!diff.result?.blob)return;
  return {label:`${site.name} — ${figma.name}`,site,figma,analysis:diff.result as DiffAnalysis,settings,notes:model.notes,history:model.history};
 }
 async function exportVisualReport(png=false){
  const pair=currentReportPair();if(!pair||automationBusy)return;
  const controller=new AbortController();automationController.current?.abort();automationController.current=controller;
  setAutomationBusy(true);setAutomationMessage('Готовим отчёт…');
  try{
   const blob=png?await buildAnnotatedPng(pair):await buildHtmlReport([pair]);
   if(!controller.signal.aborted){downloadBlob(blob,png?'design-qa-highlight.png':'design-qa-report.html');setAutomationMessage('Отчёт готов.');}
  }catch(error){if(!controller.signal.aborted)setAutomationMessage(error instanceof Error?error.message:'Не удалось сохранить отчёт.');}
  finally{if(automationController.current===controller)setAutomationBusy(false);}
 }
 function exportNotes(){if(!site||!figma)return;const blob=new Blob([JSON.stringify(createReport(site,figma,model.notes,new Date().toISOString()),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='design-qa-notes.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <main><header><div className="brand"><span className="brand-mark">DQ</span><div><h1>Design QA</h1><p>Сравнение скриншотов</p></div></div><span className="local-badge">Локально на вашем компьютере</span><button onClick={()=>model.clear()}>Новая пара</button></header><div className="page-intro"><p>Сравнение изображений</p><span>Файлы обрабатываются в браузере и никуда не отправляются.</span></div><details className="batch-disclosure"><summary>Пакетная проверка страниц</summary><BatchComparison settings={settings} onOpen={(siteFile,figmaFile)=>{void model.choosePair(siteFile,figmaFile).then(opened=>{if(opened)setMode('diff');});}}/></details><div className="pickers"><ImagePicker label="Скриншот сайта" image={site} error={model.errors.site} loading={model.loading.site} onFile={file=>void model.choose('site',file)} onClear={()=>model.clear('site')}/><ImagePicker label="Макет из Figma" image={figma} error={model.errors.figma} loading={model.loading.figma} onFile={file=>void model.choose('figma',file)} onClear={()=>model.clear('figma')}/></div>{ready&&(site.width!==figma.width||site.height!==figma.height)&&<p className="notice">Размеры отличаются. Изображения выровнены по левому верхнему углу без растяжения; за их границами показана штриховка.</p>}<ComparisonView ready={ready} toolbar={<CompareToolbar disabled={!ready} mode={mode} setMode={value=>{setMode(value);setDraft(null);setTool(current=>current==='exclude'?'pan':current);}} camera={camera} setZoom={zoom=>setCamera(value=>({...value,zoom:clampZoom(zoom)}))} fit={fit} tool={tool} setTool={setTool} opacity={opacity} setOpacity={setOpacity} divider={divider} setDivider={setDivider}/> }>{mode==='diff'&&ready&&<fieldset disabled={model.rechecking} className="automation-settings"><DiffControls threshold={threshold} setThreshold={setThreshold} includeAA={includeAA} setIncludeAA={setIncludeAA} minPixels={minPixels} setMinPixels={setMinPixels} loading={diff.loading} error={diff.error} count={diff.result?.count} totalPixels={diff.result?.totalPixels??Math.max(site.height,figma.height)*site.width} hiddenPixels={diff.result?.hiddenPixels??0} regionCount={regions?.length??0} activeIndex={activeIndex} onNavigate={navigateRegion} activeBounds={activeRegion}/><ExclusionControls zones={exclusions} drawing={tool==='exclude'} activeRegion={activeRegion} onDraw={()=>{setTool(value=>value==='exclude'?'pan':'exclude');setDraft(null);}} onAdd={addExclusion} onRemove={id=>setExclusionState({revision:model.pairRevision,zones:exclusions.filter(zone=>zone.id!==id)})} onClear={()=>setExclusionState({revision:model.pairRevision,zones:[]})} onFocus={focusRect} excludedPixels={diff.result?.excludedPixels}/></fieldset>}{mode==='diff'&&ready&&<AutomationControls canDraft={!!regions?.length&&model.notes.length<500} canExport={!!diff.result?.blob} busy={automationBusy} rechecking={model.rechecking} history={model.history} message={automationMessage} onDraft={()=>void createAutomaticNotes()} onHtml={()=>void exportVisualReport()} onPng={()=>void exportVisualReport(true)} onRecheck={file=>{setTool('pan');void model.recheck(file,settings);}}/>}<div className="workspace"><section className="canvas-shell">{ready?<ComparisonCanvas exclusions={exclusions} onExclude={addExclusion} diffRegions={regions} activeRegion={activeRegion} diff={diff.result?.url?{url:diff.result.url,width:diff.result.width!,height:diff.result.height!}:undefined} site={site} figma={figma} mode={mode} camera={camera} setCamera={setCamera} tool={tool} opacity={opacity} divider={divider} setDivider={setDivider} onMeasure={measure} notes={model.notes} selected={selected} onRect={rect=>{if(model.notes.length>=500){setError('Достигнут лимит: 500 замечаний.');return;}setDraft(rect);setError('');}}/>:<div className="empty-canvas"><span className="empty-symbol">▧</span><h2>Начните с двух изображений</h2><p>Выберите скриншот сайта и PNG или JPEG из Figma.<br/>Для точного сравнения экспортируйте макет в масштабе 1×.</p></div>}<div className="canvas-footer"><span>{ready?'Space — перемещение · Колесо — масштаб':'PNG / JPEG · Исходные размеры сохраняются'}</span><span>{Math.round(camera.zoom*100)}%</span></div>{error&&<p role="alert">{error}</p>}</section><NotesPanel key={model.revision} notes={model.notes} draft={draft} selected={selected} onCancel={()=>setDraft(null)} onSave={body=>{if(!draft||!site)return;validateNoteRect(draft,site);if(model.notes.length>=500)throw Error('Достигнут лимит: 500 замечаний.');const id=crypto.randomUUID();model.setNotes(notes=>[...notes,{id,rect:draft,body,state:'OPEN'}]);setSelected(id);setDraft(null);}} onSelect={note=>{setSelected(note.id);setCamera(value=>({...value,center:{x:note.rect.x+note.rect.width/2,y:note.rect.y+note.rect.height/2}}));}} onUpdate={note=>model.setNotes(notes=>notes.map(value=>value.id===note.id?note:value))} onDelete={id=>model.setNotes(notes=>notes.filter(note=>note.id!==id))}/></div></ComparisonView><footer><p>Сессия хранится только в памяти вкладки. После закрытия или перезагрузки выберите файлы снова. JSON-экспорт содержит замечания без изображений. HTML-отчёт включает фрагменты и подсветку.</p><button className="primary" disabled={!ready||!model.notes.length} onClick={()=>{try{exportNotes();}catch(error){setError(error instanceof Error?error.message:'Не удалось выгрузить замечания.');}}}>Скачать замечания</button></footer></main>;
}
