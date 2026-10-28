import { describe, expect, it } from 'vitest';
import { groupDifferences } from './diff-regions';
function mask(width:number,height:number,points:[number,number][]){const data=new Uint8ClampedArray(width*height*4);for(const [x,y] of points)data.set([255,0,80,255],(y*width+x)*4);return {width,height,data};}
describe('difference regions',()=>{
 it('groups nearby pixels and keeps distant blocks separate in reading order',()=>{
  const image=mask(64,40,[[1,1],[8,1],[9,2],[50,25],[51,26]]);
  const result=groupDifferences(image,1);
  expect(result.regions).toEqual([{x:1,y:1,width:9,height:2,pixels:3},{x:50,y:25,width:2,height:2,pixels:2}]);expect(result.count).toBe(5);
 });
 it('filters by changed pixel count rather than bounding box area and removes hidden highlights',()=>{
  const image=mask(40,24,[[0,0],[15,15],[32,0],[33,0],[34,0]]);
  const result=groupDifferences(image,3);
  expect(result.regions).toEqual([{x:32,y:0,width:3,height:1,pixels:3}]);expect(result.count).toBe(3);expect(result.hiddenPixels).toBe(2);
  expect(image.data[3]).toBe(0);expect(image.data[(15*40+15)*4+3]).toBe(0);expect(image.data[32*4+3]).toBe(255);
 });
 it('supports diagonal neighbours and partial cells at the image edge',()=>{
  const result=groupDifferences(mask(17,17,[[7,7],[8,8],[16,16]]),1);
  expect(result.regions).toEqual([{x:7,y:7,width:10,height:10,pixels:3}]);
 });
 it('returns no regions for an identical image or a filter hiding every group',()=>{
  expect(groupDifferences(mask(3,3,[]),1).regions).toEqual([]);
  const result=groupDifferences(mask(3,3,[[1,1]]),2);expect(result.regions).toEqual([]);expect(result.count).toBe(0);expect(result.hiddenPixels).toBe(1);
 });
 it('keeps unmatched height together and measures it in original image coordinates',()=>{
  const points:[number,number][]=[];for(let y=10;y<20;y++)for(let x=0;x<20;x++)points.push([x,y]);
  expect(groupDifferences(mask(20,20,points),10).regions).toEqual([{x:0,y:10,width:20,height:10,pixels:200}]);
 });
});
