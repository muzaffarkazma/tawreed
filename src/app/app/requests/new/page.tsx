import { opsPage } from '@/lib/ops/page';
import { PageHead, Banner } from '@/components/ops';
import { CITIES, UNITS, CATEGORIES } from '@/lib/ops/catalog';
import { NewRequestForm } from './NewRequestForm';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { me, lang, L } = await opsPage({ type: 'buyer', perms: ['request.create'] });
  const sp = await searchParams;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHead back={{ href: '/app/requests', label: L('Requests', 'الطلبات') }} title={L('New request', 'طلب جديد')}
        sub={L('Write what you need the way you would say it. AI structures it into line items and prices each one against the Tawreed index. You can edit everything before submitting.', 'اكتب احتياجك كما تقوله. يحوّله الذكاء الاصطناعي إلى بنود ويسعّر كل بند مقابل مؤشر توريد. يمكنك تعديل كل شيء قبل الإرسال.')} />
      <Banner err={sp.err} />
      <NewRequestForm lang={lang} defaultCity={me.company.city}
        cities={CITIES.map((c) => ({ id: c.id, name: c.name[lang] }))} units={UNITS.map((u) => ({ id: u.id, name: u.name[lang] }))} categories={CATEGORIES.map((c) => ({ id: c.id, name: c.name[lang] }))} />
    </div>
  );
}
