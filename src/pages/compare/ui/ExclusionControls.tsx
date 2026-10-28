import type { ExcludedZone } from '../model/excluded-zones';
import type { Rect } from '../model/geometry';
type Props={zones:readonly ExcludedZone[];drawing:boolean;activeRegion:Rect|undefined;onDraw:()=>void;onAdd:(rect:Rect)=>void;onRemove:(id:string)=>void;onClear:()=>void;onFocus:(rect:Rect)=>void;excludedPixels:number|undefined};
export function ExclusionControls({zones,drawing,activeRegion,onDraw,onAdd,onRemove,onClear,onFocus,excludedPixels}:Props){
 return <section className="exclusion-controls" aria-label="Исключаемые зоны">
  <div className="exclusion-actions">
   <button aria-pressed={drawing} disabled={zones.length>=100&&!drawing} onClick={onDraw}>Исключить область</button>
   <button disabled={!activeRegion||zones.length>=100} onClick={()=>{if(activeRegion)onAdd(activeRegion);}}>Исключить выбранное отличие</button>
   <span role="status" aria-label="Количество исключаемых зон">Зон: {zones.length}</span>
   {excludedPixels!==undefined&&excludedPixels>0&&<span>Исключено из сравнения: {excludedPixels.toLocaleString('ru-RU')} px</span>}
   {zones.length>0&&<button onClick={onClear}>Удалить все исключения</button>}
  </div>
  <p>{drawing?'Выделите прямоугольник на холсте. Esc — отмена, Space — перемещение.':'Исключённые зоны не участвуют в подсветке, поиске областей и расчёте процента. Зоны действуют только для текущей пары изображений.'}</p>
  {zones.length>0&&<ol>{zones.map((zone,index)=><li key={zone.id}><button className="zone-focus" onClick={()=>onFocus(zone)} aria-label={`Показать зону ${index+1}`}>Зона {index+1} · x: {zone.x}, y: {zone.y} · {zone.width} × {zone.height} px</button><button aria-label={`Удалить зону ${index+1}`} onClick={()=>onRemove(zone.id)}>Удалить</button></li>)}</ol>}
 </section>;
}
