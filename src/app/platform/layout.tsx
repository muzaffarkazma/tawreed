import { headers } from 'next/headers';
import type { CSSProperties } from 'react';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { Logo } from '@/components/Logo';
import { Icon, fmtDual } from '@/components/ops';
import { LangSeg } from '@/components/shell/LangSeg';
import { NavItem, Shell } from '@/components/shell/Chrome';
import { initials } from '@/lib/ops/core';
import { logoutAction } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser({ platform: true });
  const { t, lang } = await getT();
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const path = (await headers()).get('x-pathname') ?? '/platform';
  const nav: [string, string, string, string][] = [
    ['/platform', L('Control tower', 'برج التحكم'), 'pnav-overview', 'chart'],
    ['/platform/disputes', L('Disputes', 'النزاعات'), 'pnav-disputes', 'alert'],
    ['/platform/index', L('Price index', 'مؤشر الأسعار'), 'pnav-index', 'money'],
    ['/platform/ai', L('AI settings', 'إعدادات الذكاء الاصطناعي'), 'pnav-ai', 'spark']
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex min-h-[58px] flex-wrap items-center gap-3 px-4 py-1.5">
          <Logo name={t.brand} sub={t.platform.title} href="/platform" />
          <div className="flex-1" />
          <div className="hidden text-end text-xs leading-tight text-muted lg:block">{fmtDual(new Date(), lang)}</div>
          <LangSeg lang={lang} back={path} />
          <form action={logoutAction}><button className="btn" data-testid="logout">{t.app.logout}</button></form>
        </div>
      </header>
      <Shell side={
        <nav className="flex flex-col gap-3.5 border-line bg-surface p-3 max-[820px]:flex-row max-[820px]:items-center max-[820px]:overflow-x-auto max-[820px]:border-b min-[821px]:border-e min-[821px]:px-3 min-[821px]:py-4" aria-label={L('Main', 'الرئيسية')}>
          <div className="flex shrink-0 items-center gap-2.5 rounded-[10px] bg-sunk p-2" style={{ '--rc': 'var(--r-admin)' } as CSSProperties}>
            <span className="av h-[38px] w-[38px] rounded-[10px]">{initials(me.name)}</span>
            <div className="min-w-0"><b className="block truncate text-[13.5px]"><bdi>{me.name}</bdi></b><span className="block text-xs leading-snug text-muted">{L('Super admin · Tawreed', 'مدير المنصة · توريد')}</span></div>
          </div>
          <div className="flex gap-0.5 min-[821px]:flex-col">{nav.map(([h, l, id, i]) => <NavItem key={h} href={h} testId={id} icon={<Icon n={i} className="h-[18px] w-[18px]" />}>{l}</NavItem>)}</div>
          <div className="mt-auto hidden border-t border-line pt-3 text-xs text-muted min-[821px]:block">{me.email}</div>
        </nav>
      }>{children}</Shell>
    </div>
  );
}
