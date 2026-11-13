import { desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { withSystem, schema } from '@/db';
import { aiStatus } from '@/lib/ai';
import { AITestForm } from './AITestForm';

export const dynamic = 'force-dynamic';

/** Platform-wide AI configuration. Only Tawreed's platform admins see this; companies never configure AI. */
export default async function PlatformAIPage() {
  await requireUser({ platform: true });
  const { t, lang } = await getT();
  const s = aiStatus();
  const { calls, names } = await withSystem(async (tx) => {
    const calls = await tx.select().from(schema.aiCalls).orderBy(desc(schema.aiCalls.id)).limit(25);
    const cos = await tx.select({ id: schema.companies.id, name: schema.companies.name }).from(schema.companies);
    return { calls, names: new Map(cos.map((c) => [c.id, c.name])) };
  });
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="h1" data-testid="ai-title">{t.aiPage.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.aiPage.sub} {lang === 'ar' ? 'هذه الإعدادات للمنصة كاملة ولا تظهر للشركات.' : 'These settings apply to the whole platform and are not visible to companies.'}</p>
      </div>
      <section className="card grid gap-4 sm:grid-cols-2" data-testid="ai-status">
        <Prov name="OpenAI" keySet={s.openai.keySet} model={s.openai.model} t={t} />
        <Prov name="Claude (Anthropic)" keySet={s.anthropic.keySet} model={s.anthropic.model} t={t} />
        <div className="text-sm sm:col-span-2">
          <span className="text-muted">{t.aiPage.mode}:</span> <code>{s.mode}</code> · <span className="text-muted">{t.aiPage.order}:</span>{' '}
          <b data-testid="ai-order">{s.order.length ? s.order.join(' → ') : t.aiPage.none}</b> · <span className="text-muted">{t.aiPage.fallback}:</span> {s.fallback ? t.aiPage.on : t.aiPage.off}
        </div>
      </section>
      <AITestForm t={t.aiPage} />
      <section className="card overflow-x-auto p-0">
        <div className="px-4 pt-4 font-semibold">{t.aiPage.recent}</div>
        <table className="tbl mt-2" data-testid="ai-calls">
          <thead><tr><th>#</th><th>{lang === 'ar' ? 'الميزة' : 'Feature'}</th><th>{lang === 'ar' ? 'الشركة' : 'Company'}</th><th>Provider</th><th>{t.aiPage.model}</th><th>ms</th><th>{t.app.status}</th></tr></thead>
          <tbody>{calls.map((c) => (
            <tr key={c.id}><td>{c.id}</td><td><code className="text-xs">{c.feature}</code></td><td className="text-xs">{c.companyId ? names.get(c.companyId) ?? '—' : 'Tawreed'}</td><td>{c.provider}</td><td className="font-mono text-xs">{c.model}</td><td className="tabular-nums">{c.latencyMs}</td>
              <td>{c.ok ? <span className="pill-ok">ok</span> : <span className="pill-bad" title={c.error ?? ''}>failed</span>}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}

function Prov({ name, keySet, model, t }: { name: string; keySet: boolean; model: string; t: Awaited<ReturnType<typeof getT>>['t'] }) {
  return (
    <div className="rounded-lg bg-canvas p-3">
      <div className="flex items-center justify-between"><b>{name}</b>{keySet ? <span className="pill-ok">{t.aiPage.keySet}</span> : <span className="pill-mute">{t.aiPage.keyMissing}</span>}</div>
      <div className="mt-1 text-xs text-muted">{t.aiPage.model}: <code>{model}</code></div>
    </div>
  );
}
