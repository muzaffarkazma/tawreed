import { setLang } from '@/app/actions/common';

/** EN | عربي segmented switch, as in the prototype header. */
export function LangSeg({ lang, back }: { lang: 'en' | 'ar'; back?: string }) {
  return (
    <form action={setLang} className="seg" role="group" aria-label="Language">
      {back && <input type="hidden" name="back" value={back} />}
      <button name="lang" value="en" aria-pressed={lang === 'en'} data-testid={lang === 'ar' ? 'lang-toggle' : undefined}>EN</button>
      <button name="lang" value="ar" aria-pressed={lang === 'ar'} data-testid={lang === 'en' ? 'lang-toggle' : undefined}>عربي</button>
    </form>
  );
}
