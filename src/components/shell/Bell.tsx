'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { markNotificationsReadAction } from '@/app/actions/ops';

type N = { id: number; title: string; at: string; link: string | null; unread: boolean };

/** Bell with a popover of recent notifications, plus live toasts when new ones arrive while the page refreshes itself. */
export function Bell({ items, unread, t }: { items: N[]; unread: number; t: { title: string; none: string; all: string; read: string } }) {
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<N[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const top = items[0]?.id ?? 0;
  useEffect(() => {
    let last = 0;
    try { last = Number(sessionStorage.getItem('tw-last-n') ?? 0); } catch { /* storage blocked */ }
    if (last && top > last) {
      const fresh = items.filter((n) => n.id > last && n.unread).slice(0, 3);
      setToasts(fresh);
      const id = setTimeout(() => setToasts([]), 4200);
      try { sessionStorage.setItem('tw-last-n', String(top)); } catch { /* ignore */ }
      return () => clearTimeout(id);
    }
    try { sessionStorage.setItem('tw-last-n', String(top)); } catch { /* ignore */ }
  }, [top]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" className="btn relative px-2.5" aria-label={t.title} aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="bell">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>
        {unread > 0 && <span className="absolute -top-1.5 -end-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10.5px] font-semibold text-white" data-testid="bell-count">{unread}</span>}
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-40 max-h-[420px] w-[min(340px,calc(100vw-32px))] overflow-auto rounded-xl border border-line2 bg-surface p-2 shadow-xl" data-testid="bell-pop">
          {!items.length && <div className="p-2.5 text-[13px] text-muted">{t.none}</div>}
          {items.slice(0, 10).map((n) => (
            <Link key={n.id} href={n.link ?? '/app/notifications'} onClick={() => setOpen(false)} className={`flex flex-col gap-0.5 rounded-lg p-2.5 text-[13px] hover:bg-sunk ${n.unread ? 'bg-brand-soft' : ''}`}>
              <span>{n.title}</span><time className="text-[11.5px] text-muted">{n.at}</time>
            </Link>
          ))}
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
            <Link href="/app/notifications" className="text-xs font-medium text-brand-ink hover:underline" onClick={() => setOpen(false)}>{t.all}</Link>
            {unread > 0 && <form action={markNotificationsReadAction}><button className="text-xs text-muted hover:text-ink">{t.read}</button></form>}
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed bottom-4 end-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((n) => <div key={n.id} className="toast" data-testid="toast"><svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg><span>{n.title}</span></div>)}
      </div>
    </div>
  );
}
