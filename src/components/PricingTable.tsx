'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { PlanView } from '@/lib/plans';

interface Labels { buyers: string; suppliers: string; monthly: string; yearly: string; save: string; perMonth: string; perYear: string; choose: string; popular: string; users: string }

export function PricingTable({ plans, lang, l, initialAudience = 'buyer' }: { plans: PlanView[]; lang: 'en' | 'ar'; l: Labels; initialAudience?: 'buyer' | 'supplier' }) {
  const [aud, setAud] = useState<'buyer' | 'supplier'>(initialAudience);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const list = plans.filter((p) => p.audience === aud);
  const fmt = (h: number) => (h / 100).toLocaleString('en-US');
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="tablist">
          {(['buyer', 'supplier'] as const).map((a) => (
            <button key={a} role="tab" aria-selected={aud === a} data-testid={`aud-${a}`} onClick={() => setAud(a)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${aud === a ? 'bg-ink text-white' : 'text-muted'}`}>
              {a === 'buyer' ? l.buyers : l.suppliers}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface p-1">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button key={c} aria-pressed={cycle === c} data-testid={`cycle-${c}`} onClick={() => setCycle(c)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${cycle === c ? 'bg-brand text-white' : 'text-muted'}`}>
              {c === 'monthly' ? l.monthly : l.yearly}{c === 'yearly' && <span className="ms-1.5 text-[11px] opacity-80">({l.save})</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {list.map((p) => (
          <div key={p.id} data-testid={`plan-${p.id}`} className={`card flex flex-col ${p.highlight ? 'border-2 border-brand' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{p.name[lang]}</h3>
              {p.highlight && <span className="pill-ok">{l.popular}</span>}
            </div>
            <p className="mt-1 min-h-[2.5rem] text-sm text-muted">{p.tagline[lang]}</p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums" data-testid="plan-price">{fmt(cycle === 'yearly' ? p.yearlyHalalas : p.monthlyHalalas)}</span>
              <span className="text-sm text-muted">{lang === 'ar' ? 'ر.س' : 'SAR'} {cycle === 'yearly' ? l.perYear : l.perMonth}</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.features[lang].map((f) => (
                <li key={f} className="flex gap-2"><span className="mt-0.5 text-brand">✓</span><span>{f}</span></li>
              ))}
            </ul>
            <Link href={`/signup?plan=${p.id}&cycle=${cycle}`} data-testid={`choose-${p.id}`} className={`mt-6 ${p.highlight ? 'btn-pri' : 'btn'}`}>{l.choose}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
