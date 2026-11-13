/**
 * AI configuration — the ONE place to choose the AI provider.
 *
 * Set at least one key in .env:
 *   OPENAI_API_KEY=sk-...          (OpenAI)
 *   ANTHROPIC_API_KEY=sk-ant-...   (Claude)
 *
 * AI_PROVIDER controls which one is used:
 *   auto      -> uses whichever key is present; if both are present, uses AI_PREFERRED first
 *   openai    -> always OpenAI first
 *   anthropic -> always Claude first
 *   mock      -> no external calls (demo / automated tests)
 *
 * With AI_FALLBACK=true, if the first provider fails (bad key, outage, rate limit)
 * the system retries the same request on the other provider, when its key is set.
 */

export type ProviderName = 'openai' | 'anthropic' | 'mock';

export interface AIConfig {
  provider: 'auto' | ProviderName;
  preferred: 'openai' | 'anthropic';
  fallback: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
  openai: { apiKey?: string; model: string; baseUrl: string };
  anthropic: { apiKey?: string; model: string; baseUrl: string; version: string };
}

const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== '' ? v.trim() : undefined;
};

export function getAIConfig(): AIConfig {
  return {
    provider: (env('AI_PROVIDER') as AIConfig['provider']) ?? 'auto',
    preferred: (env('AI_PREFERRED') as AIConfig['preferred']) ?? 'anthropic',
    fallback: (env('AI_FALLBACK') ?? 'true') === 'true',
    timeoutMs: Number(env('AI_TIMEOUT_MS') ?? 45000),
    maxOutputTokens: Number(env('AI_MAX_OUTPUT_TOKENS') ?? 2000),
    temperature: Number(env('AI_TEMPERATURE') ?? 0.2),
    openai: {
      apiKey: env('OPENAI_API_KEY'),
      // Change to any chat model your OpenAI account can use.
      model: env('OPENAI_MODEL') ?? 'gpt-4o-mini',
      baseUrl: env('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1'
    },
    anthropic: {
      apiKey: env('ANTHROPIC_API_KEY'),
      // Change to any Claude model your Anthropic account can use.
      model: env('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5',
      baseUrl: env('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com/v1',
      version: env('ANTHROPIC_VERSION') ?? '2023-06-01'
    }
  };
}
