import type { ProviderCall } from './index';

export const callOpenAI: ProviderCall = async (cfg, req, signal) => {
  const messages = [] as { role: 'system' | 'user'; content: string }[];
  if (req.system) messages.push({ role: 'system', content: req.system });
  messages.push({ role: 'user', content: req.json ? `${req.prompt}\n\nRespond with one JSON object only.` : req.prompt });
  const res = await fetch(`${cfg.openai.baseUrl}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.openai.apiKey}` },
    body: JSON.stringify({
      model: cfg.openai.model, messages,
      max_tokens: req.maxTokens ?? cfg.maxOutputTokens,
      temperature: req.temperature ?? cfg.temperature,
      ...(req.json ? { response_format: { type: 'json_object' } } : {})
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message ?? res.statusText}`);
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('OpenAI returned no text');
  return { text, model: body.model ?? cfg.openai.model, inputTokens: body?.usage?.prompt_tokens, outputTokens: body?.usage?.completion_tokens };
};
