import Link from 'next/link';
import type { ReactNode } from 'react';
import { statusOf } from '@/lib/ops/flow';
import { formatSar } from '@/lib/billing';
import type { Lang } from '@/lib/ops/catalog';
import { roleVar } from '@/lib/ops/core';
import type { CSSProperties } from 'react';

/** Tiny bilingual helper: tr(lang)('Save', 'حفظ'). */
export const tr = (lang: Lang) => (en: string, ar: string) => (lang === 'ar' ? ar : en);

const P: Record<string, string> = {
  spark: 'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  arrow: 'M5 12h14M13 6l6 6-6 6', check: 'M5 12l5 5L20 7', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  alert: 'M12 3l10 18H2zM12 10v4M12 17h.01', file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  truck: 'M2 6h12v10H2zM14 9h4l3 3v4h-7M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', chat: 'M21 12a8 8 0 0 1-12 7L3 21l2-6a8 8 0 1 1 16-3z', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  money: 'M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6', home: 'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', plus: 'M12 5v14M5 12h14', inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z', chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4', log: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', key: 'M15 7a4 4 0 1 1-3.9 5H3v4h3v-2h2v2h3.1A4 4 0 0 1 15 7z', card: 'M2 6h20v12H2zM2 10h20', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
};
export function Icon({ n, className = 'h-4 w-4' }: { n: keyof typeof P | string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] ?? P.file} /></svg>;
}

