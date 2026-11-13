import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const { t } = await getT();
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6"><Logo name={t.brand} sub={t.brandSub} /></div>
        <div className="card">
          <h1 className="text-lg font-semibold">{t.auth.changeTitle}</h1>
          {me.mustChangePassword && <p className="mt-1 text-sm text-muted">{t.auth.changeSub}</p>}
          <ChangePasswordForm t={t.auth} />
        </div>
      </div>
    </div>
  );
}
