import { setLang } from '@/app/actions/common';
import type { Lang } from '@/lib/i18n';

export function LangToggle({ lang, back }: { lang: Lang; back?: string }) {
  return (
    <form action={setLang}>
      <input type="hidden" name="lang" value={lang === 'ar' ? 'en' : 'ar'} />
      {back && <input type="hidden" name="back" value={back} />}
      <button type="submit" className="btn btn-sm" data-testid="lang-toggle" aria-label="Switch language">
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>
    </form>
  );
}
