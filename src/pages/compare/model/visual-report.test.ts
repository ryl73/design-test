import { describe, expect, it } from 'vitest';
import { renderHtmlReport } from './visual-report';
import type { ReportPair } from './automation-types';
const image={id:'i',name:'<img onerror="alert(1)">',url:'https://untrusted.example/image.png',width:100,height:100,bytes:1,format:'png' as const,mime:'image/png' as const};
const pair:ReportPair={label:'<script>alert(1)</script>',site:image,figma:image,analysis:{blob:new Blob(),count:9,totalPixels:10000,excludedPixels:2,hiddenPixels:3,width:100,height:100,regions:[{x:1,y:2,width:3,height:4,pixels:9}]},settings:{threshold:.1,includeAA:false,minPixels:2,exclusions:[{x:10,y:20,width:30,height:40}]},notes:[{id:'n',body:'<svg onload="bad()"> & text',state:'OPEN',rect:{x:1,y:2,width:3,height:4}}],history:[{at:'2026-10-17',siteName:'<b>new</b>',count:5,regions:1,cleared:1,remaining:0}]};
describe('self-contained HTML report', () => {
 it('escapes user text and rejects remote or executable evidence', () => {
  const html=renderHtmlReport([pair],[{site:'https://remote.example/x',figma:'data:image/svg+xml;base64,YWJj',mask:'javascript:bad()',crops:[]}]);
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).toContain('&lt;svg onload=&quot;bad()&quot;&gt; &amp; text');
  expect(html).not.toContain('<script');expect(html).not.toContain('<svg');expect(html).not.toContain('https://');expect(html).not.toContain('javascript:');expect(html).not.toContain('href=');
 });
 it('includes settings, exclusions, history, coordinates and embedded evidence', () => {
  const html=renderHtmlReport([pair],[{site:'data:image/png;base64,YWJj',figma:'',mask:'',crops:[{kind:'region',index:0,site:'data:image/png;base64,YWJj',figma:''}]}]);
  for(const text of ['data:image/png;base64,YWJj','Чувствительность: 90%','Учитывать сглаживание: нет','Минимум изменённых пикселей в области: 2','10, 20 · 30 × 40','1, 2 · 3 × 4','2026-10-17','&lt;b&gt;new&lt;/b&gt;','Открыто']) expect(html).toContain(text);
 });
 it('keeps all coordinates while explicitly reporting truncated crop evidence across pairs', () => {
  const many={...pair,analysis:{...pair.analysis,regions:Array.from({length:102},(_,x)=>({x,y:2,width:3,height:4,pixels:9}))}};
  const html=renderHtmlReport([many,pair],[{site:'',figma:'',mask:'',crops:[],omitted:103},{site:'',figma:'',mask:'',crops:[],omitted:2}]);
  expect(html).toContain('101, 2 · 3 × 4');expect(html).toContain('103');expect(html).toContain('Лимит фрагментов: 100');
 });
});
