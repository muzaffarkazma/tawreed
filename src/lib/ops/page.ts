import 'server-only';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { can } from './core';
import type { Me } from './services';
import type { Lang } from './catalog';

/** Guard for Release 2/3 pages: signed in, right company type, and at least one of the permissions. */
export async function opsPage(o: { type?: 'buyer' | 'supplier'; perms?: string[] } = {}) {
  const user = await requireUser();
  if (o.type && user.company?.type !== o.type) redirect('/app?denied=1');
  if (o.perms && !o.perms.some((p) => can(user, p))) redirect('/app?denied=1');
  const { lang } = await getT();
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return { me: user as Me, lang: lang as Lang, L };
}

export const isUuid = (v: string | undefined): v is string => !!v && /^[0-9a-f-]{36}$/.test(v);
export const ZERO = '00000000-0000-0000-0000-000000000000';

/** "in 3 h 20 min" / "2 days ago" style relative time, bilingual. */
export function relTime(d: Date, lang: Lang, now = Date.now()) {
  const ms = +new Date(d) - now; const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000), hrs = Math.floor(abs / 3600000), days = Math.floor(abs / 86400000);
  const en = days >= 1 ? `${days} d ${hrs % 24} h` : hrs >= 1 ? `${hrs} h ${mins % 60} min` : `${mins} min`;
  const ar = days >= 1 ? `${days} يوم ${hrs % 24} س` : hrs >= 1 ? `${hrs} س ${mins % 60} د` : `${mins} د`;
  if (lang === 'ar') return ms >= 0 ? `خلال ${ar}` : `قبل ${ar}`;
  return ms >= 0 ? `in ${en}` : `${en} ago`;
}
