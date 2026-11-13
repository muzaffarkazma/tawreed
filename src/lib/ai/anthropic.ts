import type { ProviderCall } from './index';

export const callAnthropic: ProviderCall = async (cfg, req, signal) => {
  const res = await fetch(`${cfg.anthropic.baseUrl}/messages`, {
    method: 'POST', signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.anthropic.apiKey ?? '',
      'anthropic-version': cfg.anthropic.version
    },
    body: JSON.stringify({
      model: cfg.anthropic.model,
      max_tokens: req.maxTokens ?? cfg.maxOutputTokens,
      temperature: req.temperature ?? cfg.temperature,
      ...(req.system ? { system: req.system } : {}),
      messages: [{ role: 'user', content: req.json ? `${req.prompt}\n\nRespond with one JSON object only, no other text.` : req.prompt }]
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${body?.error?.message ?? res.statusText}`);
  const text = Array.isArray(body?.content) ? body.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('') : undefined;
  if (typeof text !== 'string' || text === '') throw new Error('Anthropic returned no text');
  return { text, model: body.model ?? cfg.anthropic.model, inputTokens: body?.usage?.input_tokens, outputTokens: body?.usage?.output_tokens };
};
