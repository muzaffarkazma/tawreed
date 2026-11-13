import type { Bi, Lang } from './catalog';

export type Side = 'buyer' | 'supplier';
export interface FlowStep { status: string; side: Side | null; roles: string[]; perm: string; action: Bi; label: Bi }

/** The order lifecycle. `side`/`roles` say whose turn it is at each status. */
export const ORDER_FLOW: FlowStep[] = [
  { status: 'issued', side: 'supplier', roles: ['operations'], perm: 'order.fulfil', action: { en: 'Accept the purchase order', ar: 'قبول أمر الشراء' }, label: { en: 'PO issued', ar: 'صدر أمر الشراء' } },
  { status: 'accepted', side: 'supplier', roles: ['operations'], perm: 'order.fulfil', action: { en: 'Prepare and mark ready to ship', ar: 'تجهيز الشحنة' }, label: { en: 'Accepted', ar: 'مقبول' } },
  { status: 'ready', side: 'buyer', roles: ['logistics'], perm: 'order.logistics', action: { en: 'Book carrier and dispatch', ar: 'حجز الناقل والإرسال' }, label: { en: 'Ready to ship', ar: 'جاهز للشحن' } },
  { status: 'in_transit', side: 'buyer', roles: ['logistics'], perm: 'order.logistics', action: { en: 'Confirm proof of delivery', ar: 'تأكيد إثبات التسليم' }, label: { en: 'In transit', ar: 'قيد النقل' } },
  { status: 'delivered', side: 'buyer', roles: ['buyer', 'procurement'], perm: 'order.receive', action: { en: 'Confirm goods received', ar: 'تأكيد الاستلام' }, label: { en: 'Delivered', ar: 'تم التسليم' } },
  { status: 'received', side: 'buyer', roles: ['quality'], perm: 'order.qc', action: { en: 'Inspect the delivery', ar: 'فحص الشحنة' }, label: { en: 'Received', ar: 'تم الاستلام' } },
  { status: 'qc_passed', side: 'supplier', roles: ['finance'], perm: 'invoice.issue', action: { en: 'Issue the e-invoice', ar: 'إصدار الفاتورة الإلكترونية' }, label: { en: 'Quality passed', ar: 'اجتاز الفحص' } },
  { status: 'invoiced', side: 'buyer', roles: ['finance'], perm: 'order.pay', action: { en: 'Match and pay the invoice', ar: 'مطابقة الفاتورة ودفعها' }, label: { en: 'Invoiced', ar: 'صدرت الفاتورة' } },
  { status: 'paid', side: 'buyer', roles: ['buyer', 'procurement'], perm: 'order.rate', action: { en: 'Rate the supplier', ar: 'تقييم المورد' }, label: { en: 'Paid', ar: 'مدفوع' } },
  { status: 'closed', side: null, roles: [], perm: '', action: { en: 'Order complete', ar: 'اكتمل الطلب' }, label: { en: 'Closed', ar: 'مغلق' } }
];
export const flowStep = (status: string) => ORDER_FLOW.find((s) => s.status === status) ?? ORDER_FLOW.at(-1)!;
export const flowIndex = (status: string) => Math.max(0, ORDER_FLOW.findIndex((s) => s.status === status));

type Tone = 'ok' | 'warn' | 'info' | 'mute' | 'bad';
const S = (en: string, ar: string, tone: Tone) => ({ name: { en, ar }, tone });

export const STATUS: Record<string, Record<string, { name: Bi; tone: Tone }>> = {
  request: { submitted: S('Awaiting procurement', 'بانتظار المشتريات', 'warn'), sourcing: S('Sourcing', 'قيد التوريد', 'info'), done: S('Ordered', 'تم الطلب', 'ok'), cancelled: S('Cancelled', 'ملغى', 'mute') },
  rfq: { open: S('Bidding open', 'استقبال العروض', 'info'), evaluation: S('Evaluation', 'التقييم', 'warn'), pending_approval: S('Finance approval', 'اعتماد مالي', 'warn'), approved: S('Approved', 'معتمد', 'ok'), ordered: S('PO issued', 'صدر أمر الشراء', 'ok'), cancelled: S('Cancelled', 'ملغى', 'mute') },
  invite: { invited: S('New', 'جديد', 'warn'), viewed: S('Viewed', 'تمت المشاهدة', 'info'), quoted: S('Quoted', 'تم تقديم العرض', 'ok'), declined: S('Declined', 'اعتذر', 'mute') },
  quote: { submitted: S('Submitted', 'مقدَّم', 'info'), awarded: S('Won', 'فاز', 'ok'), lost: S('Not selected', 'لم يتم اختياره', 'mute') },
  approval: { pending: S('Pending', 'بانتظار', 'warn'), approved: S('Approved', 'معتمد', 'ok'), returned: S('Returned', 'مُعاد', 'bad') },
  order: {
    issued: S('PO issued', 'صدر أمر الشراء', 'warn'), accepted: S('Accepted', 'مقبول', 'info'), ready: S('Ready to ship', 'جاهز للشحن', 'info'),
    in_transit: S('In transit', 'قيد النقل', 'info'), delivered: S('Delivered', 'تم التسليم', 'warn'), received: S('Quality check', 'فحص الجودة', 'warn'),
    qc_passed: S('Awaiting invoice', 'بانتظار الفاتورة', 'info'), invoiced: S('Invoice review', 'مراجعة الفاتورة', 'warn'), paid: S('Paid', 'مدفوع', 'ok'),
    closed: S('Closed', 'مغلق', 'ok'), cancelled: S('Cancelled', 'ملغى', 'mute')
  },
  invoice: { submitted: S('To match', 'للمطابقة', 'warn'), variance: S('Variance', 'فرق', 'bad'), paid: S('Paid', 'مدفوعة', 'ok') },
  dispute: { open: S('Open', 'مفتوح', 'warn'), resolved: S('Resolved', 'محلول', 'ok') },
  counter: { pending: S('Pending', 'بانتظار', 'warn'), accepted: S('Accepted', 'مقبول', 'ok'), declined: S('Declined', 'مرفوض', 'bad') },
  offer: { active: S('Live', 'نشط', 'ok'), paused: S('Paused', 'متوقف', 'mute'), sold_out: S('Sold out', 'نفد', 'mute') }
};
export function statusOf(kind: string, status: string, lang: Lang) {
  const s = STATUS[kind]?.[status];
  return { label: s ? s.name[lang] : status, tone: s?.tone ?? 'mute' };
}
