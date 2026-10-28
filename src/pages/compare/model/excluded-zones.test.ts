import { describe,expect,it } from 'vitest';
import { comparePixels } from './pixel-diff';
const image=(width:number,height:number,color:number)=>{const data=new Uint8ClampedArray(width*height*4);for(let p=0;p<data.length;p+=4)data.set([color,color,color,255],p);return {width,height,data};};
describe('excluded zones',()=>{
 it('removes masked differences and their area from comparison totals',()=>{
  const result=comparePixels(image(4,4,0),image(4,4,255),0,true,[{x:1,y:1,width:2,height:2}]);
  expect(result.count).toBe(12);expect(result.excludedPixels).toBe(4);expect(result.totalPixels).toBe(12);expect(result.data[(1*4+1)*4+3]).toBe(0);expect(result.data[3]).toBe(255);
 });
 it('counts overlapping zones only once, including unchanged pixels',()=>{
  const result=comparePixels(image(4,4,255),image(4,4,255),0,true,[{x:0,y:0,width:3,height:2},{x:1,y:1,width:3,height:2}]);
  expect(result.excludedPixels).toBe(10);expect(result.totalPixels).toBe(6);expect(result.count).toBe(0);
 });
 it('can exclude the extra height outside the shorter image',()=>{
  const result=comparePixels(image(4,2,255),image(4,4,255),0,true,[{x:0,y:2,width:4,height:2}]);
  expect(result.count).toBe(0);expect(result.totalPixels).toBe(8);expect(result.excludedPixels).toBe(8);
 });
 it('clips zones to image bounds and rounds touched pixels outward',()=>{
  const result=comparePixels(image(4,4,0),image(4,4,255),0,true,[{x:-2,y:-1,width:3.2,height:2.1},{x:3,y:3,width:20,height:20}]);
  expect(result.excludedPixels).toBe(5);expect(result.count).toBe(11);
 });
 it('handles a fully excluded image without negative totals',()=>{
  const result=comparePixels(image(4,4,0),image(4,4,255),0,true,[{x:0,y:0,width:4,height:4},{x:0,y:0,width:4,height:4}]);
  expect(result.totalPixels).toBe(0);expect(result.count).toBe(0);expect(result.excludedPixels).toBe(16);
 });
});
