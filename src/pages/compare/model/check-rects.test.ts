import { expect,it } from 'vitest';
import { checkRectDifferences } from './check-rects';
it('counts mask pixels for overlapping rectangles and marks excluded or out-of-bounds areas unchecked',()=>{
 const data=new Uint8ClampedArray(4*4*4);data[3]=255;data[(2*4+2)*4+3]=255;
 const image={width:4,height:4,data};
 expect(checkRectDifferences(image,[{x:0,y:0,width:4,height:4},{x:1,y:1,width:2,height:2},{x:1,y:0,width:1,height:1},{x:3,y:3,width:2,height:2},{x:0,y:3,width:2,height:1}],[{x:0,y:3,width:2,height:1}])).toEqual([2,1,0,-1,-1]);
});
