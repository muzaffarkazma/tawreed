/**
 * Provider-agnostic AI. Every feature calls `aiComplete()` / `aiJson()`; which model answers
 * is decided only by config/ai.config.ts (+ .env). Works with an OpenAI key, a Claude key, or both.
 */
import { getAIConfig, type AIConfig, type ProviderName } from '@config/ai.config';
import { callOpenAI } from './openai';
import { callAnthropic } from './anthropic';
import { callMock } from './mock';

export interface AIRequest {
  system?: string;
  prompt: string;
  /** Ask the model to return a single JSON object. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  feature?: string;
}

export interface AIResult {
  text: string;
  provider: ProviderName;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  attempts: { provider: ProviderName; ok: boolean; error?: string }[];
}

export class AIUnavailableError extends Error {
  constructor(message: string, public attempts: AIResult['attempts']) { super(message); }
}

export type ProviderCall = (cfg: AIConfig, req: AIRequest, signal: AbortSignal) => Promise<{ text: string; model: string; inputTokens?: number; outputTokens?: number }>;

const CALLS: Record<ProviderName, ProviderCall> = { openai: callOpenAI, anthropic: callAnthropic, mock: callMock };

/** Order in which providers are tried for the current config. */
export function providerOrder(cfg: AIConfig = getAIConfig()): ProviderName[] {
  const has = { openai: !!cfg.openai.apiKey, anthropic: !!cfg.anthropic.apiKey };
  if (cfg.provider === 'mock') return ['mock'];
  const other = (p: 'openai' | 'anthropic') => (p === 'openai' ? 'anthropic' : 'openai');
  let first: 'openai' | 'anthropic' | null;
  if (cfg.provider === 'openai' || cfg.provider === 'anthropic') first = has[cfg.provider] ? cfg.provider : null;
  else first = has[cfg.preferred] ? cfg.preferred : has[other(cfg.preferred)] ? other(cfg.preferred) : null;
  const order: ProviderName[] = [];
  if (first) order.push(first);
  if (cfg.fallback) {
    const second = first ? other(first) : null;
    if (second && has[second]) order.push(second);
    if (!first) (['openai', 'anthropic'] as const).forEach((p) => has[p] && order.push(p));
  }
  return order;
}

export function aiStatus(cfg: AIConfig = getAIConfig()) {
  const order = providerOrder(cfg);
  return {
    configured: order.length > 0,
    mode: cfg.provider,
    order,
    openai: { keySet: !!cfg.openai.apiKey, model: cfg.openai.model },
    anthropic: { keySet: !!cfg.anthropic.apiKey, model: cfg.anthropic.model },
    fallback: cfg.fallback
  };
}

export async function aiComplete(req: AIRequest, deps: { calls?: Partial<Record<ProviderName, ProviderCall>>; cfg?: AIConfig } = {}): Promise<AIResult> {
  const cfg = deps.cfg ?? getAIConfig();
  const order = providerOrder(cfg);
  if (order.length === 0) throw new AIUnavailableError('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env (or AI_PROVIDER=mock).', []);
  const attempts: AIResult['attempts'] = [];
  for (const p of order) {
    const call = deps.calls?.[p] ?? CALLS[p];
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    try {
      const out = await call(cfg, req, ctrl.signal);
      attempts.push({ provider: p, ok: true });
      return { ...out, provider: p, latencyMs: Date.now() - started, attempts };
    } catch (e) {
      attempts.push({ provider: p, ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally { clearTimeout(timer); }
  }
  throw new AIUnavailableError(`All AI providers failed: ${attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ')}`, attempts);
}

/** Same as aiComplete but parses a JSON object from the answer. */
export async function aiJson<T = unknown>(req: Omit<AIRequest, 'json'>, deps?: Parameters<typeof aiComplete>[1]): Promise<{ data: T; result: AIResult }> {
  const result = await aiComplete({ ...req, json: true }, deps);
  return { data: parseJsonLoose<T>(result.text), result };
}

export function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI answer did not contain JSON');
  return JSON.parse(body.slice(start, end + 1)) as T;
}
