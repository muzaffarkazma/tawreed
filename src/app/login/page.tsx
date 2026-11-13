import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { LangToggle } from '@/components/LangToggle';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { t, lang } = await getT();
  const me = await getCurrentUser();
  if (me) redirect(me.isPlatformAdmin ? '/platform' : '/app');
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between"><Logo name={t.brand} sub={t.brandSub} /><LangToggle lang={lang} /></div>
        <div className="card">
          <h1 className="text-lg font-semibold">{t.auth.loginTitle}</h1>
          <LoginForm t={t.auth} />
        </div>
        <p className="mt-4 text-center text-sm text-muted">{t.auth.noAccount} <Link href="/pricing" className="font-medium text-brand">{t.auth.seePlans}</Link></p>
      </div>
    </div>
  );
}
