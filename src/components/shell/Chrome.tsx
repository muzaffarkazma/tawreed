'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Pages that are a single case (request, RFQ, order…) draw their own timeline rail and turn banner. */
const isCase = (p: string) => /^\/app\/(requests|rfqs|orders|opportunities)\/[0-9a-f-]{36}/.test(p) || /^\/app\/(requests|rfqs)\/new/.test(p);

export function NavItem({ href, icon, testId, badge, children }: { href: string; icon: ReactNode; testId: string; badge?: number; children: ReactNode }) {
  const p = usePathname();
  const on = href === '/app' || href === '/platform' ? p === href : p === href || p.startsWith(`${href}/`);
  return (
    <Link href={href} data-testid={testId} aria-current={on ? 'page' : undefined}
      className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-[9px] text-[14px] font-medium ${on ? 'bg-brand-soft text-brand-ink' : 'text-muted hover:bg-sunk hover:text-ink'}`}>
      {icon}<span className="flex-1">{children}</span>
      {!!badge && <span className="num rounded-full bg-bad px-1.5 text-[10.5px] font-semibold leading-[17px] text-white">{badge}</span>}
    </Link>
  );
}

/** Global "Your turn" banner, shown above list pages (case pages and the dashboard show their own). */
export function GlobalTurn({ task, more, t }: { task?: { action: string; ref: string; title: string; href: string }; more: number; t: { turn: string; go: string; more: string } }) {
  const p = usePathname();
  if (!task || p === '/app' || isCase(p) || p === task.href) return null;
  return (
    <div className="turn-mine" data-testid="global-turn">
      <span className="pulse" />
      <div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold text-ink">{t.turn}: {task.action}</div><div className="truncate text-[13px]">{task.ref} · {task.title}{more > 0 && ` · +${more} ${t.more}`}</div></div>
      <Link href={task.href} className="btn-pri btn-sm">{t.go}</Link>
    </div>
  );
}

/** Right-hand live rail (my tasks + live activity); case pages render their own case timeline instead. */
export function Rail({ children }: { children: ReactNode }) {
  const p = usePathname();
  if (isCase(p)) return null;
  return <aside className="rail flex min-w-0 flex-col gap-5 border-line bg-surface p-4 max-[1180px]:col-span-full max-[1180px]:border-t min-[1181px]:border-s">{children}</aside>;
}

export function Shell({ side, rail, children }: { side: ReactNode; rail?: ReactNode; children: ReactNode }) {
  const p = usePathname();
  const wide = isCase(p) || !rail;
  return (
    <div className={`grid min-h-[calc(100vh-110px)] grid-cols-1 min-[821px]:grid-cols-[232px_minmax(0,1fr)] ${wide ? '' : 'min-[1181px]:grid-cols-[232px_minmax(0,1fr)_300px]'}`}>
      {side}
      <main className="flex min-w-0 flex-col gap-4 px-4 pb-12 pt-5 min-[821px]:px-6">{children}</main>
      {rail}
    </div>
  );
}
