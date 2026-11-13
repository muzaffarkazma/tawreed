import { getT } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { listPlans } from '@/lib/plans';
import { PublicHeader, PublicFooter } from '@/components/PublicHeader';
import { PricingTable } from '@/components/PricingTable';

export const dynamic = 'force-dynamic';

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { t, lang } = await getT();
  const sp = await searchParams;
  const [user, plans] = await Promise.all([getCurrentUser(), listPlans()]);
  return (
    <>
      <PublicHeader t={t} lang={lang} signedIn={!!user} />
      <main className="wrap py-14">
        <div className="mb-8 text-center">
          <h1 className="h1">{t.pricing.title}</h1>
          <p className="mt-2 text-sm text-muted">{t.pricing.sub}</p>
        </div>
        <PricingTable plans={plans} lang={lang} l={t.pricing} initialAudience={sp.for === 'supplier' ? 'supplier' : 'buyer'} />
      </main>
      <PublicFooter t={t} />
    </>
  );
}
