import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { listPlans } from '@/lib/plans';
import { formatSar } from '@/lib/billing';
import { getCurrentUser } from '@/lib/auth';
import { PublicHeader } from '@/components/PublicHeader';
import { SignupForm } from './SignupForm';

export const dynamic = 'force-dynamic';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; cycle?: string }> }) {
  const { t, lang } = await getT();
  const sp = await searchParams;
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === sp.plan);
  if (!plan) redirect('/pricing');
  const cycle = sp.cycle === 'yearly' ? 'yearly' : 'monthly';
  const user = await getCurrentUser();
  const price = cycle === 'yearly' ? plan.yearlyHalalas : plan.monthlyHalalas;
  return (
    <>
      <PublicHeader t={t} lang={lang} signedIn={!!user} />
      <main className="wrap max-w-3xl py-10">
        <h1 className="h1">{t.signup.title}</h1>
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3" data-testid="selected-plan">
          <div>
            <div className="text-xs text-muted">{t.signup.plan}</div>
            <div className="font-semibold">{plan.audience === 'buyer' ? t.pricing.buyers : t.pricing.suppliers} · {plan.name[lang]} · {cycle === 'yearly' ? t.pricing.yearly : t.pricing.monthly}</div>
            <div className="text-sm text-muted">{formatSar(price, lang)} + VAT · {plan.maxUsers} {t.pricing.users}</div>
          </div>
          <Link href={`/pricing?for=${plan.audience}`} className="btn btn-sm">{t.signup.change}</Link>
        </div>
        <SignupForm planId={plan.id} cycle={cycle} audience={plan.audience} t={t.signup} auth={t.auth} />
      </main>
    </>
  );
}
