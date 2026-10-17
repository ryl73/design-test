import { useEffect, useRef, useState } from 'react';
import { loadImageFile, releaseImage, type ComparisonImage } from './image-file';
import type { ComparisonNote } from './annotations';
export type Slot = 'site' | 'figma';
export function useComparison() {
 const [images,setImages] = useState<Partial<Record<Slot,ComparisonImage>>>({});
 const current = useRef(images); const generation = useRef({site:0,figma:0});
 const alive = useRef(true); const [notes,setNotes] = useState<ComparisonNote[]>([]);
 const [errors,setErrors] = useState<Partial<Record<Slot,string>>>({});
 const [loading,setLoading] = useState<Partial<Record<Slot,boolean>>>({});
 const [revision,setRevision] = useState(0);
 const notesRef = useRef(notes); useEffect(()=>{ notesRef.current=notes; },[notes]);
 useEffect(()=>{ alive.current=true; return ()=>{alive.current=false; generation.current.site++;generation.current.figma++; Object.values(current.current).forEach(releaseImage);current.current={};};},[]);
 useEffect(()=>{ if (!notes.length) return; const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';}; window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[notes.length]);
 function publish(next: typeof images) { const previous=current.current;current.current=next;setImages(next);setNotes([]);setRevision(v=>v+1);requestAnimationFrame(()=>Object.values(previous).filter(image=>!Object.values(next).includes(image)).forEach(releaseImage)); }
 async function choose(slot:Slot,file:File) {
  const request=++generation.current[slot];setLoading(v=>({...v,[slot]:true}));setErrors(v=>({...v,[slot]:undefined}));
  try {const candidate=await loadImageFile(file); if(!alive.current||request!==generation.current[slot]) {releaseImage(candidate);return;}
   if(notesRef.current.length&&!window.confirm('Заменить изображение и удалить все замечания?')) {releaseImage(candidate);return;}
   publish({...current.current,[slot]:candidate});
  } catch(error) {if(alive.current&&request===generation.current[slot])setErrors(v=>({...v,[slot]:error instanceof Error?error.message:'Не удалось прочитать файл.'}));}
  finally {if(alive.current&&request===generation.current[slot])setLoading(v=>({...v,[slot]:false}));}
 }
 function clear(slot?:Slot) {if(notesRef.current.length&&!window.confirm('Очистить изображения и удалить замечания?'))return; if(slot){generation.current[slot]++;setLoading(value=>({...value,[slot]:false}));setErrors(value=>({...value,[slot]:undefined}));const next={...current.current};delete next[slot];publish(next);}else{generation.current.site++;generation.current.figma++;setLoading({});setErrors({});publish({});}}
 return {images,notes,setNotes,errors,loading,choose,clear,revision};
}
