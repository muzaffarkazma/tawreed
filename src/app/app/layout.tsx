import Link from 'next/link';
import { headers } from 'next/headers';
import { and, desc, eq, or } from 'drizzle-orm';
import type { CSSProperties } from 'react';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { roleLabel } from '@/lib/roles';
import { withTenant, schema } from '@/db';
import { can, roleVar, initials } from '@/lib/ops/core';
import { myTasks, unreadCount, myNotifications } from '@/lib/ops/tasks';
import { Logo } from '@/components/Logo';
import { Icon, Activity, fmtDual, fmtDate } from '@/components/ops';
import { LangSeg } from '@/components/shell/LangSeg';
import { Bell } from '@/components/shell/Bell';
import { NavItem, GlobalTurn, Rail, Shell } from '@/components/shell/Chrome';
import { logoutAction } from '@/app/actions/auth';
import type { Me } from '@/lib/ops/services';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, lang } = await getT();
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const c = user.company!;
  const me = user as Me;
  const path = (await headers()).get('x-pathname') ?? '/app';
  const [tasks, unread, notes, side] = await Promise.all([
    myTasks(me), unreadCount(me), myNotifications(me, 12),
    withTenant(c.id, async (tx) => ({
      team: await tx.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role }).from(schema.users).where(and(eq(schema.users.companyId, c.id), eq(schema.users.active, true))).limit(9),
      events: await tx.select().from(schema.caseEvents).where(or(eq(schema.caseEvents.buyerCompanyId, c.id), eq(schema.caseEvents.supplierCompanyId, c.id))).orderBy(desc(schema.caseEvents.id)).limit(14)
    }))
  ]);
  const count = (prefix: string) => tasks.filter((x) => x.href.startsWith(prefix)).length;
  type Item = [href: string, label: string, id: string, icon: string, badge?: number];
  const buyer = c.type === 'buyer';
  const work: Item[] = (buyer
    ? [
        (can(user, 'request.create') || can(user, 'request.triage')) && ['/app/requests', L('Requests', 'الطلبات'), 'nav-requests', 'file', count('/app/requests')],
        can(user, 'request.create') && ['/app/requests/new', L('New request', 'طلب جديد'), 'nav-new-request', 'plus'],
        can(user, 'market.buy') && ['/app/market', L('Market', 'السوق'), 'nav-market', 'box'],
        can(user, 'rfq.manage') && ['/app/rfqs', L('RFQs', 'طلبات العروض'), 'nav-rfqs', 'chat', count('/app/rfqs')],
        can(user, 'approval.decide') && ['/app/approvals', L('Approvals', 'الاعتمادات'), 'nav-approvals', 'check', count('/app/approvals')],
        can(user, 'order.view') && ['/app/orders', L('Orders', 'الطلبيات'), 'nav-orders', 'truck', count('/app/orders')],
        can(user, 'invoice.view') && ['/app/invoices', L('Invoices', 'الفواتير'), 'nav-invoices', 'money'],
        can(user, 'dispute.raise') && ['/app/disputes', L('Disputes', 'النزاعات'), 'nav-disputes', 'alert'],
        can(user, 'limits.edit') && ['/app/settings', L('Purchase limits', 'حدود الشراء'), 'nav-settings', 'lock']
      ]
    : [
        can(user, 'quote.submit') && ['/app/opportunities', L('Opportunities', 'الفرص'), 'nav-opportunities', 'spark', count('/app/opportunities')],
        can(user, 'offer.manage') && ['/app/offers', L('My offers', 'عروضي'), 'nav-offers', 'box', count('/app/offers')],
        can(user, 'order.view') && ['/app/orders', L('Orders', 'الطلبيات'), 'nav-orders', 'truck', count('/app/orders')],
        can(user, 'invoice.view') && ['/app/invoices', L('Invoices', 'الفواتير'), 'nav-invoices', 'money'],
        can(user, 'dispute.raise') && ['/app/disputes', L('Disputes', 'النزاعات'), 'nav-disputes', 'alert']
      ]).filter(Boolean) as Item[];
  const admin: Item[] = user.role === 'company_admin'
    ? [['/app/admin/users', t.app.users, 'nav-users', 'users'], ['/app/admin/company', t.app.company, 'nav-company', 'sliders'], ['/app/admin/billing', t.app.billing, 'nav-billing', 'card']]
    : [];
  const rc = (role: string) => ({ '--rc': roleVar(role, c.type) }) as CSSProperties;
  const Group = ({ title, items }: { title?: string; items: Item[] }) => items.length ? (
    <div className="flex gap-0.5 min-[821px]:flex-col">
      {title && <div className="hidden px-2.5 pb-1 pt-2 text-[11px] font-semibold text-muted min-[821px]:block">{title}</div>}
      {items.map(([href, label, id, icon, n]) => <NavItem key={href} href={href} testId={id} badge={n} icon={<Icon n={icon} className="h-[18px] w-[18px]" />}>{label}</NavItem>)}
    </div>
  ) : null;
  const first = tasks[0];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex min-h-[58px] flex-wrap items-center gap-3 px-4 py-1.5">
          <Logo name={t.brand} sub={t.brandSub} href="/app" />
          <div className="flex-1" />
          <div className="hidden text-end text-xs leading-tight text-muted lg:block" data-testid="today">{fmtDual(new Date(), lang)}</div>
          <LangSeg lang={lang} back={path} />
          <Bell unread={unread} items={notes.map((n) => ({ id: n.id, title: lang === 'ar' ? n.titleAr : n.titleEn, at: fmtDate(n.createdAt, lang, true), link: n.link, unread: n.unread }))}
            t={{ title: L('Notifications', 'الإشعارات'), none: L('No notifications yet', 'لا توجد إشعارات بعد'), all: L('All notifications', 'كل الإشعارات'), read: L('Mark all read', 'تعليم الكل كمقروء') }} />
          <form action={logoutAction}><button className="btn" data-testid="logout">{t.app.logout}</button></form>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-line bg-sunk px-4 py-2" data-testid="team-strip">
          <span className="me-1 whitespace-nowrap text-xs text-muted"><bdi data-testid="company-name" className="font-semibold text-ink">{c.name}</bdi> · {buyer ? t.pricing.buyers : t.pricing.suppliers} · {(lang === 'ar' ? c.subscription?.planNameAr : c.subscription?.planName) ?? ''}</span>
          {side.team.map((u) => (
            <span key={u.id} style={rc(u.role)} title={u.name}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full border bg-surface py-[5px] pe-3 ps-1.5 text-[13px] ${u.id === user.id ? 'border-[color:var(--rc)] font-semibold shadow-[inset_0_0_0_1px_var(--rc)]' : 'border-line'}`}>
              <span className="av h-6 w-6 rounded-full text-[11px]">{initials(u.name)}</span>{roleLabel(c.type, u.role, lang)}
              {u.id === user.id && tasks.length > 0 && <span className="h-2 w-2 rounded-full bg-warn shadow-[0_0_0_3px_rgb(var(--warn-soft))]" title={L('Action needed', 'مطلوب إجراء')} />}
            </span>
          ))}
        </div>
      </header>
      <Shell
        side={
          <nav className="flex flex-col gap-3.5 border-line bg-surface p-3 max-[820px]:flex-row max-[820px]:items-center max-[820px]:overflow-x-auto max-[820px]:border-b min-[821px]:border-e min-[821px]:px-3 min-[821px]:py-4" aria-label={L('Main', 'الرئيسية')}>
            <div className="flex shrink-0 items-center gap-2.5 rounded-[10px] bg-sunk p-2" style={rc(user.role)} data-testid="persona">
              <span className="av h-[38px] w-[38px] rounded-[10px]">{initials(user.name)}</span>
              <div className="min-w-0"><b className="block truncate text-[13.5px]"><bdi data-testid="me-name">{user.name}</bdi></b><span className="block text-xs leading-snug text-muted"><span data-testid="me-role">{roleLabel(c.type, user.role, lang)}</span> · <bdi>{c.name}</bdi></span></div>
            </div>
            <Group items={[['/app', t.app.dashboard, 'nav-dashboard', 'home', tasks.length]]} />
            <Group title={L('Work', 'العمل')} items={work} />
            <Group title={L('Company', 'الشركة')} items={admin} />
            <Group items={[['/app/profile', t.app.profile, 'nav-profile', 'key']]} />
            <div className="mt-auto hidden border-t border-line pt-3 text-xs text-muted min-[821px]:block">{L('Data hosted in KSA · PDPL', 'البيانات مستضافة في المملكة · نظام حماية البيانات')}</div>
          </nav>
        }
        rail={
          <Rail>
            {path !== '/app' && <div>
              <h4>{L('My tasks', 'مهامي')}<span className="num text-xs font-normal text-muted">{tasks.length}</span></h4>
              {!tasks.length ? <p className="text-[12.5px] text-muted">{L('Nothing is waiting on you.', 'لا شيء بانتظارك.')}</p> : (
                <ul className="space-y-1.5" data-testid="rail-tasks">{tasks.slice(0, 6).map((x) => (
                  <li key={`${x.href}${x.key}`}><Link href={x.href} className="block rounded-lg border border-line px-2.5 py-2 text-[12.5px] hover:border-brand hover:bg-brand-soft">
                    <span className="block font-medium">{x.action[lang]}</span><span className="block truncate text-muted">{x.ref} · <bdi>{x.title}</bdi></span></Link></li>))}
                </ul>)}
            </div>}
            <div><h4>{L('Live activity', 'النشاط المباشر')}</h4><Activity events={side.events} lang={lang} empty={L('Actions appear here as each role works.', 'تظهر الإجراءات هنا مع عمل كل دور.')} /></div>
          </Rail>
        }>
        <GlobalTurn task={first && { action: first.action[lang], ref: first.ref, title: first.title, href: first.href }} more={tasks.length - 1}
          t={{ turn: L('Your turn', 'دورك'), go: L('Go', 'انتقل'), more: L('more', 'أخرى') }} />
        {children}
      </Shell>
    </div>
  );
}
