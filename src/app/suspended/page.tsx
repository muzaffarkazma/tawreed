import { getT } from '@/lib/i18n';
import { Logo } from '@/components/Logo';
import { logoutAction } from '@/app/actions/auth';

export default async function Suspended() {
  const { t } = await getT();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md text-center">
        <div className="mb-4 flex justify-center"><Logo name={t.brand} /></div>
        <h1 className="text-lg font-semibold" data-testid="suspended-title">{t.suspended.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.suspended.body}</p>
        <form action={logoutAction} className="mt-5"><button className="btn">{t.app.logout}</button></form>
      </div>
    </div>
  );
}
