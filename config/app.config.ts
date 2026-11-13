/**
 * App and payment configuration (read from .env).
 *
 * PAYMENT_MODE:
 *   bypass  -> no card needed; checkout shows "Activate (test mode)" and the subscription is activated at once
 *   sandbox -> Moyasar test mode: use MOYASAR_PUBLISHABLE_KEY=pk_test_... and MOYASAR_SECRET_KEY=sk_test_...
 *   live    -> Moyasar live keys (pk_live_ / sk_live_)
 */
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== '' ? v.trim() : undefined;
};

export function getAppConfig() {
  const mode = (env('PAYMENT_MODE') ?? 'bypass') as 'bypass' | 'sandbox' | 'live';
  return {
    appUrl: env('APP_URL') ?? 'http://localhost:3000',
    sessionSecret: env('SESSION_SECRET') ?? 'dev-only-secret-change-me-dev-only-secret',
    sessionHours: Number(env('SESSION_HOURS') ?? 12),
    payment: {
      mode,
      moyasar: {
        publishableKey: env('MOYASAR_PUBLISHABLE_KEY'),
        secretKey: env('MOYASAR_SECRET_KEY'),
        apiBase: env('MOYASAR_API_BASE') ?? 'https://api.moyasar.com/v1'
      }
    }
  };
}
