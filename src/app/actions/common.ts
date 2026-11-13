'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function setLang(formData: FormData) {
  const lang = formData.get('lang') === 'ar' ? 'ar' : 'en';
  (await cookies()).set('lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const back = String(formData.get('back') ?? '') || (await headers()).get('referer') || '/';
  let path = '/';
  try { const u = new URL(back, 'http://x'); path = u.pathname + u.search; } catch { /* keep / */ }
  redirect(path.startsWith('/') ? path : '/');
}
