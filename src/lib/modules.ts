/** Workspace modules per role, with the release that delivers them. Release 1 = this build. */
export interface ModuleDef { id: string; release: 1 | 2 | 3; roles: string[]; name: { en: string; ar: string }; desc: { en: string; ar: string } }

export const BUYER_MODULES: ModuleDef[] = [
  { id: 'team', release: 1, roles: ['company_admin'], name: { en: 'Team and roles', ar: 'الفريق والأدوار' }, desc: { en: 'Create users and assign roles', ar: 'أنشئ المستخدمين وحدد أدوارهم' } },
  { id: 'requests', release: 2, roles: ['company_admin', 'buyer', 'procurement'], name: { en: 'Requests', ar: 'الطلبات' }, desc: { en: 'Raise needs; AI structures them into line items', ar: 'ارفع الاحتياجات ويحوّلها الذكاء الاصطناعي إلى بنود' } },
  { id: 'rfq', release: 2, roles: ['company_admin', 'procurement'], name: { en: 'RFQs and sourcing', ar: 'طلبات العروض والتوريد' }, desc: { en: 'Match suppliers, run bidding, compare quotes', ar: 'طابق الموردين وأدر العروض وقارنها' } },
  { id: 'approvals', release: 2, roles: ['company_admin', 'finance', 'procurement'], name: { en: 'Approvals and POs', ar: 'الاعتمادات وأوامر الشراء' }, desc: { en: 'Threshold approvals, budgets, purchase orders', ar: 'اعتمادات حسب الحد وميزانيات وأوامر شراء' } },
  { id: 'market', release: 3, roles: ['company_admin', 'buyer', 'procurement'], name: { en: 'Live market', ar: 'السوق المباشر' }, desc: { en: 'Buy supplier stock now or counter the price', ar: 'اشترِ من مخزون الموردين أو قدّم سعراً مقابلاً' } },
  { id: 'delivery', release: 3, roles: ['company_admin', 'logistics', 'buyer'], name: { en: 'Delivery and receipt', ar: 'التسليم والاستلام' }, desc: { en: 'Tracking, proof of delivery, goods receipt', ar: 'التتبع وإثبات التسليم وسند الاستلام' } },
  { id: 'quality', release: 3, roles: ['company_admin', 'quality'], name: { en: 'Quality inspection', ar: 'فحص الجودة' }, desc: { en: 'AI checklist: pass, partial or reject', ar: 'قائمة فحص ذكية: قبول أو جزئي أو رفض' } },
  { id: 'invoices', release: 3, roles: ['company_admin', 'finance'], name: { en: 'Invoices and payment', ar: 'الفواتير والدفع' }, desc: { en: 'ZATCA e-invoices, 3-way match, payment', ar: 'فواتير إلكترونية ومطابقة ثلاثية ودفع' } }
];

export const SUPPLIER_MODULES: ModuleDef[] = [
  { id: 'team', release: 1, roles: ['company_admin'], name: { en: 'Team and roles', ar: 'الفريق والأدوار' }, desc: { en: 'Create users and assign roles', ar: 'أنشئ المستخدمين وحدد أدوارهم' } },
  { id: 'opportunities', release: 2, roles: ['company_admin', 'sales'], name: { en: 'Opportunities', ar: 'الفرص' }, desc: { en: 'Matched RFQs with a reason for the match', ar: 'طلبات عروض مطابقة مع سبب المطابقة' } },
  { id: 'quotes', release: 2, roles: ['company_admin', 'sales'], name: { en: 'Quotes', ar: 'العروض' }, desc: { en: 'Quote builder with AI auto-fill', ar: 'منشئ عروض مع تعبئة ذكية' } },
  { id: 'offers', release: 3, roles: ['company_admin', 'sales'], name: { en: 'Market offers', ar: 'عروض السوق' }, desc: { en: 'Post stock with three payment-term prices', ar: 'انشر مخزونك بثلاثة أسعار حسب شروط الدفع' } },
  { id: 'orders', release: 2, roles: ['company_admin', 'operations', 'sales'], name: { en: 'Orders', ar: 'الطلبات' }, desc: { en: 'Accept POs and prepare shipments', ar: 'اقبل أوامر الشراء وجهّز الشحنات' } },
  { id: 'invoicing', release: 3, roles: ['company_admin', 'finance'], name: { en: 'E-invoicing and payments', ar: 'الفوترة والمدفوعات' }, desc: { en: 'ZATCA invoices and payment tracking', ar: 'فواتير إلكترونية ومتابعة المدفوعات' } }
];
