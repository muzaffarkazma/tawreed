export type CompanyType = 'buyer' | 'supplier';

export interface RoleDef {
  id: string;
  label: { en: string; ar: string };
  summary: { en: string; ar: string };
}

export const ROLES: Record<CompanyType, RoleDef[]> = {
  buyer: [
    { id: 'company_admin', label: { en: 'Company admin', ar: 'مدير الحساب' }, summary: { en: 'Manages users, billing and company settings', ar: 'يدير المستخدمين والفوترة وإعدادات الشركة' } },
    { id: 'buyer', label: { en: 'Buyer', ar: 'المشتري' }, summary: { en: 'Raises requirements, buys from the market, confirms receipt', ar: 'يرفع الاحتياجات ويشتري من السوق ويؤكد الاستلام' } },
    { id: 'procurement', label: { en: 'Procurement manager', ar: 'مدير المشتريات' }, summary: { en: 'Runs RFQs, compares quotes, awards and issues POs', ar: 'يدير طلبات العروض ويقارن ويرسي ويصدر أوامر الشراء' } },
    { id: 'finance', label: { en: 'Finance', ar: 'المالية' }, summary: { en: 'Approves awards, sets limits, matches invoices and pays', ar: 'تعتمد الترسيات وتضع الحدود وتطابق الفواتير وتدفع' } },
    { id: 'quality', label: { en: 'Quality', ar: 'الجودة' }, summary: { en: 'Inspects deliveries: pass, partial or reject', ar: 'تفحص الشحنات: قبول أو قبول جزئي أو رفض' } },
    { id: 'logistics', label: { en: 'Logistics', ar: 'اللوجستيات' }, summary: { en: 'Books carriers, tracks shipments, confirms delivery', ar: 'تحجز الناقل وتتابع الشحنات وتؤكد التسليم' } }
  ],
  supplier: [
    { id: 'company_admin', label: { en: 'Company admin', ar: 'مدير الحساب' }, summary: { en: 'Manages users, billing and company settings', ar: 'يدير المستخدمين والفوترة وإعدادات الشركة' } },
    { id: 'sales', label: { en: 'Sales', ar: 'المبيعات' }, summary: { en: 'Answers RFQs, posts market offers, negotiates', ar: 'يرد على طلبات العروض وينشر العروض ويتفاوض' } },
    { id: 'operations', label: { en: 'Operations', ar: 'العمليات' }, summary: { en: 'Accepts POs, prepares and ships orders', ar: 'تقبل أوامر الشراء وتجهز الطلبات وتشحنها' } },
    { id: 'finance', label: { en: 'Finance', ar: 'المالية' }, summary: { en: 'Issues e-invoices and tracks payments', ar: 'تصدر الفواتير الإلكترونية وتتابع المدفوعات' } }
  ]
};

export function roleLabel(type: CompanyType, role: string, lang: 'en' | 'ar') {
  return ROLES[type].find((r) => r.id === role)?.label[lang] ?? role;
}

export function isValidRole(type: CompanyType, role: string) {
  return ROLES[type].some((r) => r.id === role);
}
