import type { Tx } from '@/db';
import { schema } from '@/db';

export async function audit(tx: Tx, e: { companyId?: string | null; userId?: string | null; action: string; entity?: string; entityId?: string; data?: unknown }) {
  await tx.insert(schema.auditLog).values({
    companyId: e.companyId ?? null, userId: e.userId ?? null, action: e.action,
    entity: e.entity ?? null, entityId: e.entityId ?? null, data: (e.data ?? null) as object | null
  });
}
