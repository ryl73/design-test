import { useEffect,useRef,useState } from 'react';
import { loadImageFile,releaseImage,type ComparisonImage } from './image-file';
import type { ComparisonNote } from './annotations';
import { analyzePair } from './analyze-pair';
import { verifyNotes } from './automatic-notes';
import type { CheckHistoryEntry,DiffSettings } from './automation-types';
export type Slot='site'|'figma';
export function useComparison(){
 const [images,setImages]=useState<Partial<Record<Slot,ComparisonImage>>>({});
 const current=useRef(images),generation=useRef({site:0,figma:0});
 const alive=useRef(true),pendingCheck=useRef<AbortController|undefined>(undefined);
 const [notes,setNotes]=useState<ComparisonNote[]>([]),notesRef=useRef(notes);
 const [errors,setErrors]=useState<Partial<Record<Slot,string|undefined>>>({});
 const [loading,setLoading]=useState<Partial<Record<Slot,boolean>>>({});
 const [revision,setRevision]=useState(0),[pairRevision,setPairRevision]=useState(0);
 const [history,setHistory]=useState<CheckHistoryEntry[]>([]),[rechecking,setRechecking]=useState(false);
 useEffect(()=>{notesRef.current=notes;},[notes]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pendingCheck.current?.abort();generation.current.site++;generation.current.figma++;Object.values(current.current).forEach(releaseImage);current.current={};};},[]);
 useEffect(()=>{if(!notes.length)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[notes.length]);
 function publish(next:typeof images,preserve=false){
  const previous=current.current;current.current=next;setImages(next);setRevision(value=>value+1);
  if(!preserve){setNotes([]);setHistory([]);setPairRevision(value=>value+1);}
  requestAnimationFrame(()=>Object.values(previous).filter(image=>!Object.values(next).includes(image)).forEach(releaseImage));
 }
 async function choose(slot:Slot,file:File){
  pendingCheck.current?.abort();const request=++generation.current[slot];setLoading(value=>({...value,[slot]:true}));setErrors(value=>({...value,[slot]:undefined}));
  try{
   const candidate=await loadImageFile(file);
   if(!alive.current||request!==generation.current[slot]){releaseImage(candidate);return false;}
   if(notesRef.current.length&&!window.confirm('Заменить изображение и удалить все замечания?')){releaseImage(candidate);return false;}
   publish({...current.current,[slot]:candidate});return true;
  }catch(error){if(alive.current&&request===generation.current[slot])setErrors(value=>({...value,[slot]:error instanceof Error?error.message:'Не удалось прочитать файл.'}));return false;}
  finally{if(alive.current&&request===generation.current[slot])setLoading(value=>({...value,[slot]:false}));}
 }
 async function choosePair(siteFile:File,figmaFile:File){
  pendingCheck.current?.abort();const siteRequest=++generation.current.site,figmaRequest=++generation.current.figma;
  setLoading({site:true,figma:true});setErrors({});
  const decoded=await Promise.allSettled([loadImageFile(siteFile),loadImageFile(figmaFile)]);
  const valid=alive.current&&siteRequest===generation.current.site&&figmaRequest===generation.current.figma;
  try{
   if(!valid)return false;
   const [site,figma]=decoded;
   if(site!.status==='rejected'||figma!.status==='rejected'){
    setErrors({...(site!.status==='rejected'?{site:site.reason instanceof Error?site.reason.message:'Не удалось прочитать файл.'}:{}),...(figma!.status==='rejected'?{figma:figma.reason instanceof Error?figma.reason.message:'Не удалось прочитать файл.'}:{})});return false;
   }
   if(notesRef.current.length&&!window.confirm('Открыть другую пару и удалить текущие замечания?'))return false;
   publish({site:site!.value,figma:figma!.value});return true;
  }finally{
   for(const result of decoded)if(result.status==='fulfilled'&&!Object.values(current.current).includes(result.value))releaseImage(result.value);
   if(alive.current){if(siteRequest===generation.current.site)setLoading(value=>({...value,site:false}));if(figmaRequest===generation.current.figma)setLoading(value=>({...value,figma:false}));}
  }
 }
 async function recheck(file:File,settings:DiffSettings){
  const reference=current.current.figma;if(!reference)return false;
  pendingCheck.current?.abort();const controller=new AbortController();pendingCheck.current=controller;
  const request=++generation.current.site,snapshot=notesRef.current;
  setRechecking(true);setLoading(value=>({...value,site:true}));setErrors(value=>({...value,site:undefined}));
  let candidate:ComparisonImage|undefined,committed=false;
  try{
   candidate=await loadImageFile(file);
   if(!alive.current||controller.signal.aborted||request!==generation.current.site||current.current.figma!==reference)return false;
   const analysis=await analyzePair(candidate,reference,settings,controller.signal,snapshot.map(note=>note.rect));
   if(!alive.current||controller.signal.aborted||request!==generation.current.site||current.current.figma!==reference)return false;
   const counts=new Map(snapshot.map((note,index)=>[note.id,analysis.checks?.[index]??-1]));
   const creationBounds={width:Math.max(current.current.site?.width??0,reference.width),height:Math.max(current.current.site?.height??0,reference.height)};
   const verified=verifyNotes(notesRef.current,notesRef.current.map(note=>counts.get(note.id)??-1)).map(note=>note.creationBounds?note:{...note,creationBounds});
   publish({...current.current,site:candidate},true);committed=true;setNotes(verified);
   setHistory(items=>[...items,{at:new Date().toISOString(),siteName:candidate!.name,count:analysis.count,regions:analysis.regions.length,cleared:verified.filter(note=>note.state==='OPEN'&&note.verification==='CLEARED').length,remaining:verified.filter(note=>note.state==='OPEN'&&note.verification==='REMAINING').length}]);
   return true;
  }catch(error){if(alive.current&&!controller.signal.aborted&&request===generation.current.site)setErrors(value=>({...value,site:error instanceof Error?error.message:'Не удалось выполнить повторную проверку.'}));return false;}
  finally{
   if(candidate&&!committed)releaseImage(candidate);
   if(pendingCheck.current===controller){pendingCheck.current=undefined;if(alive.current)setRechecking(false);}
   if(alive.current&&request===generation.current.site)setLoading(value=>({...value,site:false}));
  }
 }
 function clear(slot?:Slot){
  if(notesRef.current.length&&!window.confirm('Очистить изображения и удалить замечания?'))return;
  pendingCheck.current?.abort();
  if(slot){generation.current[slot]++;setLoading(value=>({...value,[slot]:false}));setErrors(value=>({...value,[slot]:undefined}));const next={...current.current};delete next[slot];publish(next);}
  else{generation.current.site++;generation.current.figma++;setLoading({});setErrors({});publish({});}
 }
 return {images,notes,setNotes,errors,loading,choose,choosePair,recheck,rechecking,history,clear,revision,pairRevision,cancelRecheck:()=>pendingCheck.current?.abort()};
}
