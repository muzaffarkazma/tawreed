import Link from 'next/link';

export function Logo({ name, sub, href = '/' }: { name: string; sub?: string; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" data-testid="logo">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold">{name}</span>
        {sub && <span className="block text-[11px] text-muted">{sub}</span>}
      </span>
    </Link>
  );
}
