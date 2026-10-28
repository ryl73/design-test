import type { CheckHistoryEntry } from '../model/automation-types';
type Props={canDraft:boolean;canExport:boolean;busy:boolean;rechecking:boolean;history:CheckHistoryEntry[];message:string;onDraft:()=>void;onHtml:()=>void;onPng:()=>void;onRecheck:(file:File)=>void};
export function AutomationControls({canDraft,canExport,busy,rechecking,history,message,onDraft,onHtml,onPng,onRecheck}:Props){
 return <section className="automation-controls" aria-label="Автоматизация проверки"><div className="control-group">
  <button disabled={!canDraft||busy||rechecking} onClick={onDraft}>Создать черновики замечаний</button>
  <button disabled={!canExport||busy||rechecking} onClick={onHtml}>Скачать HTML-отчёт</button>
  <button disabled={!canExport||busy||rechecking} onClick={onPng}>Скачать подсветку PNG</button>
  <label className={`file-choice${busy||rechecking?' disabled':''}`}><span>{rechecking?'Проверяем новую версию…':'Повторная проверка'}</span><input className="sr-only" aria-label="Новая версия сайта для повторной проверки" type="file" accept="image/png,image/jpeg" disabled={busy||rechecking} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)onRecheck(file);}}/></label>
 </div><p>Черновики содержат координаты и исходные фрагменты. Повторная проверка сохраняет макет, исключения и замечания. Совпадение области проверяется по текущим настройкам; статус «решено» меняется вручную.</p>
 <span role="status" aria-label="Действия автоматизации">{message}</span>
 {history.length>0&&<details className="check-history"><summary>История повторных проверок ({history.length})</summary><ol>{history.map((entry,index)=><li key={`${entry.at}:${index}`}><b>{entry.siteName}</b> · {new Date(entry.at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} · Совпало: {entry.cleared} · Остались отличия: {entry.remaining} · Изменённых пикселей: {entry.count.toLocaleString('ru-RU')}</li>)}</ol></details>}
 </section>;
}
