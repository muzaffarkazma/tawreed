import Link from 'next/link';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { withTenant, schema } from '@/db';
import { opsPage, ZERO } from '@/lib/ops/page';
import { decideCounterAction, offerStatusAction, postOfferAction } from '@/app/actions/ops';
import { AIBox, ActionPanel, Banner, Kpi, PageHead, Sar, StatusPill, TurnBar, fmtDate, fmtQty } from '@/components/ops';
import { CATEGORIES, CITIES, UNITS, cityName, unitName, termName } from '@/lib/ops/catalog';
import { lineTotal } from '@/lib/ops/core';
import { pctVs } from '@/lib/ops/matching';
import { OfferForm } from './OfferForm';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ err?: string; msg?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'supplier', perms: ['offer.manage'] });
  const sp = await searchParams;
  const d = await withTenant(me.company.id, async (tx) => {
    const offers = await tx.select().from(schema.offers).where(eq(schema.offers.supplierCompanyId, me.company.id)).orderBy(desc(schema.offers.createdAt));
    const counters = await tx.select().from(schema.counterOffers).where(eq(schema.counterOffers.supplierCompanyId, me.company.id)).orderBy(desc(schema.counterOffers.createdAt)).limit(50);
    const sold = await tx.select({ offerId: schema.orders.offerId, total: schema.orders.subtotalHalalas }).from(schema.orders).where(and(eq(schema.orders.supplierCompanyId, me.company.id), inArray(schema.orders.offerId, offers.map((o) => o.id).concat([ZERO]))));
    const index = await tx.select().from(schema.priceIndex);
    return { offers, counters, sold, index };
  });
  const pending = d.counters.filter((c) => c.status === 'pending');
  const live = d.offers.filter((o) => o.status === 'active' && o.validUntil > new Date());
  const msg = sp.msg === 'posted' ? L('Offer is live in the market. Buyers can buy it immediately.', 'العرض منشور في السوق. يمكن للمشترين شراؤه فوراً.') : undefined;
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={12} />
      <PageHead title={L('My market offers', 'عروضي في السوق')} sub={L('Post stock with three prices (advance, on delivery, 30 days). Any buyer on Tawreed can buy it instantly or send a counter-offer.', 'انشر بضاعتك بثلاثة أسعار (مقدم، عند التسليم، 30 يوماً). يمكن لأي مشترٍ الشراء فوراً أو إرسال سعر مقابل.')} />
      <Banner err={sp.err} msg={msg} />
      {pending.length > 0 && <TurnBar state="mine" title={L(`Your turn: ${pending.length} counter-offer(s) to answer`, `دورك: ${pending.length} أسعار مقابلة للرد`)} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label={L('Live offers', 'عروض نشطة')} value={live.length} />
        <Kpi label={L('Market orders', 'طلبات السوق')} value={d.sold.length} />
        <Kpi label={L('Market sales (excl. VAT)', 'مبيعات السوق (دون الضريبة)')} value={<Sar h={d.sold.reduce((s, x) => s + x.total, 0)} lang={lang} />} />
        <Kpi label={L('Counter-offers waiting', 'أسعار مقابلة بانتظارك')} value={pending.length} />
      </div>
      {pending.map((c) => {
        const o = d.offers.find((x) => x.id === c.offerId)!;
        const list = c.term === 'adv' ? o.priceAdvHalalas : c.term === 'nd' ? o.priceNdHalalas : o.price30Halalas;
        const gap = pctVs(c.unitHalalas, list) ?? 0;
        return (
          <ActionPanel key={c.id} lang={lang} testId={`counter-${o.number}`} title={<>{L('Counter-offer', 'سعر مقابل')} · {o.number}</>}
            footer={<>
              <form action={decideCounterAction}><input type="hidden" name="counterId" value={c.id} /><input type="hidden" name="accept" value="0" /><button className="btn-danger" data-testid="counter-decline">{L('Decline', 'رفض')}</button></form>
              <form action={decideCounterAction}><input type="hidden" name="counterId" value={c.id} /><input type="hidden" name="accept" value="1" /><button className="btn-pri" data-testid="counter-accept">{L('Accept and create order', 'قبول وإنشاء الطلب')}</button></form>
            </>}>
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-muted">{L('Buyer', 'المشتري')}</div><b><bdi>{c.buyerName}</bdi></b></div>
              <div><div className="text-xs text-muted">{L('Item', 'الصنف')}</div>{o.item}</div>
              <div><div className="text-xs text-muted">{L('Quantity · term', 'الكمية · الشرط')}</div>{fmtQty(c.qty)} {unitName(o.unit, lang)} · {termName(c.term, lang)}</div>
              <div><div className="text-xs text-muted">{L('Offered price', 'السعر المعروض')}</div><Sar h={c.unitHalalas} lang={lang} className="font-semibold" /> <span className="text-xs text-bad">({gap.toFixed(1)}%)</span></div>
            </div>
            <AIBox auto title={L('Deal check', 'فحص الصفقة')}>{L(`Your list price is SAR ${(list / 100).toFixed(2)}. Accepting gives an order of SAR ${(lineTotal(c.qty, c.unitHalalas) / 100).toLocaleString('en-US')} excl. VAT, ${Math.abs(gap).toFixed(1)}% below list.`, `سعرك المعلن ${(list / 100).toFixed(2)} ر.س. القبول يعطي طلباً بقيمة ${(lineTotal(c.qty, c.unitHalalas) / 100).toLocaleString('en-US')} ر.س دون الضريبة، أقل بـ${Math.abs(gap).toFixed(1)}% من المعلن.`)}</AIBox>
          </ActionPanel>
        );
      })}
      <details className="card" open={!d.offers.length}>
        <summary className="cursor-pointer font-semibold" data-testid="post-offer-toggle">+ {L('Post a new offer', 'انشر عرضاً جديداً')}</summary>
        <form action={postOfferAction} className="mt-4">
          <OfferForm lang={lang} defaultCity={me.company.city}
            index={d.index.map((i) => ({ key: i.key, label: `${lang === 'ar' ? i.itemAr : i.itemEn} · ${cityName(i.city, lang)}`, item: i.itemEn, category: i.category, unit: i.unitEn, city: i.city, value: i.valueHalalas }))}
            cities={CITIES.map((c) => ({ id: c.id, name: c.name[lang] }))} units={UNITS.map((u) => ({ id: u.id, name: u.name[lang] }))} categories={CATEGORIES.map((c) => ({ id: c.id, name: c.name[lang] }))} />
        </form>
      </details>
      <section className="card overflow-x-auto p-0">
        <div className="px-4 pt-4 font-semibold">{L('All my offers', 'كل عروضي')}</div>
        <table className="tbl mt-2" data-testid="my-offers">
          <thead><tr><th>{L('Offer', 'العرض')}</th><th>{L('Prices (adv / delivery / 30 d)', 'الأسعار (مقدم / تسليم / 30 يوم)')}</th><th>{L('Stock', 'المتوفر')}</th><th>{L('Valid until', 'صالح حتى')}</th><th>{L('Status', 'الحالة')}</th><th></th></tr></thead>
          <tbody>{d.offers.map((o) => (
            <tr key={o.id} data-testid={`my-offer-${o.number}`}>
              <td><b>{o.item}</b><div className="text-xs text-muted">{o.number} · {cityName(o.city, lang)}</div></td>
              <td className="num text-xs">{(o.priceAdvHalalas / 100).toFixed(2)} / {(o.priceNdHalalas / 100).toFixed(2)} / {(o.price30Halalas / 100).toFixed(2)}</td>
              <td className="num">{fmtQty(o.qtyAvailable)} {unitName(o.unit, lang)}<div className="text-xs text-muted">{d.sold.filter((s) => s.offerId === o.id).length} {L('orders', 'طلبات')}</div></td>
              <td className="text-xs">{fmtDate(o.validUntil, lang)}</td>
              <td><StatusPill kind="offer" status={o.validUntil < new Date() && o.status === 'active' ? 'paused' : o.status} lang={lang} /></td>
              <td>{o.status !== 'sold_out' && <form action={offerStatusAction}><input type="hidden" name="offerId" value={o.id} /><input type="hidden" name="status" value={o.status === 'active' ? 'paused' : 'active'} /><button className="btn btn-sm">{o.status === 'active' ? L('Pause', 'إيقاف') : L('Resume', 'استئناف')}</button></form>}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      {d.counters.filter((c) => c.status !== 'pending').length > 0 && (
        <section className="card"><div className="mb-2 font-semibold">{L('Counter-offer history', 'سجل الأسعار المقابلة')}</div>
          <ul className="divide-y divide-line text-sm">{d.counters.filter((c) => c.status !== 'pending').map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><bdi>{c.buyerName}</bdi> · {fmtQty(c.qty)} @ <Sar h={c.unitHalalas} lang={lang} /></span><span className="flex items-center gap-2"><StatusPill kind="counter" status={c.status} lang={lang} />{c.orderId && <Link href={`/app/orders/${c.orderId}`} className="text-xs text-brand-ink hover:underline">{L('Order', 'الطلب')} →</Link>}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
