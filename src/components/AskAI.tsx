'use client';
import { useActionState } from 'react';
import { askAiAction, type AskState } from '@/app/actions/ops';

/** On-demand AI explanation. The prompt is built on the server from the record, never from the browser. */
export function AskAI({ kind, refId, label, title, busy }: { kind: 'compare' | 'approval'; refId: string; label: string; title: string; busy: string }) {
  const [st, act, pending] = useActionState<AskState, FormData>(askAiAction, {});
  return (
    <div className="space-y-2">
      <form action={act}>
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="ref" value={refId} />
        <button className="btn btn-sm border-ai-line text-ai hover:bg-ai-soft" disabled={pending} data-testid={`ask-ai-${kind}`}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /></svg>
          {pending ? busy : label}
        </button>
      </form>
      {st.text && <div className="ai" data-testid="ask-ai-answer"><div className="ai-h">{title}<span className="ms-auto font-normal opacity-75">{st.provider}</span></div><div className="whitespace-pre-wrap leading-6">{st.text}</div></div>}
      {st.error && <div className="rounded-lg border border-dashed border-line bg-surface px-3 py-2 text-xs text-muted" data-testid="ask-ai-unavailable">{st.error}</div>}
    </div>
  );
}
