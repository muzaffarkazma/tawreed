import 'server-only';
import { withSystem, schema } from '@/db';
import { aiComplete, AIUnavailableError, type AIRequest, type AIResult } from './index';

/** aiComplete + a row in ai_calls for cost and audit tracking. */
export async function aiCompleteLogged(req: AIRequest, ctx: { companyId?: string | null; userId?: string | null }): Promise<AIResult> {
  try {
    const r = await aiComplete(req);
    await withSystem((tx) => tx.insert(schema.aiCalls).values({
      companyId: ctx.companyId ?? null, userId: ctx.userId ?? null, feature: req.feature ?? 'general',
      provider: r.provider, model: r.model, ok: true, latencyMs: r.latencyMs, inputTokens: r.inputTokens ?? null, outputTokens: r.outputTokens ?? null
    }));
    return r;
  } catch (e) {
    const attempts = e instanceof AIUnavailableError ? e.attempts : [];
    await withSystem((tx) => tx.insert(schema.aiCalls).values({
      companyId: ctx.companyId ?? null, userId: ctx.userId ?? null, feature: req.feature ?? 'general',
      provider: attempts.map((a) => a.provider).join(',') || 'none', model: '-', ok: false, latencyMs: 0,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500)
    }));
    throw e;
  }
}
