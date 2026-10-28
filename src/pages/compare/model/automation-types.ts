import type { ComparisonImage } from './image-file';
import type { ComparisonNote } from './annotations';
import type { Rect } from './geometry';
import type { DiffRegion } from './diff-regions';
export type DiffSettings={threshold:number;includeAA:boolean;minPixels:number;exclusions:readonly Rect[]};
export type DiffAnalysis={blob:Blob;count:number;totalPixels:number;excludedPixels:number;hiddenPixels:number;regions:DiffRegion[];width:number;height:number;checks?:number[]};
export type CheckHistoryEntry={at:string;siteName:string;count:number;regions:number;cleared:number;remaining:number};
export type ReportPair={label:string;site:ComparisonImage;figma:ComparisonImage;analysis:DiffAnalysis;settings:DiffSettings;notes:ComparisonNote[];history?:CheckHistoryEntry[]};
