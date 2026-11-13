import { createHash, randomUUID } from 'node:crypto';

/**
 * ZATCA simplified-invoice QR (Phase 1 TLV): tag 1 seller name, 2 VAT number, 3 timestamp,
 * 4 total incl. VAT, 5 VAT amount, base64 encoded. Phase 2 clearance via the ZATCA Fatoora API
 * needs a CSID from the ZATCA portal and is wired in later (see README).
 */
export function zatcaQr(seller: string, vatNumber: string, issuedAt: Date, totalHalalas: number, vatHalalas: number) {
  const fields = [seller, vatNumber, issuedAt.toISOString(), (totalHalalas / 100).toFixed(2), (vatHalalas / 100).toFixed(2)];
  const parts = fields.map((v, i) => {
    const bytes = Buffer.from(v, 'utf8');
    return Buffer.concat([Buffer.from([i + 1, bytes.length]), bytes]);
  });
  return Buffer.concat(parts).toString('base64');
}

export function invoiceIdentity(payload: unknown) {
  return { uuid: randomUUID(), hash: createHash('sha256').update(JSON.stringify(payload)).digest('base64') };
}

/** Reads a TLV QR back (used by tests and the invoice view). */
export function decodeQr(b64: string): string[] {
  const buf = Buffer.from(b64, 'base64');
  const out: string[] = [];
  for (let i = 0; i < buf.length;) { const len = buf[i + 1]; out.push(buf.subarray(i + 2, i + 2 + len).toString('utf8')); i += 2 + len; }
  return out;
}
