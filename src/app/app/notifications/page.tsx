import Link from 'next/link';
import { opsPage } from '@/lib/ops/page';
import { myNotifications } from '@/lib/ops/tasks';
import { markNotificationsReadAction } from '@/app/actions/ops';
import { Empty, PageHead, fmtDate } from '@/components/ops';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const { me, lang, L } = await opsPage();
  const rows = await myNotifications(me, 100);
  const unread = rows.filter((r) => r.unread).length;
  return (
    <div className="max-w-3xl space-y-6">
      <AutoRefresh seconds={10} />
      <PageHead title={L('Notifications', 'الإشعارات')} sub={L('Everything that needs you or your role, across requests, RFQs and orders.', 'كل ما يخصك أو يخص دورك في الطلبات وطلبات العروض والطلبيات.')}
        right={unread > 0 && <form action={markNotificationsReadAction}><button className="btn btn-sm" data-testid="mark-read">{L('Mark all as read', 'تعليم الكل كمقروء')}</button></form>} />
      {!rows.length ? <Empty title={L('No notifications yet', 'لا توجد إشعارات بعد')} /> : (
        <ul className="card divide-y divide-line p-0" data-testid="notifications">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? '/app'} className={`flex items-start gap-3 px-4 py-3 hover:bg-canvas ${n.unread ? 'bg-brand-soft/40' : ''}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? 'bg-brand' : 'bg-line'}`} />
                <span className="flex-1 text-sm"><span className={n.unread ? 'font-semibold' : ''}>{lang === 'ar' ? n.titleAr : n.titleEn}</span><span className="block text-xs text-muted">{fmtDate(n.createdAt, lang, true)}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
