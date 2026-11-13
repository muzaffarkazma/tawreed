import 'server-only';
import { cookies } from 'next/headers';

export type Lang = 'en' | 'ar';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get('lang')?.value;
  return v === 'ar' ? 'ar' : 'en';
}

const en = {
  brand: 'Tawreed', brandSub: 'AI procurement network',
  nav: { product: 'Product', how: 'How it works', roles: 'Who it’s for', pricing: 'Pricing', login: 'Log in', start: 'Get started', app: 'Open app' },
  hero: {
    eyebrow: 'Built for Saudi B2B procurement',
    title: 'Source, buy, receive and pay — on one AI-run network',
    sub: 'Tawreed connects buyers and suppliers on one platform: tenders and a live supplier market, approvals, delivery, quality, ZATCA e-invoicing and payment, with AI doing the clerical work at every step.',
    cta: 'See plans', cta2: 'Log in'
  },
  stats: [['7', 'roles on one record'], ['2', 'ways to buy: RFQ and live market'], ['9', 'AI agents, people approve'], ['15%', 'VAT and ZATCA built in']] as [string, string][],
  problem: {
    title: 'B2B buying still runs on WhatsApp, email and Excel',
    items: [
      ['Buyers', 'Needs sent as free text and photos; no visibility after submitting.'],
      ['Procurement', 'Personal supplier lists, quotes compared by hand, no benchmark price.'],
      ['Suppliers', 'Hard to reach new buyers; stock sits unsold; slow payment.'],
      ['Finance', 'Email approvals, manual invoice matching, budgets found late.']
    ] as [string, string][]
  },
  how: {
    title: 'How it works',
    steps: [
      ['Describe the need', 'Type it, upload photos or a BOQ. AI turns it into a structured request with specs, budget and SASO flags.'],
      ['Buy now or tender', 'AI checks the live market first. In-stock items are bought in minutes; the rest go to a sealed RFQ.'],
      ['Compare and approve', 'Quotes are scored cheapest vs best overall, with a written reason. Finance approves above your threshold.'],
      ['Deliver and inspect', 'Live tracking, proof of delivery, goods receipt and an AI-assisted quality checklist.'],
      ['Invoice and pay', 'ZATCA e-invoice from the PO and receipt, automatic 3-way match, payment, supplier rating.']
    ] as [string, string][]
  },
  roles: { title: 'One platform, every stakeholder' },
  features: {
    title: 'Everything procurement needs',
    items: [
      ['AI request structuring', 'Free text, photos and BOQs become clean line items.'],
      ['Supplier matching', 'Ranked by category, city, rating and local content.'],
      ['Live market', 'Supplier stock with advance, next-day and 30-day prices.'],
      ['Quote comparison', 'Weighted scoring and AI counter-offers.'],
      ['Approvals and limits', 'Thresholds, budgets and purchase limits per team.'],
      ['ZATCA e-invoicing', 'Compliant invoices and automatic 3-way match.'],
      ['Price index', 'Fair-price benchmarks by product and city.'],
      ['Audit trail', 'Every action logged with who, what and when.']
    ] as [string, string][]
  },
  trust: { title: 'Saudi-first by design', items: ['Arabic and English, full right-to-left', 'Data hosted in KSA (PDPL)', 'ZATCA, Wathq and Nafath integrations', 'Each company’s data isolated in the database'] },
  pricing: {
    title: 'Plans for buyers and suppliers', sub: 'Prices in SAR, excluding 15% VAT. Cancel anytime.',
    buyers: 'Buyers', suppliers: 'Suppliers', monthly: 'Monthly', yearly: 'Yearly', save: '2 months free',
    perMonth: '/ month', perYear: '/ year', choose: 'Choose plan', popular: 'Most popular', users: 'users'
  },
  cta: { title: 'Ready to run procurement on one network?', button: 'Choose a plan' },
  footer: 'Tawreed is a working product name. © 2026 Data Automation.',
  auth: {
    loginTitle: 'Log in to Tawreed', email: 'Work email', password: 'Password', login: 'Log in', noAccount: 'New company?', seePlans: 'See plans',
    invalid: 'Email or password is incorrect.', throttled: 'Too many attempts. Try again in 15 minutes.', inactive: 'This account is deactivated. Ask your company admin.',
    changeTitle: 'Set a new password', changeSub: 'Your admin gave you a temporary password. Choose your own to continue.',
    current: 'Current password', newPw: 'New password', confirm: 'Confirm new password', save: 'Save password',
    rule: 'At least 8 characters, with letters and numbers.', mismatch: 'The new passwords don’t match.', wrongCurrent: 'Current password is incorrect.'
  },
  signup: {
    title: 'Create your company account', plan: 'Selected plan', change: 'Change',
    companySection: 'Company', adminSection: 'Your admin login',
    type: 'Company type', buyer: 'Buyer (we purchase)', supplier: 'Supplier (we sell)',
    name: 'Company legal name', cr: 'Commercial registration (CR) number', vat: 'VAT number', city: 'City', phone: 'Phone (optional)',
    adminName: 'Full name', submit: 'Continue to payment', terms: 'By continuing you agree to the terms of service.',
    errEmail: 'An account with this email already exists. Log in instead.', errCr: 'A company with this CR number is already registered.', errPlan: 'This plan is not available for the selected company type.',
    errCrFormat: 'CR number must be 10 digits.', errVatFormat: 'VAT number must be 15 digits starting and ending with 3.'
  },
  checkout: {
    title: 'Complete your subscription', invoice: 'Invoice', subtotal: 'Subtotal', vat: 'VAT 15%', total: 'Total due',
    bypassTitle: 'Test mode — no card needed', bypassBody: 'Payments are switched to bypass mode for this environment. Activating creates a paid test invoice.', activate: 'Activate subscription',
    sandboxTitle: 'Moyasar sandbox — use a test card', cards: 'Test cards', success: 'Success', fail: 'Declined',
    cardNote: 'Any future expiry date, any 3-digit CVC, cardholder name with two words.',
    noKeys: 'Moyasar keys are not set. Add MOYASAR_PUBLISHABLE_KEY and MOYASAR_SECRET_KEY to .env, or set PAYMENT_MODE=bypass.',
    failed: 'Payment was not completed', paid: 'This invoice is already paid.'
  },
  app: {
    dashboard: 'Dashboard', users: 'Users', company: 'Company', billing: 'Billing', ai: 'AI settings', profile: 'My password', logout: 'Log out',
    welcome: 'Welcome', yourRole: 'Your role', plan: 'Plan', seats: 'Users', renews: 'Renews', status: 'Status',
    gettingStarted: 'Get your company started', gs: ['Add your team and give each person a role', 'Check your company details', 'Set purchase limits and approval rules', 'Raise your first request or post a market offer'],
    modules: 'Your workspace', soon: 'Release 2', soon3: 'Release 3', ready: 'Ready', denied: 'You don’t have access to that page.',
    activated: 'Subscription active. Your company is ready.'
  },
  users: {
    title: 'Users', sub: 'Create accounts for your team. No emails are sent: share the temporary password yourself.', add: 'Add user', name: 'Full name', email: 'Email', role: 'Role',
    create: 'Create user', tempPw: 'Temporary password', tempNote: 'Copy it now — it is shown only once. The user must change it at first login.',
    active: 'Active', inactive: 'Deactivated', deactivate: 'Deactivate', activate: 'Activate', reset: 'Reset password', lastLogin: 'Last login', never: 'Never',
    seatLimit: 'Your plan allows {max} active users. Deactivate a user or upgrade the plan.', you: 'You', changeRole: 'Change role',
    errEmail: 'That email is already used.', errSelf: 'You can’t deactivate or demote your own account.', errLastAdmin: 'The company needs at least one active admin.'
  },
  companyPage: { title: 'Company profile', save: 'Save changes', saved: 'Saved', locked: 'CR and VAT numbers can only be changed by Tawreed support.' },
  billingPage: { title: 'Billing', current: 'Current plan', invoices: 'Invoices', number: 'Number', date: 'Date', amount: 'Amount', paid: 'Paid', due: 'Due', pay: 'Pay now', change: 'Change plan', switchTo: 'Switch to this plan', currentTag: 'Current', tooManyUsers: 'This plan allows fewer users than you have active.' },
  aiPage: { title: 'AI settings', sub: 'Which AI model answers is set in config/ai.config.ts and .env. Set an OpenAI key, a Claude key, or both.', order: 'Order used', none: 'No provider configured', keySet: 'Key set', keyMissing: 'Key not set', model: 'Model', fallback: 'Fallback to the other provider', test: 'Test the AI', prompt: 'Prompt', run: 'Run test', answeredBy: 'Answered by', recent: 'Recent AI calls', on: 'On', off: 'Off', mode: 'Mode' },
  platform: { title: 'Platform admin', tenants: 'Companies', mrr: 'Monthly recurring revenue', activeCos: 'Active companies', users: 'Users', suspend: 'Suspend', reactivate: 'Reactivate', recent: 'Recent activity', plans: 'Plans', type: 'Type' },
  suspended: { title: 'Account suspended', body: 'This company account is suspended. Contact Tawreed support to reactivate it.' }
};

