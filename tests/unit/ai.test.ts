import { describe, it, expect } from 'vitest';
import { providerOrder, aiComplete, aiJson, parseJsonLoose, AIUnavailableError, type ProviderCall } from '@/lib/ai';
import type { AIConfig } from '@config/ai.config';

const base = (o: Partial<AIConfig> & { ok?: boolean; ak?: boolean } = {}): AIConfig => ({
  provider: 'auto', preferred: 'anthropic', fallback: true, timeoutMs: 2000, maxOutputTokens: 100, temperature: 0,
  openai: { apiKey: o.ok ? 'sk-test' : undefined, model: 'gpt-x', baseUrl: 'http://x' },
  anthropic: { apiKey: o.ak ? 'sk-ant-test' : undefined, model: 'claude-x', baseUrl: 'http://x', version: '2023-06-01' },
  ...o
});
const ok = (name: string): ProviderCall => async () => ({ text: `answer from ${name}`, model: `${name}-model` });
const boom: ProviderCall = async () => { throw new Error('401 invalid key'); };

describe('AI provider selection', () => {
  it('only an OpenAI key -> OpenAI', () => expect(providerOrder(base({ ok: true }))).toEqual(['openai']));
  it('only a Claude key -> Claude', () => expect(providerOrder(base({ ak: true }))).toEqual(['anthropic']));
  it('both keys, auto -> preferred first, then the other', () => {
    expect(providerOrder(base({ ok: true, ak: true }))).toEqual(['anthropic', 'openai']);
    expect(providerOrder(base({ ok: true, ak: true, preferred: 'openai' }))).toEqual(['openai', 'anthropic']);
  });
  it('fallback off -> single provider', () => expect(providerOrder(base({ ok: true, ak: true, fallback: false }))).toEqual(['anthropic']));
  it('forced provider without its key falls back to the other key', () => expect(providerOrder(base({ provider: 'openai', ak: true }))).toEqual(['anthropic']));
  it('no keys -> nothing configured', () => expect(providerOrder(base())).toEqual([]));
  it('mock mode ignores keys', () => expect(providerOrder(base({ provider: 'mock', ok: true }))).toEqual(['mock']));
});

describe('AI calls', () => {
  it('uses the first provider when it works', async () => {
    const r = await aiComplete({ prompt: 'hi' }, { cfg: base({ ok: true, ak: true }), calls: { anthropic: ok('claude'), openai: ok('openai') } });
    expect(r.provider).toBe('anthropic');
    expect(r.text).toBe('answer from claude');
  });
  it('falls back to the other provider when the first fails', async () => {
    const r = await aiComplete({ prompt: 'hi' }, { cfg: base({ ok: true, ak: true }), calls: { anthropic: boom, openai: ok('openai') } });
    expect(r.provider).toBe('openai');
    expect(r.attempts.map((a) => a.ok)).toEqual([false, true]);
  });
  it('throws a clear error when every provider fails', async () => {
    await expect(aiComplete({ prompt: 'hi' }, { cfg: base({ ok: true, ak: true }), calls: { anthropic: boom, openai: boom } })).rejects.toBeInstanceOf(AIUnavailableError);
  });
  it('throws when no key is configured', async () => {
    await expect(aiComplete({ prompt: 'hi' }, { cfg: base() })).rejects.toThrow(/No AI provider configured/);
  });
  it('aiJson parses JSON from either provider, even inside a code fence', async () => {
    const fenced: ProviderCall = async () => ({ text: 'Here you go:\n```json\n{"items":[{"name":"cement","qty":400}]}\n```', model: 'm' });
    const { data } = await aiJson<{ items: { qty: number }[] }>({ prompt: 'x' }, { cfg: base({ ok: true }), calls: { openai: fenced } });
    expect(data.items[0].qty).toBe(400);
  });
  it('parseJsonLoose rejects non-JSON', () => expect(() => parseJsonLoose('no json here')).toThrow());
});

describe('OpenAI and Claude adapters send the right request', () => {
  it('OpenAI: bearer key, chat/completions, json mode', async () => {
    const { callOpenAI } = await import('@/lib/ai/openai');
    let seen: { url: string; init: RequestInit } | null = null;
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ model: 'gpt-x', choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }), { status: 200 }); }) as typeof fetch;
    try {
      const r = await callOpenAI(base({ ok: true }), { prompt: 'p', json: true, system: 's' }, new AbortController().signal);
      expect(r.text).toBe('{"a":1}');
      expect(seen!.url).toBe('http://x/chat/completions');
      expect((seen!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
      const body = JSON.parse(String(seen!.init.body));
      expect(body.response_format).toEqual({ type: 'json_object' });
      expect(body.messages[0]).toEqual({ role: 'system', content: 's' });
    } finally { globalThis.fetch = orig; }
  });
  it('Claude: x-api-key, anthropic-version, messages API', async () => {
    const { callAnthropic } = await import('@/lib/ai/anthropic');
    let seen: { url: string; init: RequestInit } | null = null;
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ model: 'claude-x', content: [{ type: 'text', text: 'hello' }], usage: { input_tokens: 3, output_tokens: 1 } }), { status: 200 }); }) as typeof fetch;
    try {
      const r = await callAnthropic(base({ ak: true }), { prompt: 'p', system: 's' }, new AbortController().signal);
      expect(r.text).toBe('hello');
      expect(seen!.url).toBe('http://x/messages');
      const h = seen!.init.headers as Record<string, string>;
      expect(h['x-api-key']).toBe('sk-ant-test');
      expect(h['anthropic-version']).toBe('2023-06-01');
      expect(JSON.parse(String(seen!.init.body)).system).toBe('s');
    } finally { globalThis.fetch = orig; }
  });
  it('surfaces provider error messages', async () => {
    const { callOpenAI } = await import('@/lib/ai/openai');
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), { status: 401 })) as unknown as typeof fetch;
    try { await expect(callOpenAI(base({ ok: true }), { prompt: 'p' }, new AbortController().signal)).rejects.toThrow(/401: Incorrect API key/); }
    finally { globalThis.fetch = orig; }
  });
});
