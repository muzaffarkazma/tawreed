'use client';
import { useActionState } from 'react';
import { askAiAction, answerAction, type AskState } from '@/app/actions/ops';

/** Buyer answers a supplier question; "Draft with AI" fills the box from the RFQ data (when a provider is configured). */
export function AnswerForm({ rfqId, questionId, t }: { rfqId: string; questionId: string; t: { placeholder: string; send: string; draft: string; busy: string } }) {
  const [st, draft, pending] = useActionState<AskState, FormData>(askAiAction, {});
  return (
    <form action={answerAction} className="space-y-2">
      <input type="hidden" name="rfqId" value={rfqId} /><input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="kind" value="qa" /><input type="hidden" name="ref" value={questionId} />
      <textarea key={st.text ?? 'empty'} className="input min-h-[70px]" name="answer" required minLength={2} defaultValue={st.text ?? ''} placeholder={t.placeholder} data-testid="answer-text" />
      {st.error && <div className="text-xs text-muted">{st.error}</div>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-pri btn-sm" data-testid="answer-send">{t.send}</button>
        <button className="btn btn-sm border-ai-line text-ai" formAction={draft} formNoValidate disabled={pending} data-testid="answer-draft">{pending ? t.busy : t.draft}</button>
      </div>
    </form>
  );
}
