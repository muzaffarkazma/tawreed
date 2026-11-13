import Link from 'next/link';
import { Logo } from './Logo';
import { LangToggle } from './LangToggle';
import type { Dict, Lang } from '@/lib/i18n';

export function PublicHeader({ t, lang, signedIn }: { t: Dict; lang: Lang; signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="wrap flex h-16 items-center gap-6">
        <Logo name={t.brand} sub={t.brandSub} />
        <nav className="hidden flex-1 items-center gap-5 text-sm text-muted md:flex">
          <Link href="/#how" className="hover:text-ink">{t.nav.how}</Link>
          <Link href="/#roles" className="hover:text-ink">{t.nav.roles}</Link>
          <Link href="/#features" className="hover:text-ink">{t.nav.product}</Link>
          <Link href="/pricing" className="hover:text-ink">{t.nav.pricing}</Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LangToggle lang={lang} />
          {signedIn ? (
            <Link href="/app" className="btn-pri">{t.nav.app}</Link>
          ) : (
            <>
              <Link href="/login" className="btn hidden sm:inline-flex" data-testid="nav-login">{t.nav.login}</Link>
              <Link href="/pricing" className="btn-pri" data-testid="nav-start">{t.nav.start}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ t }: { t: Dict }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="wrap flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted">
        <span>{t.footer}</span>
        <span className="flex gap-4"><Link href="/pricing">{t.nav.pricing}</Link><Link href="/login">{t.nav.login}</Link></span>
      </div>
    </footer>
  );
}
