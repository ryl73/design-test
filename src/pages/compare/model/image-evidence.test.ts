import { describe, expect, it } from 'vitest';
import { evidenceBounds, safeRasterDataUrl } from './image-evidence';

describe('evidence crop bounds', () => {
 it('preserves missing image space and clips only the available source', () => {
  expect(evidenceBounds({width:100,height:50}, {x:80,y:40,width:40,height:30})).toEqual({x:80,y:40,width:40,height:30,sourceWidth:20,sourceHeight:10,outputWidth:40,outputHeight:30});
  expect(evidenceBounds({width:100,height:50}, {x:10,y:60,width:20,height:30}).sourceHeight).toBe(0);
 });
 it('bounds output size and normalizes fractional or negative coordinates', () => {
  expect(evidenceBounds({width:4096,height:10000}, {x:-1.2,y:2.2,width:4000,height:8000})).toMatchObject({x:0,y:2,width:3999,height:8001,outputWidth:512,outputHeight:1024});
 });
 it('rejects nonfinite and empty rectangles before allocating a canvas', () => {
  for(const rect of [{x:0,y:0,width:Infinity,height:1},{x:0,y:0,width:0,height:1},{x:-10,y:0,width:1,height:1}]) expect(()=>evidenceBounds({width:100,height:100},rect)).toThrow();
 });
 it('only accepts embedded base64 PNG and JPEG media', () => {
  expect(safeRasterDataUrl('data:image/png;base64,YWJj')).toBe('data:image/png;base64,YWJj');
  for(const value of ['https://example.com/x.png','data:image/svg+xml;base64,YWJj','data:image/png;base64," onerror="x','javascript:alert(1)']) expect(safeRasterDataUrl(value)).toBe('');
 });
});
