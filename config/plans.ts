/**
 * Subscription plans. Edit prices, user limits and features here, then run `npm run db:seed`
 * (the seed upserts plans, so existing subscriptions keep working).
 * Prices are in SAR, excluding 15% VAT. Yearly = 10 x monthly (2 months free).
 */
export type Audience = 'buyer' | 'supplier';

export interface PlanDef {
  id: string;
  audience: Audience;
  name: { en: string; ar: string };
  tagline: { en: string; ar: string };
  monthlySar: number;
  yearlySar: number;
  maxUsers: number;
  highlight?: boolean;
  features: { en: string[]; ar: string[] };
}

export const PLANS: PlanDef[] = [
  {
    id: 'buyer-starter', audience: 'buyer', monthlySar: 1500, yearlySar: 15000, maxUsers: 5,
    name: { en: 'Starter', ar: 'المبتدئة' },
    tagline: { en: 'For a single site or small team', ar: 'لموقع واحد أو فريق صغير' },
    features: {
      en: ['Up to 5 users', 'AI requests and RFQs', 'Live market buying', 'ZATCA e-invoice matching', 'Email support'],
      ar: ['حتى 5 مستخدمين', 'طلبات وطلبات عروض بالذكاء الاصطناعي', 'الشراء من السوق المباشر', 'مطابقة الفواتير الإلكترونية', 'دعم عبر البريد']
    }
  },
  {
    id: 'buyer-business', audience: 'buyer', monthlySar: 4500, yearlySar: 45000, maxUsers: 25, highlight: true,
    name: { en: 'Business', ar: 'الأعمال' },
    tagline: { en: 'For procurement teams across projects', ar: 'لفرق المشتريات عبر المشاريع' },
    features: {
      en: ['Up to 25 users', 'Everything in Starter', 'Approvals, budgets and purchase limits', 'Quality and logistics roles', 'Spend analytics', 'Priority support'],
      ar: ['حتى 25 مستخدماً', 'كل مزايا المبتدئة', 'الاعتمادات والميزانيات وحدود الشراء', 'أدوار الجودة واللوجستيات', 'تحليلات الإنفاق', 'دعم ذو أولوية']
    }
  },
  {
    id: 'buyer-enterprise', audience: 'buyer', monthlySar: 12000, yearlySar: 120000, maxUsers: 100,
    name: { en: 'Enterprise', ar: 'المؤسسات' },
    tagline: { en: 'For multi-entity groups', ar: 'للمجموعات متعددة الكيانات' },
    features: {
      en: ['Up to 100 users', 'Everything in Business', 'Multiple entities and cost centres', 'ERP integration (Phase 2)', 'Dedicated success manager'],
      ar: ['حتى 100 مستخدم', 'كل مزايا الأعمال', 'كيانات ومراكز تكلفة متعددة', 'ربط مع أنظمة ERP (المرحلة 2)', 'مدير نجاح مخصص']
    }
  },
  {
    id: 'supplier-starter', audience: 'supplier', monthlySar: 300, yearlySar: 3000, maxUsers: 2,
    name: { en: 'Starter', ar: 'المبتدئة' },
    tagline: { en: 'Get found by verified buyers', ar: 'ليجدك المشترون الموثّقون' },
    features: {
      en: ['Up to 2 users', 'Verified supplier profile', 'Matched RFQ feed', 'Up to 10 live offers', 'ZATCA e-invoicing'],
      ar: ['حتى مستخدمين', 'ملف مورد موثّق', 'طلبات عروض مطابقة', 'حتى 10 عروض في السوق', 'فوترة إلكترونية']
    }
  },
  {
    id: 'supplier-business', audience: 'supplier', monthlySar: 900, yearlySar: 9000, maxUsers: 10, highlight: true,
    name: { en: 'Business', ar: 'الأعمال' },
    tagline: { en: 'For active sellers across categories', ar: 'للبائعين النشطين عبر الفئات' },
    features: {
      en: ['Up to 10 users', 'Everything in Starter', 'Unlimited live offers', 'AI quote auto-fill and pricing tips', 'Scorecard analytics'],
      ar: ['حتى 10 مستخدمين', 'كل مزايا المبتدئة', 'عروض غير محدودة', 'تعبئة العروض والتسعير بالذكاء الاصطناعي', 'تحليلات بطاقة الأداء']
    }
  },
  {
    id: 'supplier-enterprise', audience: 'supplier', monthlySar: 2500, yearlySar: 25000, maxUsers: 30,
    name: { en: 'Enterprise', ar: 'المؤسسات' },
    tagline: { en: 'For manufacturers and distributors', ar: 'للمصنعين والموزعين' },
    features: {
      en: ['Up to 30 users', 'Everything in Business', 'Featured placement', 'Multiple warehouses and cities', 'Dedicated success manager'],
      ar: ['حتى 30 مستخدماً', 'كل مزايا الأعمال', 'ظهور مميز', 'مستودعات ومدن متعددة', 'مدير نجاح مخصص']
    }
  }
];

export const VAT_RATE = 0.15;