export function PageHead({ title, sub, right, back }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-block text-xs font-medium text-muted hover:text-ink">← {back.label}</Link>}
        <h1 className="h1">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

const toneCls: Record<string, string> = { ok: 'pill-ok', warn: 'pill-warn', info: 'pill-info', mute: 'pill-mute', bad: 'pill-bad' };
export function Pill({ tone = 'mute', children, testId }: { tone?: string; children: ReactNode; testId?: string }) {
  return <span className={toneCls[tone] ?? 'pill-mute'} data-testid={testId}>{children}</span>;
}
export function StatusPill({ kind, status, lang, testId }: { kind: string; status: string; lang: Lang; testId?: string }) {
  const s = statusOf(kind, status, lang);
  return <Pill tone={s.tone} testId={testId}>{s.label}</Pill>;
}

export function Sar({ h, lang, className = '' }: { h: number; lang: Lang; className?: string }) {
  return <span className={`num ${className}`}>{formatSar(h, lang)}</span>;
}

/** Amber box for AI output; grey "auto-check" box for deterministic checks. */
export function AIBox({ title, children, by, auto, testId }: { title: ReactNode; children: ReactNode; by?: string | null; auto?: boolean; testId?: string }) {
  return (
    <div className={auto ? 'auto' : 'ai'} data-testid={testId}>
      <div className={auto ? 'auto-h' : 'ai-h'}><Icon n={auto ? 'check' : 'spark'} />{title}{by && <span className="ms-auto font-normal opacity-75">{by}</span>}</div>
      <div className="leading-6">{children}</div>
    </div>
  );
}

export function ActionPanel({ title, lang, children, footer, testId }: { title: ReactNode; lang: Lang; children?: ReactNode; footer?: ReactNode; testId?: string }) {
  return (
    <section className="act" data-testid={testId ?? 'action-panel'}>
      <div className="act-h"><Icon n="arrow" className="h-4 w-4 rtl:-scale-x-100" />{lang === 'ar' ? 'إجراؤك' : 'Your action'} · {title}</div>
      <div className="act-b">{children}{footer && <div className="act-f">{footer}</div>}</div>
    </section>
  );
}

export function WaitPanel({ children, testId }: { children: ReactNode; testId?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted" data-testid={testId ?? 'wait-panel'}><Icon n="clock" />{children}</div>;
}

// literal class names so Tailwind keeps them in the build
const TURN = { mine: 'turn-mine', other: 'turn-other', wait: 'turn-wait', done: 'turn-done' } as const;
export function TurnBar({ state, title, sub, cta }: { state: 'mine' | 'other' | 'wait' | 'done'; title: ReactNode; sub?: ReactNode; cta?: ReactNode }) {
  const subCls = state === 'other' ? 'text-[13px] text-muted' : 'text-[13px]';
  return (
    <div className={TURN[state]} data-testid="turnbar" data-state={state}>
      {state === 'done' ? <Icon n="check" /> : state === 'other' ? <Icon n="clock" /> : <span className="pulse" />}
      <div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold text-ink">{title}</div>{sub && <div className={subCls}>{sub}</div>}</div>
      {cta}
    </div>
  );
}

export function Timeline({ steps }: { steps: { label: string; done: boolean; now: boolean; who?: string; role?: string; side?: 'buyer' | 'supplier' }[] }) {
  return (
    <ol className="space-y-0" data-testid="timeline">
      {steps.map((s, i) => (
        <li key={i} className="relative grid grid-cols-[16px_1fr] gap-2.5 pb-3 text-xs">
          {i < steps.length - 1 && <span className={`absolute start-[7px] top-4 h-full w-0.5 ${s.done ? 'bg-brand' : 'bg-line'}`} />}
          <span className={s.done ? 'dot-done' : s.now ? 'dot-now' : 'dot'}>{s.done && <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}</span>
          <div><div className={s.now ? 'font-semibold text-ink' : s.done ? 'text-ink' : 'text-muted'}>{s.label}</div>{s.who && (s.role || s.side ? <span className="rtag" style={{ '--rc': roleVar(s.role, s.side) } as CSSProperties}>{s.who}</span> : <div className="text-[11px] text-muted">{s.who}</div>)}</div>
        </li>
      ))}
    </ol>
  );
}

export function Activity({ events, lang, empty }: { events: { id: number; actorName: string; actorRole?: string | null; textEn: string; textAr: string; createdAt: Date }[]; lang: Lang; empty: string }) {
  if (!events.length) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ul className="max-h-[420px] space-y-2.5 overflow-auto" data-testid="activity">
      {events.map((e) => (
        <li key={e.id} className="fadein grid grid-cols-[44px_1fr] gap-2 text-[12.5px]">
          <time className="num text-muted">{new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
          <span style={{ '--rc': roleVar(e.actorRole) } as CSSProperties}><b className="font-semibold" style={{ color: 'var(--rc)' }}><bdi>{e.actorName}</bdi></b> · {lang === 'ar' ? e.textAr : e.textEn}</span>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ label, value, sub, testId }: { label: string; value: ReactNode; sub?: ReactNode; testId?: string }) {
  return <div className="kpi"><div className="text-xs text-muted">{label}</div><div className="num mt-1 text-xl font-semibold" data-testid={testId}>{value}</div>{sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}</div>;
}

export function Empty({ title, body, cta }: { title: string; body?: string; cta?: ReactNode }) {
  return <div className="card py-10 text-center"><div className="font-semibold">{title}</div>{body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}{cta && <div className="mt-4">{cta}</div>}</div>;
}

export function Banner({ err, msg }: { err?: string; msg?: string }) {
  return <>{err && <div className="err" role="alert" data-testid="flash-err">{err}</div>}{msg && <div className="ok" data-testid="flash-ok">{msg}</div>}</>;
}

export function Bar({ pct, warn }: { pct: number; warn?: boolean }) {
  return <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full ${warn ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>;
}

export const fmtDate = (d: Date | string | null | undefined, lang: Lang, time = false) =>
  d ? new Date(d).toLocaleString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', time ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtQty = (q: number) => Number(q).toLocaleString('en-US', { maximumFractionDigits: 3 });

/** Prototype case header: id line, title, meta, status pill, key facts and a progress bar. */
export function CaseHead({ id, title, meta, status, facts, pct, back }: { id: ReactNode; title: ReactNode; meta?: ReactNode; status?: ReactNode; facts: [string, ReactNode][]; pct: number; back?: { href: string; label: string } }) {
  return (
    <div className="card" data-testid="case-head">
      {back && <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><span className="rtl:-scale-x-100">←</span> {back.label}</Link>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><div className="num text-xs text-muted">{id}</div><h1 className="mt-0.5 text-[19px] font-semibold">{title}</h1>{meta && <div className="text-[12.5px] text-muted">{meta}</div>}</div>
        {status && <div className="flex flex-wrap items-center gap-2">{status}</div>}
      </div>
      <div className="facts">{facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
      <div className="prog" title={`${Math.round(pct)}%`}><i style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>
    </div>
  );
}

/** Gregorian + Umm al-Qura Hijri date, as in the prototype header. */
export function fmtDual(d: Date | string, lang: Lang) {
  const x = new Date(d);
  try {
    const g = x.toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const h = x.toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${g} · ${h}`;
  } catch { return x.toDateString(); }
}
