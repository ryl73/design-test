import type { PixelImage } from './pixel-diff';
import type { Rect } from './geometry';
export type DiffRegion = Rect & { pixels:number };
const CELL_SIZE=8;

/** Group neighbouring occupied 8px cells; bounds and counts use actual changed pixels.
 * Mutates the mask to remove filtered groups. Memory is bounded by the cell grid,
 * rather than a queue/label per image pixel (long screenshots can exceed 25M pixels).
 */
export function groupDifferences(image:PixelImage,minPixels:number):{regions:DiffRegion[];count:number;hiddenPixels:number} {
 const {width,height,data}=image;
 const columns=Math.ceil(width/CELL_SIZE),rows=Math.ceil(height/CELL_SIZE),cells=columns*rows;
 const counts=new Uint32Array(cells),flags=new Uint8Array(cells);
 const left=new Uint16Array(cells).fill(65535),top=new Uint16Array(cells).fill(65535);
 const right=new Uint16Array(cells),bottom=new Uint16Array(cells);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(!data[(y*width+x)*4+3])continue;
  const cell=Math.floor(y/CELL_SIZE)*columns+Math.floor(x/CELL_SIZE);
  counts[cell]=counts[cell]!+1;
  left[cell]=Math.min(left[cell]!,x);top[cell]=Math.min(top[cell]!,y);
  right[cell]=Math.max(right[cell]!,x+1);bottom[cell]=Math.max(bottom[cell]!,y+1);
 }
 const queue=new Uint32Array(cells),regions:DiffRegion[]=[];
 let count=0,hiddenPixels=0;
 for(let start=0;start<cells;start++){
  if(!counts[start]||flags[start])continue;
  let head=0,tail=1,x=width,y=height,endX=0,endY=0,pixels=0;
  queue[0]=start;flags[start]=1;
  while(head<tail){
   const cell=queue[head++]!,cx=cell%columns,cy=Math.floor(cell/columns);
   pixels+=counts[cell]!;x=Math.min(x,left[cell]!);y=Math.min(y,top[cell]!);
   endX=Math.max(endX,right[cell]!);endY=Math.max(endY,bottom[cell]!);
   for(let ny=Math.max(0,cy-1);ny<=Math.min(rows-1,cy+1);ny++)for(let nx=Math.max(0,cx-1);nx<=Math.min(columns-1,cx+1);nx++){
    const neighbour=ny*columns+nx;
    if(counts[neighbour]&&!flags[neighbour]){flags[neighbour]=1;queue[tail++]=neighbour;}
   }
  }
  if(pixels>=minPixels){
   regions.push({x,y,width:endX-x,height:endY-y,pixels});count+=pixels;
   for(let i=0;i<tail;i++)flags[queue[i]!]=2;
  }else hiddenPixels+=pixels;
 }
 if(hiddenPixels)for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(flags[Math.floor(y/CELL_SIZE)*columns+Math.floor(x/CELL_SIZE)]!==2)data[(y*width+x)*4+3]=0;
 }
 regions.sort((a,b)=>a.y-b.y||a.x-b.x);
 return {regions,count,hiddenPixels};
}
