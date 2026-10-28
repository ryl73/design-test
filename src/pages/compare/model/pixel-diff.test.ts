import { describe, expect, it } from 'vitest';
import { comparePixels } from './pixel-diff';
const white = (width:number,height:number) => ({width,height,data:new Uint8ClampedArray(width*height*4).fill(255)});
describe('pixel comparison',()=>{
 it('does not report identical images',()=>{const a=white(2,2);expect(comparePixels(a,a,.1,false).count).toBe(0);});
 it.each([true,false])('marks the entire unmatched height, including white pixels (site taller: %s)',siteTaller=>{
  const short=white(2,1),tall=white(2,3);const result=comparePixels(siteTaller?tall:short,siteTaller?short:tall,.1,false);
  expect(result.count).toBe(4);expect(result.width).toBe(2);expect(result.height).toBe(3);
  expect(Array.from(result.data.slice(8,12))).toEqual([255,0,80,255]);
 });
 it('detects a shifted block without realigning it',()=>{const a=white(3,4),b=white(3,4);a.data.set([0,0,0,255],16);b.data.set([0,0,0,255],28);expect(comparePixels(a,b,0,true).count).toBe(2);});
 it('honours the color threshold',()=>{const a=white(1,1),b=white(1,1);b.data.set([240,240,240,255]);expect(comparePixels(a,b,0,true).count).toBe(1);expect(comparePixels(a,b,.2,true).count).toBe(0);});
 it('rejects different widths',()=>{expect(()=>comparePixels(white(2,1),white(3,1),.1,false)).toThrow(/ширин/);});
});