type Dict = typeof en;

const ar: Dict = {
  brand: 'توريد', brandSub: 'شبكة المشتريات الذكية',
  nav: { product: 'المنتج', how: 'كيف يعمل', roles: 'لمن', pricing: 'الأسعار', login: 'تسجيل الدخول', start: 'ابدأ الآن', app: 'افتح التطبيق' },
  hero: {
    eyebrow: 'مصمم للمشتريات بين الشركات في السعودية',
    title: 'اطلب واشترِ واستلم وادفع — على شبكة واحدة يديرها الذكاء الاصطناعي',
    sub: 'توريد يربط المشترين والموردين على منصة واحدة: طلبات العروض والسوق المباشر للموردين، والاعتمادات، والتسليم، والجودة، والفوترة الإلكترونية من هيئة الزكاة، والدفع، مع ذكاء اصطناعي يتولى الأعمال الروتينية في كل خطوة.',
    cta: 'اطّلع على الباقات', cta2: 'تسجيل الدخول'
  },
  stats: [['7', 'أدوار على سجل واحد'], ['2', 'طريقتان للشراء: طلب عروض وسوق مباشر'], ['9', 'وكلاء ذكاء اصطناعي ويعتمد البشر'], ['15%', 'ضريبة القيمة المضافة والفوترة مدمجة']],
  problem: {
    title: 'ما زالت المشتريات بين الشركات تُدار عبر واتساب والبريد وإكسل',
    items: [
      ['المشترون', 'الاحتياجات تُرسل كنص وصور، ولا متابعة بعد الإرسال.'],
      ['المشتريات', 'قوائم موردين شخصية، ومقارنة يدوية للعروض، ولا سعر مرجعي.'],
      ['الموردون', 'صعوبة الوصول لمشترين جدد، ومخزون راكد، وتأخر في الدفع.'],
      ['المالية', 'اعتمادات بالبريد، ومطابقة يدوية للفواتير، وتجاوز الميزانيات يُكتشف متأخراً.']
    ]
  },
  how: {
    title: 'كيف يعمل',
    steps: [
      ['صف احتياجك', 'اكتبه أو ارفع صوراً أو جدول كميات، ويحوّله الذكاء الاصطناعي إلى طلب منظم بالمواصفات والميزانية ومتطلبات ساسو.'],
      ['اشترِ الآن أو اطرح مناقصة', 'يتحقق الذكاء الاصطناعي من السوق المباشر أولاً، فتُشترى البنود المتوفرة خلال دقائق ويُطرح الباقي كطلب عروض مختوم.'],
      ['قارن واعتمد', 'تُقيّم العروض بين الأرخص والأفضل إجمالاً مع تبرير مكتوب، وتعتمد المالية ما يتجاوز الحد.'],
      ['سلّم وافحص', 'تتبع مباشر، وإثبات تسليم، وسند استلام، وقائمة فحص جودة بمساعدة الذكاء الاصطناعي.'],
      ['فوتر وادفع', 'فاتورة إلكترونية من أمر الشراء والاستلام، ومطابقة ثلاثية تلقائية، ودفع، وتقييم للمورد.']
    ]
  },
  roles: { title: 'منصة واحدة لكل الأطراف' },
  features: {
    title: 'كل ما تحتاجه المشتريات',
    items: [
      ['تنظيم الطلبات بالذكاء الاصطناعي', 'النصوص والصور وجداول الكميات تتحول إلى بنود واضحة.'],
      ['مطابقة الموردين', 'ترتيب حسب الفئة والمدينة والتقييم والمحتوى المحلي.'],
      ['السوق المباشر', 'مخزون الموردين بأسعار مقدماً واليوم التالي و30 يوماً.'],
      ['مقارنة العروض', 'تقييم مرجّح وعروض مقابلة بالذكاء الاصطناعي.'],
      ['الاعتمادات والحدود', 'حدود اعتماد وميزانيات وحدود شراء لكل فريق.'],
      ['الفوترة الإلكترونية', 'فواتير متوافقة ومطابقة ثلاثية تلقائية.'],
      ['مؤشر الأسعار', 'أسعار مرجعية عادلة حسب المنتج والمدينة.'],
      ['سجل التدقيق', 'كل إجراء مسجل بمن وماذا ومتى.']
    ]
  },
  trust: { title: 'سعودي أولاً في التصميم', items: ['العربية والإنجليزية مع اتجاه من اليمين لليسار', 'البيانات مستضافة في المملكة (نظام حماية البيانات)', 'تكامل مع هيئة الزكاة وواثق ونفاذ', 'بيانات كل شركة معزولة في قاعدة البيانات'] },
  pricing: {
    title: 'باقات للمشترين والموردين', sub: 'الأسعار بالريال وغير شاملة ضريبة 15%. يمكنك الإلغاء في أي وقت.',
    buyers: 'المشترون', suppliers: 'الموردون', monthly: 'شهري', yearly: 'سنوي', save: 'شهران مجاناً',
    perMonth: '/ شهرياً', perYear: '/ سنوياً', choose: 'اختر الباقة', popular: 'الأكثر طلباً', users: 'مستخدمين'
  },
  cta: { title: 'جاهز لإدارة مشترياتك على شبكة واحدة؟', button: 'اختر باقة' },
  footer: 'توريد اسم عمل مبدئي للمنتج. © 2026 داتا أوتوميشن.',
  auth: {
    loginTitle: 'تسجيل الدخول إلى توريد', email: 'البريد الإلكتروني للعمل', password: 'كلمة المرور', login: 'دخول', noAccount: 'شركة جديدة؟', seePlans: 'اطّلع على الباقات',
    invalid: 'البريد أو كلمة المرور غير صحيحة.', throttled: 'محاولات كثيرة. حاول بعد 15 دقيقة.', inactive: 'هذا الحساب معطّل. تواصل مع مدير حساب شركتك.',
    changeTitle: 'عيّن كلمة مرور جديدة', changeSub: 'أعطاك المدير كلمة مرور مؤقتة. اختر كلمة مرورك للمتابعة.',
    current: 'كلمة المرور الحالية', newPw: 'كلمة المرور الجديدة', confirm: 'تأكيد كلمة المرور', save: 'حفظ',
    rule: '8 أحرف على الأقل وتشمل حروفاً وأرقاماً.', mismatch: 'كلمتا المرور غير متطابقتين.', wrongCurrent: 'كلمة المرور الحالية غير صحيحة.'
  },
  signup: {
    title: 'أنشئ حساب شركتك', plan: 'الباقة المختارة', change: 'تغيير',
    companySection: 'الشركة', adminSection: 'بيانات دخول المدير',
    type: 'نوع الشركة', buyer: 'مشترٍ (نشتري)', supplier: 'مورد (نبيع)',
    name: 'الاسم القانوني للشركة', cr: 'رقم السجل التجاري', vat: 'الرقم الضريبي', city: 'المدينة', phone: 'الجوال (اختياري)',
    adminName: 'الاسم الكامل', submit: 'المتابعة إلى الدفع', terms: 'بالمتابعة فإنك توافق على شروط الخدمة.',
    errEmail: 'يوجد حساب بهذا البريد. سجّل الدخول.', errCr: 'توجد شركة مسجلة بهذا السجل التجاري.', errPlan: 'هذه الباقة غير متاحة لنوع الشركة المختار.',
    errCrFormat: 'السجل التجاري يجب أن يكون 10 أرقام.', errVatFormat: 'الرقم الضريبي 15 رقماً يبدأ وينتهي بالرقم 3.'
  },
  checkout: {
    title: 'أكمل اشتراكك', invoice: 'الفاتورة', subtotal: 'المجموع', vat: 'ضريبة القيمة المضافة 15%', total: 'الإجمالي المستحق',
    bypassTitle: 'وضع الاختبار — لا حاجة لبطاقة', bypassBody: 'الدفع في هذه البيئة بوضع التجاوز. التفعيل ينشئ فاتورة اختبار مدفوعة.', activate: 'تفعيل الاشتراك',
    sandboxTitle: 'بيئة اختبار ميسّر — استخدم بطاقة اختبار', cards: 'بطاقات الاختبار', success: 'ناجحة', fail: 'مرفوضة',
    cardNote: 'أي تاريخ انتهاء مستقبلي، وأي رمز من 3 أرقام، واسم حامل البطاقة من كلمتين.',
    noKeys: 'مفاتيح ميسّر غير مضبوطة. أضف المفاتيح في ملف .env أو اضبط PAYMENT_MODE=bypass.',
    failed: 'لم تكتمل عملية الدفع', paid: 'هذه الفاتورة مدفوعة.'
  },
  app: {
    dashboard: 'الرئيسية', users: 'المستخدمون', company: 'الشركة', billing: 'الفوترة', ai: 'إعدادات الذكاء الاصطناعي', profile: 'كلمة المرور', logout: 'تسجيل الخروج',
    welcome: 'مرحباً', yourRole: 'دورك', plan: 'الباقة', seats: 'المستخدمون', renews: 'التجديد', status: 'الحالة',
    gettingStarted: 'ابدأ تجهيز شركتك', gs: ['أضف فريقك وحدد دور كل شخص', 'راجع بيانات شركتك', 'اضبط حدود الشراء وقواعد الاعتماد', 'ارفع أول طلب أو انشر عرضاً في السوق'],
    modules: 'مساحة عملك', soon: 'الإصدار 2', soon3: 'الإصدار 3', ready: 'جاهز', denied: 'لا تملك صلاحية الوصول لتلك الصفحة.',
    activated: 'الاشتراك مفعّل. شركتك جاهزة.'
  },
  users: {
    title: 'المستخدمون', sub: 'أنشئ حسابات لفريقك. لا تُرسل رسائل بريد: شارك كلمة المرور المؤقتة بنفسك.', add: 'إضافة مستخدم', name: 'الاسم الكامل', email: 'البريد الإلكتروني', role: 'الدور',
    create: 'إنشاء المستخدم', tempPw: 'كلمة المرور المؤقتة', tempNote: 'انسخها الآن — تظهر مرة واحدة فقط. يجب على المستخدم تغييرها عند أول دخول.',
    active: 'نشط', inactive: 'معطّل', deactivate: 'تعطيل', activate: 'تفعيل', reset: 'إعادة تعيين كلمة المرور', lastLogin: 'آخر دخول', never: 'لم يدخل',
    seatLimit: 'باقتك تسمح بـ {max} مستخدمين نشطين. عطّل مستخدماً أو قم بترقية الباقة.', you: 'أنت', changeRole: 'تغيير الدور',
    errEmail: 'هذا البريد مستخدم.', errSelf: 'لا يمكنك تعطيل حسابك أو تغيير دورك.', errLastAdmin: 'يجب وجود مدير نشط واحد على الأقل.'
  },
  companyPage: { title: 'ملف الشركة', save: 'حفظ التغييرات', saved: 'تم الحفظ', locked: 'لا يمكن تغيير السجل التجاري والرقم الضريبي إلا عبر دعم توريد.' },
  billingPage: { title: 'الفوترة', current: 'الباقة الحالية', invoices: 'الفواتير', number: 'الرقم', date: 'التاريخ', amount: 'المبلغ', paid: 'مدفوعة', due: 'مستحقة', pay: 'ادفع الآن', change: 'تغيير الباقة', switchTo: 'التحويل لهذه الباقة', currentTag: 'الحالية', tooManyUsers: 'هذه الباقة تسمح بعدد أقل من مستخدميك النشطين.' },
  aiPage: { title: 'إعدادات الذكاء الاصطناعي', sub: 'يتم تحديد النموذج المستخدم في ملف config/ai.config.ts وملف .env. اضبط مفتاح OpenAI أو Claude أو كليهما.', order: 'ترتيب الاستخدام', none: 'لا يوجد مزود مضبوط', keySet: 'المفتاح مضبوط', keyMissing: 'المفتاح غير مضبوط', model: 'النموذج', fallback: 'التحويل للمزود الآخر عند الفشل', test: 'اختبر الذكاء الاصطناعي', prompt: 'النص', run: 'تشغيل', answeredBy: 'أجاب', recent: 'آخر الاستدعاءات', on: 'مفعّل', off: 'معطّل', mode: 'الوضع' },
  platform: { title: 'إدارة المنصة', tenants: 'الشركات', mrr: 'الإيراد الشهري المتكرر', activeCos: 'شركات نشطة', users: 'المستخدمون', suspend: 'إيقاف', reactivate: 'إعادة تفعيل', recent: 'آخر النشاطات', plans: 'الباقات', type: 'النوع' },
  suspended: { title: 'الحساب موقوف', body: 'حساب هذه الشركة موقوف. تواصل مع دعم توريد لإعادة التفعيل.' }
};

export const DICT: Record<Lang, Dict> = { en, ar };
export async function getT() {
  const lang = await getLang();
  return { lang, t: DICT[lang], dir: lang === 'ar' ? 'rtl' : 'ltr' as 'rtl' | 'ltr' };
}
export type { Dict };
