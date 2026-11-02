// Per-page help shown by the fixed ℹ️ button (above the WhatsApp button). For the current page
// it answers: what is this page, what appears on it, and how you work with it. Content is matched
// from the pathname (locale stripped; dynamic record pages collapse to a "/[id]" key).

export interface PageHelp { title: { ar: string; en: string }; what: { ar: string; en: string }; how: { ar: string; en: string }; }

const HELP: Record<string, PageHelp> = {
    dashboard: {
        title: { ar: 'لوحة التحكم', en: 'Dashboard' },
        what: { ar: 'نظرة سريعة على مؤشرات شركتك (المشاريع، العملاء، والإيرادات/الأرباح لمن له صلاحية) + اختصارات الوحدات، وزر بصمة الحضور.', en: 'A quick overview of your company KPIs (projects, clients, and revenue/profit for authorized roles) + module shortcuts and the attendance punch.' },
        how: { ar: 'تظهر لك البطاقات والوحدات حسب صلاحيتك فقط. اضغط أي وحدة للدخول إليها، واضغط زر البصمة لتسجيل الحضور/الانصراف.', en: 'Cards and modules appear by your permissions only. Click a module to open it; tap the punch button to check in/out.' },
    },
    'portal/technician': {
        title: { ar: 'بوابتي (الفني/المهندس)', en: 'My portal (technician/engineer)' },
        what: { ar: 'مساحتك الشخصية: مهامك، كالندر مواعيدك (زيارات/صيانات)، مشاريعك، طلباتك، عهدتك، تقييمك وتدريباتك، وحضورك — كلها خاصة بك وحدك.', en: 'Your personal space: your tasks, a calendar of your visits/maintenance, your projects, requests, custody, evaluation & trainings, and attendance — all private to you.' },
        how: { ar: 'نقّل بين الأقسام بالأعلى. غيّر حالة مهمتك من القائمة، سجّل حضورك بزر البصمة، وقدّم طلب إجازة جديد من «طلباتي».', en: 'Switch sections at the top. Change your task status from the dropdown, punch attendance, and submit a new leave from "My requests".' },
    },
    calendar: {
        title: { ar: 'تقويمي', en: 'My calendar' },
        what: { ar: 'تقويمك الشخصي: اجتماعاتك ومهامك وأعمالك ومشاريعك ذات التواريخ في عرض شهري — ما تراه يخصّك وحدك.', en: 'Your personal calendar: your meetings, tasks, work and dated project events in a month view — only yours.' },
        how: { ar: 'تنقّل بين الأشهر، اضغط يوماً لرؤية أحداثه، وأضف حدثاً/اجتماعاً جديداً بزر «حدث جديد».', en: 'Navigate months, click a day to see its events, and add a meeting/event with "New event".' },
    },
    marketing: {
        title: { ar: 'التسويق والدعاية', en: 'Marketing & advertising' },
        what: { ar: 'حملاتك التسويقية عبر القنوات (فيسبوك/إنستجرام/جوجل…)، ميزانياتها وإنفاقها، والعملاء المحتملين والتحويلات.', en: 'Marketing campaigns across channels, budgets & spend, and the leads/conversions they produce.' },
        how: { ar: 'أضف حملة واختر قناتها وميزانيتها، وحدّث المصروف وعدد العملاء المحتملين — ويُحسب لك تكلفة العميل ومعدّل التحويل تلقائياً.', en: 'Add a campaign with its channel & budget, update spend and leads — cost-per-lead and conversion rate are computed for you.' },
    },
    support: {
        title: { ar: 'الدعم الفني وعلاقات العملاء', en: 'Support & CRM' },
        what: { ar: 'تذاكر العملاء وطلباتهم، طلبات تحديث بياناتهم، وقائمة المتابعة.', en: 'Client tickets/requests, client data-update approvals, and the follow-up list.' },
        how: { ar: 'حرّك حالة التذكرة خلال مراحلها، راجع واعتمد تحديث بيانات العميل (يُطبَّق على سجله فقط عند الاعتماد)، وسجّل متابعة العملاء المستحقّين.', en: 'Move a ticket through its stages, review & approve a client data update (applied only on approval), and log follow-ups for due clients.' },
    },
    'portal/client': {
        title: { ar: 'بوابة العميل', en: 'Client portal' },
        what: { ar: 'مساحتك كعميل: فواتيرك والمستحق منها، ضماناتك، مراحل أعمالك الحالية، وطلباتك/تذاكر الدعم — كلها تخصّك وحدك.', en: 'Your client space: your invoices and dues, warranties, current work stages, and your requests/support tickets — all yours only.' },
        how: { ar: 'تابع فواتيرك من «فواتيري»، واطلب خدمة/منتجاً جديداً أو افتح تذكرة دعم من «طلباتي والدعم» (اختر الخدمة/المنتج أولاً ثم اكتب طلبك).', en: 'Track invoices under "Invoices", and request a new service/product or open a support ticket under "Requests & support" (pick the service/product first, then describe it).' },
    },
    projects: {
        title: { ar: 'المشاريع', en: 'Projects' },
        what: { ar: 'قائمة مشاريع الشركة وحالاتها.', en: 'The company projects and their statuses.' },
        how: { ar: 'اضغط مشروعاً لفتح تفاصيله (الميثاق، التخطيط والتكلفة، الجدول، المخاطر، التنفيذ...).', en: 'Click a project to open its details (charter, plan & cost, schedule, risks, execution…).' },
    },
    'projects/[code]': {
        title: { ar: 'تفاصيل المشروع', en: 'Project details' },
        what: { ar: 'كل بيانات المشروع في تبويبات: الميثاق، التخطيط والتكلفة، الجدول الزمني، المخاطر، أصحاب المصلحة، المشتريات، التنفيذ، الإغلاق — مع شريط «رحلة المشروع» الذي يُظهر المرحلة الحالية.', en: 'All project data in tabs: charter, plan & cost, schedule, risks, stakeholders, procurement, execution, closure — with a "journey" strip showing the current stage.' },
        how: { ar: 'اختر نوع المشروع ليقترح لك البنود/المراحل/المخاطر. البنود تُختار من الكتالوج أو تُكتب يدوياً. احفظ، واستخدم «معاينة وطباعة/PDF» لإخراج ملف.', en: 'Pick the project type to auto-suggest items/phases/risks. Items are chosen from the catalog or typed. Save, and use "Preview & print / PDF" to export.' },
    },
    approvals: {
        title: { ar: 'الاعتمادات', en: 'Approvals' },
        what: { ar: 'كل ما ينتظر قرارك (الموكّل إليك) + طلباتك أنت وحالتها خطوة بخطوة.', en: 'Everything waiting for your decision (assigned to you) + your own requests with step-by-step status.' },
        how: { ar: 'اضغط البند لرؤية تفاصيله وفتح العنصر لمراجعته، ثم اعتمد بنقرة أو ارفض مع كتابة السبب (إلزامي).', en: 'Click an item to see its details and open the record to review, then approve in one click or reject with a mandatory reason.' },
    },
    products: {
        title: { ar: 'المنتجات والخدمات', en: 'Products & services' },
        what: { ar: 'كتالوج المنتجات والخدمات وأسعارها، مع «ذكاء السوق» لكل صنف.', en: 'The products/services catalog and pricing, with per-item "market intelligence".' },
        how: { ar: 'أضف/عدّل صنفاً، وافتح «ذكاء السوق» لرؤية السعر الحالي/المتوسط والاتجاه وتسجيل سعر سوق جديد (لا يغيّر سعر البيع المعتمد).', en: 'Add/edit an item, and open "Market intelligence" to see current/avg price and trend, and record a new market price (never changes the approved sell price).' },
    },
    documents: {
        title: { ar: 'المستندات', en: 'Documents' },
        what: { ar: 'عروض الأسعار والفواتير والتقارير.', en: 'Price offers, invoices and reports.' },
        how: { ar: 'أنشئ أو عدّل مستنداً، عايِنه، ثم اطبعه أو حمّله PDF، وابدأ دورة اعتماده عند الحاجة.', en: 'Create or edit a document, preview it, print or download as PDF, and start its approval cycle when needed.' },
    },
    invoices: {
        title: { ar: 'الفواتير', en: 'Invoices' },
        what: { ar: 'فواتير العملاء وحالات السداد.', en: 'Client invoices and payment statuses.' },
        how: { ar: 'تابع المحصّل والمستحق، وافتح أي فاتورة لتفاصيلها.', en: 'Track collected vs outstanding, and open any invoice for details.' },
    },
    clients: {
        title: { ar: 'العملاء', en: 'Clients' },
        what: { ar: 'سجل العملاء (محتملين وفعليين) وبياناتهم.', en: 'The client register (leads and actual) and their data.' },
        how: { ar: 'أضف عميلاً أو افتح ملفه لرؤية مستنداته ومشاريعه.', en: 'Add a client or open their file to see their documents and projects.' },
    },
    accounting: {
        title: { ar: 'الحسابات والمالية', en: 'Accounting' },
        what: { ar: 'القيود، ميزان المراجعة، المصروفات والتقارير المالية.', en: 'Journal entries, trial balance, expenses and financial reports.' },
        how: { ar: 'راجع القيود وصدّرها Excel، وتابع المصروفات المعتمدة.', en: 'Review entries and export to Excel; track approved expenses.' },
    },
    market: {
        title: { ar: 'بيانات السوق', en: 'Market data' },
        what: { ar: 'مؤشرات السوق (الدولار، التضخم، الضرائب...) ومصادرها.', en: 'Market indicators (USD, inflation, taxes…) and their sources.' },
        how: { ar: 'اضغط «تحديث كل بيانات السوق» للتحديث، وافتح سجل أي مؤشر. لا يُغيَّر أي سعر بيع معتمد تلقائياً.', en: 'Click "Update all market data" to refresh, and open any indicator\'s history. No approved sell price is auto-changed.' },
    },
    surveys: {
        title: { ar: 'المسح الفني', en: 'Technical survey' },
        what: { ar: 'استبيانات المعاينة الفنية للمواقع والتشخيص.', en: 'Technical site-survey questionnaires and diagnostics.' },
        how: { ar: 'ابدأ مسحاً جديداً أو افتح مسحاً لمتابعة بنوده وبواباته.', en: 'Start a new survey or open one to follow its items and gates.' },
    },
    knowledge: {
        title: { ar: 'مكتبة المعرفة', en: 'Knowledge library' },
        what: { ar: 'الإجراءات والبرمجيات والمراجع الفنية.', en: 'Procedures, software and technical references.' },
        how: { ar: 'ابحث عن إجراء أو برنامج للرجوع إليه وقت الحاجة.', en: 'Search for a procedure or software to reference when needed.' },
    },
    hr: {
        title: { ar: 'شؤون الموظفين', en: 'Human resources' },
        what: { ar: 'الحضور والانصراف، الإجازات، ومحيط البصمة الجغرافي على الخريطة.', en: 'Attendance, leaves, and the map-based punch geofence.' },
        how: { ar: 'سجّل الحضور، اعتمد الإجازات، وفي تبويب «محيط البصمة» حدّد على الخريطة مكان بصمة كل موظف واربطه به.', en: 'Record attendance, approve leaves, and in the "Punch geofence" tab set each employee\'s punch area on the map and assign them.' },
    },
    employees: {
        title: { ar: 'الموظفون', en: 'Employees' },
        what: { ar: 'ملفات الموظفين وبياناتهم الوظيفية.', en: 'Employee files and job data.' },
        how: { ar: 'أضف أو عدّل بيانات موظف.', en: 'Add or edit an employee.' },
    },
    payroll: {
        title: { ar: 'الرواتب', en: 'Payroll' },
        what: { ar: 'مسيّرات الرواتب والبدلات والخصومات.', en: 'Payroll runs, allowances and deductions.' },
        how: { ar: 'جهّز مسيّر الرواتب وراجع صافي كل موظف.', en: 'Prepare the payroll run and review each employee\'s net.' },
    },
    evaluations: {
        title: { ar: 'التقييمات', en: 'Evaluations' },
        what: { ar: 'تقييمات أداء الموظفين والتوصيات التدريبية.', en: 'Employee performance evaluations and training recommendations.' },
        how: { ar: 'أضف تقييماً ودرجاته وتوصية تدريب تظهر للموظف في بوابته.', en: 'Add an evaluation, its scores and a training recommendation that appears to the employee in their portal.' },
    },
    legal: {
        title: { ar: 'الإدارة القانونية', en: 'Legal' },
        what: { ar: 'العقود والمستندات القانونية وحالات اعتمادها.', en: 'Contracts and legal documents and their approval statuses.' },
        how: { ar: 'أنشئ عقداً واربطه بمشروع، وابدأ اعتماده.', en: 'Create a contract, link it to a project, and start its approval.' },
    },
    maintenance: {
        title: { ar: 'الصيانة', en: 'Maintenance' },
        what: { ar: 'طلبات وأعمال الصيانة ومتابعتها.', en: 'Maintenance requests/work and their tracking.' },
        how: { ar: 'سجّل طلب صيانة وتابع حالته.', en: 'Log a maintenance request and track its status.' },
    },
    partners: {
        title: { ar: 'الشركاء', en: 'Partners' },
        what: { ar: 'الشركاء ونِسبهم وما يخصّهم من المشاريع.', en: 'Partners, their shares and what concerns them in projects.' },
        how: { ar: 'أضف شريكاً واربطه بمشروع بنسبته.', en: 'Add a partner and link them to a project with their share.' },
    },
};

const GENERIC: PageHelp = {
    title: { ar: 'هذه الصفحة', en: 'This page' },
    what: { ar: 'إحدى صفحات نظام Z.Electronic ERP.', en: 'One of the Z.Electronic ERP pages.' },
    how: { ar: 'استخدم الأزرار والقوائم بالصفحة، وما يظهر لك محكوم بصلاحياتك.', en: 'Use the page buttons and menus; what you see is governed by your permissions.' },
};

// Resolve the pathname (e.g. "/ar/projects/PRJ-1") to a help key.
export function pageHelpFor(pathname: string | null): PageHelp {
    const segs = (pathname || '').split('/').filter(Boolean);
    // drop a leading locale segment (ar/en)
    if (segs[0] === 'ar' || segs[0] === 'en') segs.shift();
    if (segs.length === 0) return HELP.dashboard;
    const two = segs.slice(0, 2).join('/');
    if (HELP[two]) return HELP[two];                       // e.g. portal/technician
    const first = segs[0];
    if (segs.length >= 2 && HELP[`${first}/[code]`]) return HELP[`${first}/[code]`];  // projects/[code]
    if (HELP[first]) return HELP[first];
    return GENERIC;
}
