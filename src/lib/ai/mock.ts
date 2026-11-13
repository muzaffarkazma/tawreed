import type { ProviderCall } from './index';

/** Deterministic offline provider for demos and automated tests (AI_PROVIDER=mock). */
export const callMock: ProviderCall = async (_cfg, req) => {
  if (req.json) {
    return { text: JSON.stringify({ ok: true, echo: req.prompt.slice(0, 80), note: 'mock provider' }), model: 'mock-1' };
  }
  return { text: `Mock AI answer: ${req.prompt.slice(0, 120)}`, model: 'mock-1' };
};
