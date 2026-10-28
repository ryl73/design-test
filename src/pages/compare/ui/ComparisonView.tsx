import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = { ready: boolean; toolbar: ReactNode; children: ReactNode };

export function ComparisonView({ ready, toolbar, children }: Props) {
 const host = useRef<HTMLElement>(null);
 const toggle = useRef<HTMLButtonElement>(null);
 const [fullscreen, setFullscreen] = useState(false);
 const exit = useCallback(() => {
  setFullscreen(false);
  if (document.fullscreenElement === host.current) void document.exitFullscreen().catch(() => {});
  toggle.current?.focus();
 }, []);
 useEffect(() => {
  if (!fullscreen) return;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') exit(); };
  const changed = () => { if (!document.fullscreenElement) exit(); };
  window.addEventListener('keydown', escape);
  document.addEventListener('fullscreenchange', changed);
  return () => {
   document.body.style.overflow = previousOverflow;
   window.removeEventListener('keydown', escape);
   document.removeEventListener('fullscreenchange', changed);
  };
 }, [fullscreen, exit]);
 useEffect(() => { if (!ready && fullscreen) exit(); }, [ready, fullscreen, exit]);
 const label = fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран';
 return <section ref={host} className={`comparison-view${fullscreen ? ' is-fullscreen' : ''}`} aria-label="Просмотр сравнения">
  <div className="comparison-controls">{toolbar}<button ref={toggle} className="fullscreen-toggle" type="button" disabled={!ready} aria-label={label} title={fullscreen ? `${label} (Esc)` : label} aria-pressed={fullscreen} onClick={() => {
   if (fullscreen) { exit(); return; }
   setFullscreen(true);
   // Keep the expanded viewport available when native fullscreen is unsupported.
   void host.current?.requestFullscreen?.().catch(() => {});
  }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={fullscreen ? 'M8 3v5H3m18 0h-5V3M3 16h5v5m8 0v-5h5' : 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5'}/></svg></button></div>
  {children}
 </section>;
}
