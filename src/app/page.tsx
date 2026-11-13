import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { listPlans } from '@/lib/plans';
import { ROLES } from '@/lib/roles';
import { PublicHeader, PublicFooter } from '@/components/PublicHeader';
import { PricingTable } from '@/components/PricingTable';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const { t, lang } = await getT();
  const [user, plans] = await Promise.all([getCurrentUser(), listPlans()]);
  const steps = t.how.steps;
  return (
    <>
      <PublicHeader t={t} lang={lang} signedIn={!!user} />
      <main>
        {/* hero */}
        <section className="border-b border-line bg-surface">
          <div className="wrap grid items-center gap-10 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
            <div>
              <p className="mb-3 text-sm font-semibold text-brand">{t.hero.eyebrow}</p>
              <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight md:text-[2.6rem]" data-testid="hero-title">{t.hero.title}</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">{t.hero.sub}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/pricing" className="btn-pri px-5 py-2.5 text-base" data-testid="hero-cta">{t.hero.cta}</Link>
                <Link href="/login" className="btn px-5 py-2.5 text-base">{t.hero.cta2}</Link>
              </div>
            </div>
            <HeroMock lang={lang} />
          </div>
        </section>

        {/* stats */}
        <section className="wrap grid grid-cols-2 gap-4 py-10 md:grid-cols-4">
          {t.stats.map(([n, l]) => (
            <div key={l} className="rounded-xl bg-surface p-4 ring-1 ring-line">
              <div className="text-2xl font-bold text-brand tabular-nums">{n}</div>
              <div className="mt-1 text-sm text-muted">{l}</div>
            </div>
          ))}
        </section>

        {/* problem */}
        <section className="wrap py-10">
          <h2 className="text-2xl font-semibold">{t.problem.title}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {t.problem.items.map(([who, what]) => (
              <div key={who} className="card">
                <div className="font-semibold text-brand-ink">{who}</div>
                <p className="mt-2 text-sm leading-6 text-muted">{what}</p>
              </div>
            ))}
          </div>
        </section>

        {/* how */}
        <section id="how" className="border-y border-line bg-surface py-14">
          <div className="wrap">
            <h2 className="text-2xl font-semibold">{t.how.title}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-5">
              {steps.map(([title, body], i) => (
                <li key={title} className="relative rounded-xl bg-canvas p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                  <div className="mt-3 font-semibold">{title}</div>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* roles */}
        <section id="roles" className="wrap py-14">
          <h2 className="text-2xl font-semibold">{t.roles.title}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {(['buyer', 'supplier'] as const).map((type) => (
              <div key={type} className="card">
                <div className="mb-3 text-sm font-semibold text-brand">{type === 'buyer' ? t.pricing.buyers : t.pricing.suppliers}</div>
                <ul className="divide-y divide-line">
                  {ROLES[type].map((r) => (
                    <li key={r.id} className="py-2.5">
                      <div className="font-medium">{r.label[lang]}</div>
                      <div className="text-sm text-muted">{r.summary[lang]}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* features */}
        <section id="features" className="border-y border-line bg-surface py-14">
          <div className="wrap">
            <h2 className="text-2xl font-semibold">{t.features.title}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.features.items.map(([title, body]) => (
                <div key={title} className="rounded-xl bg-canvas p-4">
                  <div className="font-semibold">{title}</div>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-xl bg-brand-dark p-6 text-white">
              <div className="font-semibold">{t.trust.title}</div>
              <ul className="mt-3 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
                {t.trust.items.map((x) => <li key={x}>✓ {x}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* pricing */}
        <section id="pricing" className="wrap py-14">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold">{t.pricing.title}</h2>
            <p className="mt-2 text-sm text-muted">{t.pricing.sub}</p>
          </div>
          <PricingTable plans={plans} lang={lang} l={t.pricing} />
        </section>

        <section className="wrap pb-16">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand p-8 text-white">
            <h2 className="text-xl font-semibold">{t.cta.title}</h2>
            <Link href="/pricing" className="btn border-surface bg-surface text-brand-ink hover:bg-brand-soft">{t.cta.button}</Link>
          </div>
        </section>
      </main>
      <PublicFooter t={t} />
    </>
  );
}

function HeroMock({ lang }: { lang: 'en' | 'ar' }) {
  const ar = lang === 'ar';
  const rows = ar
    ? [['أسمنت بورتلاندي 50 كجم', '400 كيس', 'السوق المباشر'], ['حديد تسليح 16 مم', '12 طن', 'طلب عروض'], ['خوذ سلامة EN 397', '120 قطعة', 'السوق المباشر']]
    : [['OPC cement 50 kg', '400 bags', 'Live market'], ['Rebar 16 mm, Grade 60', '12 t', 'RFQ'], ['Safety helmet EN 397', '120 pcs', 'Live market']];
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 shadow-sm" aria-hidden="true">
      <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
        <div className="flex items-center justify-between text-xs text-muted"><span>RFQ-2026-0417</span><span className="pill-warn">{ar ? 'فرز ذكي' : 'AI triage'}</span></div>
        <div className="mt-1 font-semibold">{ar ? 'مواد إنشائية، فلل الملقا' : 'Structural materials, Al-Malqa villas'}</div>
        <ul className="mt-3 divide-y divide-line text-sm">
          {rows.map(([a, b, c]) => (
            <li key={a} className="flex items-center justify-between gap-3 py-2">
              <span>{a}</span><span className="text-muted tabular-nums">{b}</span>
              <span className={c.includes('RFQ') || c.includes('عروض') ? 'pill-mute' : 'pill-ok'}>{c}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-xl border border-ai-line bg-ai-soft p-3 text-sm text-ai">
        <b>✦ {ar ? 'توصية الذكاء الاصطناعي' : 'AI recommendation'}:</b> {ar ? 'شراء بندين الآن من السوق بسعر أقل من المؤشر، وطرح الحديد كطلب عروض.' : 'Buy 2 lines now from the market below index price; send rebar to RFQ.'}
      </div>
    </div>
  );
}
