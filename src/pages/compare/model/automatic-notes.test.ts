import { describe,expect,it } from 'vitest';
import { draftAutomaticNotes,verifyNotes } from './automatic-notes';
import type { ComparisonNote } from './annotations';
const rect={x:10,y:20,width:30,height:40};
const note:ComparisonNote={id:'old',rect,body:'Check',state:'OPEN'};
describe('automatic notes',()=>{
 it('deduplicates drafts and respects the remaining note capacity',()=>{
  const regions=[{...rect,pixels:2},{x:100,y:100,width:20,height:20,pixels:10},{x:200,y:200,width:10,height:10,pixels:12}];
  const result=draftAutomaticNotes(regions,[note],{width:300,height:300},{width:300,height:300},2);
  expect(result).toHaveLength(1);expect(result[0]?.rect).toEqual({x:100,y:100,width:20,height:20});expect(result[0]?.origin).toBe('AUTO');expect(result[0]?.body).toContain('10');
 });
 it('keeps extra-height differences outside the shorter site as drafts',()=>{
  const result=draftAutomaticNotes([{x:0,y:100,width:100,height:20,pixels:2000}],[],{width:100,height:100},{width:100,height:120});
  expect(result[0]?.rect.height).toBe(20);expect(result[0]?.body).toContain('высот');
 });
 it('tracks unchanged, remaining and out-of-bounds notes without resolving them silently',()=>{
  const result=verifyNotes([note,{...note,id:'second'}, {...note,id:'missing',rect:{x:0,y:100,width:2,height:2}}],[0,3,-1]);
  expect(result.map(n=>n.verification)).toEqual(['CLEARED','REMAINING','UNCHECKED']);expect(result.every(n=>n.state==='OPEN')).toBe(true);
 });
});

import { createReport } from './annotations';
it('exports historical unchecked notes after the new screenshots become shorter',()=>{
 const image={id:'new',name:'short.png',url:'blob:test',width:100,height:50,bytes:1,format:'png' as const,mime:'image/png' as const};
 const note:ComparisonNote={id:'historical',body:'Original lower block',state:'OPEN',rect:{x:0,y:80,width:20,height:10},verification:'UNCHECKED',creationBounds:{width:100,height:100}};
 const result=createReport(image,image,[note],'2026-10-17');expect(result.schemaVersion).toBe(2);expect(result.notes[0]?.rect.y).toBe(80);expect(result.notes[0]?.creationBounds?.height).toBe(100);
});
