/** Tiny inline trend line for price history (values in halalas). */
export function Spark({ values, w = 90, h = 26 }: { values: number[]; w?: number; h?: number }) {
  if (!values || values.length < 2) return <span className="text-xs text-muted">—</span>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(' ');
  const up = values.at(-1)! >= values[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="inline-block align-middle" style={{ direction: 'ltr' }}>
      <polyline points={pts} fill="none" className={up ? 'stroke-warn' : 'stroke-ok'} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
