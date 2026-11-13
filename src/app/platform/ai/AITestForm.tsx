'use client';
import { useActionState } from 'react';
import { aiTestAction, type AITestState } from '@/app/actions/platform';
import type { Dict } from '@/lib/i18n';

export function AITestForm({ t }: { t: Dict['aiPage'] }) {
  const [state, action, pending] = useActionState<AITestState, FormData>(aiTestAction, {});
  return (
    <section className="card">
      <h2 className="font-semibold">{t.test}</h2>
      <form action={action} className="mt-3 space-y-3" data-testid="ai-test-form">
        <label className="block"><span className="label">{t.prompt}</span>
          <textarea className="input min-h-[90px]" name="prompt" data-testid="ai-prompt"
            defaultValue="Turn this into RFQ line items: 400 bags OPC cement, 12 tons 16mm rebar Grade 60, 120 safety helmets." /></label>
        <button className="btn-pri" disabled={pending} data-testid="ai-run">{pending ? '…' : t.run}</button>
      </form>
      {state.error && <div className="err mt-3" data-testid="ai-error">{state.error}</div>}
      {state.text && (
        <div className="mt-3 rounded-lg bg-canvas p-3 text-sm" data-testid="ai-answer">
          <div className="mb-1 text-xs text-muted">{t.answeredBy}: <b data-testid="ai-provider">{state.provider}</b> · {state.model} · {state.latencyMs} ms · {state.attempts}</div>
          <div className="whitespace-pre-wrap">{state.text}</div>
        </div>
      )}
    </section>
  );
}
