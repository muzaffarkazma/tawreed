import Link from 'next/link';
import { and, desc, eq, gt } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage } from '@/lib/ops/page';
import { getSettings, monthSpend } from '@/lib/ops/services';
import { buyOfferAction, counterAction } from '@/app/actions/ops';
import { Banner, Bar, Icon, Sar, StatusPill, fmtQty } from '@/components/ops';
import { Spark } from '@/components/Spark';
import { CATEGORIES, TERMS, cityName, unitName, termName } from '@/lib/ops/catalog';
import { pctVs } from '@/lib/ops/matching';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['market.buy'] });
  const sp = await searchParams;
  const d = await withTenant(me.company.id, async (tx) => {
    const offers = await tx.select().from(schema.offers).where(and(eq(schema.offers.status, 'active'), gt(schema.offers.validUntil, new Date()))).orderBy(desc(schema.offers.createdAt));
    const profiles = await tx.select().from(schema.companyProfiles).where(eq(schema.companyProfiles.type, 'supplier'));
    const index = await tx.select().from(schema.priceIndex);
    const counters = await tx.select({ c: schema.counterOffers, o: schema.offers }).from(schema.counterOffers).innerJoin(schema.offers, eq(schema.offers.id, schema.counterOffers.offerId))
      .where(eq(schema.counterOffers.buyerCompanyId, me.company.id)).orderBy(desc(schema.counterOffers.createdAt)).limit(20);
    return { offers, profiles, index, counters, settings: await getSettings(tx, me.company.id), spend: await monthSpend(tx, me.company.id) };
  });
  const cat = sp.cat ?? 'all'; const q = (sp.q ?? '').trim().toLowerCase();
  const list = d.offers.filter((o) => (cat === 'all' || o.category === cat) && (!q || `${o.item} ${o.spec} ${o.supplierName}`.toLowerCase().includes(q)));
  const lim = d.settings.monthlyLimitHalalas; const left = Math.max(0, lim - d.spend);
  const msg = sp.msg === 'countered' ? L('Counter-offer sent. The supplier will accept or decline; you will be notified.', 'أُرسل السعر المقابل. سيقبله المورد أو يرفضه وسيصلك إشعار.') : undefined;
  const pctUsed = (d.spend / Math.max(1, lim)) * 100;
  return (
    <div className="space-y-4">
      <AutoRefresh seconds={12} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">{L('Market', 'السوق')}</h1><p className="mt-0.5 text-muted">{L('Stock posted by verified suppliers. Buy now at your payment term, or send a counter-offer.', 'مخزون نشره موردون موثّقون. اشترِ الآن بشرط الدفع المناسب أو أرسل سعراً مقابلاً.')}</p></div>
        <div className="kpi min-w-[240px]" data-testid="limit-card">
          <span className="text-xs text-muted">{L('Available purchase limit', 'حد الشراء المتاح')}</span>
          <b className="num mt-0.5 block text-[21px] font-semibold"><Sar h={left} lang={lang} /></b>
          <div className="mt-1.5"><Bar pct={pctUsed} warn={pctUsed > 80} /></div>
          <span className="text-xs text-muted"><Sar h={d.spend} lang={lang} /> {L('used of', 'مستخدم من')} <Sar h={lim} lang={lang} /></span>
        </div>
      </div>
      <Banner err={sp.err} msg={msg} />
      <form className="flex flex-wrap items-center gap-2">
        {cat !== 'all' && <input type="hidden" name="cat" value={cat} />}
        <Link href="/app/market" className={cat === 'all' ? 'chip-on' : 'chip'}>{L('All', 'الكل')}</Link>
        {CATEGORIES.filter((c) => d.offers.some((o) => o.category === c.id)).map((c) => <Link key={c.id} href={`/app/market?cat=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={cat === c.id ? 'chip-on' : 'chip'}>{c.name[lang]}</Link>)}
        <input name="q" defaultValue={sp.q} className="input ms-auto max-w-[240px] py-1.5" placeholder={L('Search item or supplier', 'ابحث عن صنف أو مورد')} data-testid="market-search" />
      </form>
      <section className="card">
        <div className="mb-1 flex items-center justify-between"><h3 className="text-[15px] font-semibold">{L('Live offers', 'العروض المباشرة')}</h3><span className="text-[12.5px] text-muted">{list.length}</span></div>
        {!list.length && <div className="py-9 text-center text-muted"><b className="mb-1 block text-[15px] text-ink">{L('No live offers match', 'لا توجد عروض مطابقة')}</b>{L('Try another category, or raise a request and run an RFQ.', 'جرّب فئة أخرى، أو ارفع طلباً واطرح طلب عروض.')}</div>}
        <div data-testid="offers">
          {list.map((o) => {
            const p = d.profiles.find((x) => x.companyId === o.supplierCompanyId);
            const ix = d.index.find((x) => x.key === o.indexKey);
            const vs = ix ? pctVs(o.priceNdHalalas, ix.valueHalalas) : null;
            return (
              <article key={o.id} className="grid items-center gap-4 border-t border-line py-3.5 first:border-t-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_auto]" data-testid={`offer-${o.number}`}>
                <div className="min-w-0">
                  <b className="font-semibold">{o.item}</b><div className="text-[12.5px] text-muted">{o.spec}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
                    {vs !== null && <span className={vs <= 0 ? 'pill-ok' : 'pill-warn'} data-testid="vs-index" title={L('Compared with the network price index', 'مقارنة بمؤشر أسعار الشبكة')}>{vs > 0 ? '+' : ''}{vs.toFixed(1)}% {L('vs index', 'مقابل المؤشر')}</span>}
                    {ix && <Spark values={ix.history} w={70} h={20} />}<span className="text-muted">{o.number}</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 text-[12.5px]"><b><bdi>{o.supplierName}</bdi></b>{p?.verified && <span className="text-brand-ink"> ✓</span>} <span className="text-muted">· {cityName(o.city, lang)} · ★ {p?.rating.toFixed(1) ?? '—'} · {L('Available', 'المتوفر')} <span className="num">{fmtQty(o.qtyAvailable)}</span> {unitName(o.unit, lang)} · {L('Min', 'الحد الأدنى')} {fmtQty(o.minQty)} · {o.leadDays} {L('days', 'أيام')}</span></div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TERMS.map((t) => <div key={t.id} className="tier"><b className="num block text-[13.5px]"><Sar h={t.id === 'adv' ? o.priceAdvHalalas : t.id === 'nd' ? o.priceNdHalalas : o.price30Halalas} lang={lang} /></b><span className="text-muted">{t.name[lang]}</span></div>)}
                  </div>
                </div>
                <details className="group open:lg:col-span-3">
                  <summary className="flex cursor-pointer list-none justify-end gap-2 [&::-webkit-details-marker]:hidden"><span className="btn btn-sm">{L('Counter', 'سعر مقابل')}</span><span className="btn-pri btn-sm">{L('Buy', 'شراء')}</span></summary>
                  <div className="fadein flex flex-col gap-3 rounded-[10px] bg-sunk p-3.5 lg:col-span-3">
                    <form action={buyOfferAction} className="grid items-end gap-3 sm:grid-cols-[120px_1fr_auto]">
                      <input type="hidden" name="offerId" value={o.id} />
                      <label><span className="label">{L('Quantity', 'الكمية')} ({unitName(o.unit, lang)})</span><input name="qty" className="input" type="number" step="any" min={o.minQty} max={o.qtyAvailable} defaultValue={o.minQty} required data-testid="buy-qty" /></label>
                      <label><span className="label">{L('Payment term', 'شرط الدفع')}</span><select name="term" className="input" defaultValue="nd" data-testid="buy-term">{TERMS.map((t) => <option key={t.id} value={t.id}>{t.name[lang]} · {((t.id === 'adv' ? o.priceAdvHalalas : t.id === 'nd' ? o.priceNdHalalas : o.price30Halalas) / 100).toFixed(2)}</option>)}</select></label>
                      <button className="btn-pri" data-testid="buy">{L('Buy now', 'اشترِ الآن')}</button>
                    </form>
                    <div className="ai"><div className="ai-h"><Icon n="spark" />{L('Buying assist', 'مساعد الشراء')}</div>{L(`Advance payment is SAR ${((o.price30Halalas - o.priceAdvHalalas) / 100).toFixed(2)} per unit cheaper than 30-day credit. Buying creates a binding order for both sides; there is no second acceptance step.`, `الدفع المقدم أرخص بـ${((o.price30Halalas - o.priceAdvHalalas) / 100).toFixed(2)} ر.س للوحدة من الآجل 30 يوماً. الشراء ينشئ طلباً ملزماً للطرفين دون خطوة قبول ثانية.`)}</div>
                    <form action={counterAction} className="grid items-end gap-3 border-t border-line pt-3 sm:grid-cols-[120px_140px_1fr_auto]">
                      <input type="hidden" name="offerId" value={o.id} />
                      <label><span className="label">{L('Quantity', 'الكمية')}</span><input name="qty" className="input" type="number" step="any" min={o.minQty} max={o.qtyAvailable} defaultValue={o.minQty} required /></label>
                      <label><span className="label">{L('Your price (SAR)', 'سعرك (ر.س)')}</span><input name="price" className="input" inputMode="decimal" required defaultValue={((o.priceNdHalalas * 0.98) / 100).toFixed(2)} data-testid="counter-price" /></label>
                      <label><span className="label">{L('Term', 'الشرط')}</span><select name="term" className="input" defaultValue="nd">{TERMS.map((t) => <option key={t.id} value={t.id}>{t.name[lang]}</option>)}</select></label>
                      <button className="btn" data-testid="counter">{L('Send counter', 'إرسال السعر المقابل')}</button>
                    </form>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>
      {d.counters.length > 0 && (
        <section className="card"><h3 className="mb-2 text-[15px] font-semibold">{L('Your counter-offers', 'أسعارك المقابلة')}</h3>
          <div data-testid="my-counters">{d.counters.map(({ c, o }) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
              <div className="min-w-0 flex-1"><b className="block font-semibold">{o.number} · {o.item}</b><span className="text-[12.5px] text-muted">{fmtQty(c.qty)} {unitName(o.unit, lang)} @ <Sar h={c.unitHalalas} lang={lang} /> · {termName(c.term, lang)} · <bdi>{o.supplierName}</bdi></span></div>
              <StatusPill kind="counter" status={c.status} lang={lang} />
              {c.orderId && <Link className="btn btn-sm" href={`/app/orders/${c.orderId}`}>{L('Open order', 'فتح الطلب')}</Link>}
            </div>))}
          </div>
        </section>
      )}
    </div>
  );
}
