'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { withSystem, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function setCompanyStatusAction(fd: FormData) {
  const me = await getCurrentUser();
  if (!me?.isPlatformAdmin) redirect('/login');
  const id = String(fd.get('companyId'));
  const status = fd.get('status') === 'suspended' ? 'suspended' : 'active';
  await withSystem(async (tx) => {
    await tx.update(schema.companies).set({ status }).where(eq(schema.companies.id, id));
    await tx.update(schema.companyProfiles).set({ active: status === 'active' }).where(eq(schema.companyProfiles.companyId, id));
    await audit(tx, { companyId: id, userId: me.id, action: status === 'suspended' ? 'company.suspended' : 'company.reactivated' });
  });
  revalidatePath('/platform');
}

// ---------------------------------------------------------------- platform-only: AI provider test, disputes, price index
import { aiCompleteLogged } from '@/lib/ai/log';
import { resolveDispute, OpsError } from '@/lib/ops/services';
import { getLang } from '@/lib/i18n';

async function requirePlatform() {
  const me = await getCurrentUser();
  if (!me?.isPlatformAdmin) redirect('/login');
  return me;
}

export interface AITestState { error?: string; text?: string; provider?: string; model?: string; latencyMs?: number; attempts?: string }
export async function aiTestAction(_p: AITestState, fd: FormData): Promise<AITestState> {
  const me = await requirePlatform();
  const prompt = String(fd.get('prompt') ?? '').trim().slice(0, 2000);
  if (!prompt) return { error: 'Enter a prompt' };
  try {
    const r = await aiCompleteLogged({
      feature: 'platform_test', prompt, maxTokens: 400,
      system: 'You are the AI assistant inside Tawreed, a Saudi B2B procurement platform. Answer briefly in the language of the question.'
    }, { companyId: null, userId: me.id });
    revalidatePath('/platform/ai');
    return { text: r.text, provider: r.provider, model: r.model, latencyMs: r.latencyMs, attempts: r.attempts.map((a) => `${a.provider}:${a.ok ? 'ok' : 'failed'}`).join(' → ') };
  } catch (e) {
    revalidatePath('/platform/ai');
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resolveDisputeAction(fd: FormData) {
  const me = await requirePlatform();
  let err = '';
  try { await resolveDispute(`${me.name} (Tawreed)`, String(fd.get('disputeId')), String(fd.get('resolution') ?? '').trim().slice(0, 2000)); }
  catch (e) { if (e instanceof OpsError) err = (await getLang()) === 'ar' ? e.ar : e.en; else throw e; }
  revalidatePath('/platform/disputes');
  redirect(err ? `/platform/disputes?err=${encodeURIComponent(err)}` : '/platform/disputes?msg=resolved');
}

export async function setVerifiedAction(fd: FormData) {
  await requirePlatform();
  const id = String(fd.get('companyId'));
  await withSystem((tx) => tx.update(schema.companyProfiles).set({ verified: fd.get('verified') === '1', updatedAt: new Date() }).where(eq(schema.companyProfiles.companyId, id)));
  revalidatePath('/platform');
}

export async function overrideIndexAction(fd: FormData) {
  await requirePlatform();
  const key = String(fd.get('key'));
  const raw = String(fd.get('value') ?? '').trim();
  await withSystem(async (tx) => {
    const [r] = await tx.select().from(schema.priceIndex).where(eq(schema.priceIndex.key, key));
    if (!r) return;
    if (raw === '') { await tx.update(schema.priceIndex).set({ overridden: false, updatedAt: new Date() }).where(eq(schema.priceIndex.key, key)); return; }
    const v = Math.round(Number(raw) * 100);
    if (!(v > 0)) return;
    const hist = [...(r.history ?? []), v].slice(-12);
    await tx.update(schema.priceIndex).set({ valueHalalas: v, overridden: true, history: hist, changePct: hist[0] ? Math.round(((v - hist[0]) / hist[0]) * 1000) / 10 : 0, updatedAt: new Date() }).where(eq(schema.priceIndex.key, key));
  });
  revalidatePath('/platform/index');
  redirect('/platform/index?msg=saved');
}
