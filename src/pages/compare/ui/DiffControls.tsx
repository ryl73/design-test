type Props = {
 threshold:number;setThreshold:(value:number)=>void;
 includeAA:boolean;setIncludeAA:(value:boolean)=>void;
 minPixels:number;setMinPixels:(value:number)=>void;
 loading:boolean;error:string|undefined;
 count:number|undefined;totalPixels:number;hiddenPixels:number;
 regionCount:number;activeIndex:number;onNavigate:(step:number)=>void;
 activeBounds:{x:number;y:number;width:number;height:number}|undefined;
};
export function DiffControls(props:Props) {
 const {threshold,setThreshold,includeAA,setIncludeAA,minPixels,setMinPixels,loading,error,count,totalPixels,hiddenPixels,regionCount,activeIndex,onNavigate,activeBounds}=props;
 return <div className="diff-controls">
  <label className="range">Чувствительность <input aria-label="Чувствительность" type="range" min="0" max="100" value={100-threshold} onChange={event=>setThreshold(100-Number(event.target.value))}/><output>{100-threshold}%</output></label>
  <label><input type="checkbox" checked={includeAA} onChange={event=>setIncludeAA(event.target.checked)}/> Учитывать сглаживание</label>
  <label>Фильтр шума <select aria-label="Фильтр шума" value={minPixels} onChange={event=>setMinPixels(Number(event.target.value))}>
   <option value={1}>Выкл.</option><option value={4}>Меньше 4 пикселей</option><option value={12}>Меньше 12 пикселей</option><option value={32}>Меньше 32 пикселей</option><option value={100}>Меньше 100 пикселей</option><option value={500}>Меньше 500 пикселей</option>
  </select></label>
  <span role="status" aria-label="Результат сравнения">{error??(loading?'Ищем отличия…':count!==undefined?totalPixels===0?'Вся область исключена из сравнения':`Отличается ${count.toLocaleString('ru-RU')} пикселей (${(count/totalPixels*100).toLocaleString('ru-RU',{maximumFractionDigits:2})}%)`:'')}</span>
  {!loading&&!error&&count!==undefined&&<div className="diff-navigation" aria-label="Переход между отличиями">
   <button disabled={!regionCount} onClick={()=>onNavigate(-1)}>Предыдущее отличие</button>
   <span role="status" aria-label="Области отличий">{regionCount?activeIndex<0?`Областей: ${regionCount}`:`Область ${activeIndex+1} из ${regionCount}`:totalPixels===0?'Нет области для сравнения':hiddenPixels?'Все отличия скрыты фильтром':'Отличий не найдено'}</span>
   <button disabled={!regionCount} onClick={()=>onNavigate(1)}>Следующее отличие</button>
   {activeBounds&&<span className="diff-coordinates">x: {activeBounds.x}, y: {activeBounds.y} · {activeBounds.width} × {activeBounds.height} px</span>}
   {hiddenPixels>0&&<span className="diff-coordinates">Скрыто фильтром: {hiddenPixels.toLocaleString('ru-RU')} px</span>}
  </div>}
  <small>Розовым отмечены отличия, рамками — группы близких изменений. Фильтр учитывает число изменённых пикселей в группе. Выравнивание по верхнему левому краю; лишняя высота тоже сравнивается.</small>
 </div>;
}
