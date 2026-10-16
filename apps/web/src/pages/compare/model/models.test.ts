import { describe, expect, it } from 'vitest';
import { clampRect, clampZoom, fitCamera, imageToScreen, screenToImage, zoomAt } from './geometry';
import { parseImageHeader, validateImageSize, ImageFileError } from './image-file';
import { createReport, validateNoteBody, validateNoteRect } from './annotations';
const png = (width=320,height=240,animated=false) => {
 const chunks = [[73,72,68,82,...new Uint8Array(13)], ...(animated?[[97,99,84,76,...new Uint8Array(8)]]:[]),[73,69,78,68]];
 const data = [137,80,78,71,13,10,26,10];
 for(const chunk of chunks){const n=chunk.length-4;data.push(n>>>24,n>>>16&255,n>>>8&255,n&255,...chunk,0,0,0,0);}
 const bytes=new Uint8Array(data);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height); return bytes;
};
describe('geometry',()=>{
 it.each([.5,1,2])('roundtrips with zoom %s',zoom=>{const c={center:{x:450,y:-20},zoom};const v={width:800,height:600};const p={x:120,y:230};expect(screenToImage(imageToScreen(p,c,v),c,v)).toEqual(p);const a={x:77,y:99};const after=screenToImage(a,zoomAt(c,3,a,v),v);const before=screenToImage(a,c,v);expect(after.x).toBeCloseTo(before.x,8);expect(after.y).toBeCloseTo(before.y,8);});
 it('fits tall images and clamps zoom',()=>{expect(fitCamera({width:4096,height:10000},{width:800,height:600})).toEqual({center:{x:2048,y:5000},zoom:.06});expect(clampZoom(0)).toBe(.01);expect(clampZoom(8)).toBe(4);expect(()=>clampZoom(NaN)).toThrow();});
 it('normalizes and clips reverse drags; rejects zero/nonfinite',()=>{expect(clampRect({x:120,y:90},{x:-4,y:10},{width:100,height:100})).toEqual({x:0,y:10,width:100,height:80});expect(clampRect({x:2,y:2},{x:2,y:8},{width:100,height:100})).toBeNull();expect(clampRect({x:NaN,y:0},{x:4,y:8},{width:100,height:100})).toBeNull();});
});
describe('image headers and limits',()=>{
 it('reads PNG and JPEG dimensions without trusting MIME',()=>{expect(parseImageHeader(png())).toMatchObject({width:320,height:240,format:'png'});expect(parseImageHeader(new Uint8Array([255,216,255,224,0,4,0,0,255,192,0,11,8,0,20,0,30,1,1,17,0]))).toMatchObject({width:30,height:20,format:'jpeg'});});
 it('rejects APNG, truncated chunks, unknown bytes and incomplete JPEG',()=>{for(const data of [png(1,1,true),png().slice(0,-1),new Uint8Array([1,2]),new Uint8Array([255,216,255,192,0,255])]) expect(()=>parseImageHeader(data)).toThrow(ImageFileError);});
 it.each([{width:4097,height:1},{width:1,height:10001},{width:4096,height:6251},{width:NaN,height:1},{width:1.5,height:1},{width:0,height:1}])('rejects invalid dimensions %o',size=>expect(()=>validateImageSize(size,10)).toThrow());
 it('checks bytes and exact boundaries',()=>{expect(()=>validateImageSize({width:4096,height:6250},15*1024*1024)).not.toThrow();for(const n of [15*1024*1024+1,NaN,-1])expect(()=>validateImageSize({width:1,height:1},n)).toThrow();});
});
describe('notes and report',()=>{
 it('trims body and rejects empty/too long',()=>{expect(validateNoteBody('  hello  ')).toBe('hello');for(const body of ['  ','a'.repeat(5001)])expect(()=>validateNoteBody(body)).toThrow();});
 it('rejects invalid or out of bounds rectangles',()=>{for(const rect of [{x:-1,y:0,width:1,height:1},{x:0,y:0,width:0,height:1},{x:99,y:0,width:2,height:1},{x:0,y:NaN,width:1,height:1}])expect(()=>validateNoteRect(rect,{width:100,height:100})).toThrow();});
 it('exports an explicit safe detached schema',()=>{const image={id:'i',name:'site.png',url:'blob:secret',width:100,height:100,bytes:10,format:'png' as const,mime:'image/png' as const};const note={id:'n',rect:{x:0,y:0,width:1,height:1},body:' text ',state:'OPEN' as const};const report=createReport(image,image,[note],'2026-10-16T00:00:00Z');expect(report).toEqual({schemaVersion:1,exportedAt:'2026-10-16T00:00:00Z',site:{name:'site.png',width:100,height:100},figma:{name:'site.png',width:100,height:100},notes:[{...note,body:'text'}]});expect(JSON.stringify(report)).not.toContain('blob:');note.rect.x=50;expect(report.notes[0]?.rect.x).toBe(0);});
});

describe('additional boundaries', () => {
 it('accepts maximum note length and rejects empty/oversized reports', () => {
  expect(validateNoteBody('a'.repeat(5000))).toHaveLength(5000);
  const image = { id: 'i', name: 'image.png', url: 'blob:private', width: 100, height: 100, bytes: 10, format: 'png' as const, mime: 'image/png' as const };
  expect(() => createReport(image, image, [], '2026-10-16')).toThrow();
  const note = { id: 'n', rect: { x: 0, y: 0, width: 1, height: 1 }, body: 'text', state: 'OPEN' as const };
  expect(() => createReport(image, image, Array.from({length:501}, () => note), '2026-10-16')).toThrow();
 });
 it('validates exact pixel boundary and all nonfinite dimensions', () => {
  expect(() => validateImageSize({ width: 1, height: 25_600_001 }, 10)).toThrow();
  for (const number of [Infinity, -Infinity, NaN]) {
   expect(() => validateImageSize({ width: number, height: 1 }, 10)).toThrow();
   expect(() => validateNoteRect({ x: 0, y: 0, width: number, height: 1 }, { width: 100, height: 100 })).toThrow();
  }
 });
 it('clips fully outside and subpixel drags to no rectangle', () => {
  const size = { width: 100, height: 100 };
  expect(clampRect({x:110,y:10},{x:120,y:20},size)).toBeNull();
  expect(clampRect({x:0,y:0},{x:.9,y:2},size)).toBeNull();
 });
});

// These cases only verify the pre-decode boundary. Real decode is checked through the browser UI.
describe('file rejection before decode', () => {
 it('rejects oversized files without reading their bytes', async () => {
  const { loadImageFile } = await import('./image-file');
  class OversizeFile extends File {
   override arrayBuffer(): Promise<ArrayBuffer> { throw new Error('Must not read oversized input'); }
  }
  const file = new OversizeFile([new Uint8Array(15 * 1024 * 1024 + 1)], 'image.png');
  await expect(loadImageFile(file)).rejects.toMatchObject({code:'SIZE'});
 });
 it('rejects signatures despite misleading extension and MIME', async () => {
  const { loadImageFile } = await import('./image-file');
  await expect(loadImageFile(new File(['GIF89a'], 'looks-valid.png', {type:'image/png'}))).rejects.toMatchObject({code:'FORMAT'});
 });
});
