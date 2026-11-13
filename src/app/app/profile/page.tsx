import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const user = await requireUser();
  const { t } = await getT();
  return (
    <div className="max-w-md">
      <h1 className="h1">{t.app.profile}</h1>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      <div className="card mt-5"><ChangePasswordForm t={t.auth} /></div>
    </div>
  );
}
