// Project types + per-type SUGGESTION templates (plan items, milestones, risks).
// These are editable starting points the user can accept/change before saving — never
// auto-committed records. Values are the Arabic labels so existing rows (e.g. "تركيب وتوريد")
// keep matching the dropdown. "أخرى" lets the user type a custom type.

export interface TypeDef { key: string; ar: string; en: string; }

export const PROJECT_TYPES: TypeDef[] = [
    { key: 'install_supply', ar: 'تركيب وتوريد', en: 'Install & supply' },
    { key: 'supply_only', ar: 'توريد فقط', en: 'Supply only' },
    { key: 'maintenance', ar: 'صيانة دورية', en: 'Periodic maintenance' },
    { key: 'emergency', ar: 'صيانة طارئة', en: 'Emergency maintenance' },
    { key: 'cctv', ar: 'كاميرات مراقبة', en: 'CCTV surveillance' },
    { key: 'networking', ar: 'شبكات', en: 'Networking' },
    { key: 'fiber', ar: 'فايبر أوبتيك', en: 'Fiber optic' },
    { key: 'access_control', ar: 'تحكم في الدخول', en: 'Access control' },
    { key: 'alarm', ar: 'إنذار وحريق', en: 'Alarm & fire' },
    { key: 'consultation', ar: 'دراسة واستشارة', en: 'Study & consultation' },
    { key: 'other', ar: 'أخرى', en: 'Other' },
];

// A plan-item suggestion: a cost category + a name. Cost is left to the catalog/user (no made-up price).
export interface ItemSuggestion { category: string; ar: string; en: string; }
// A milestone suggestion.
export interface MilestoneSuggestion { ar: string; en: string; }
// A risk suggestion with a sensible default probability/impact the user can adjust.
export interface RiskSuggestion { ar: string; en: string; probability: 'low' | 'medium' | 'high'; impact: 'low' | 'medium' | 'high'; }

// Risks every field project shares, then type-specific additions.
const COMMON_RISKS: RiskSuggestion[] = [
    { ar: 'تأخر توريد الأجهزة أو الخامات', en: 'Delay in equipment/material supply', probability: 'medium', impact: 'high' },
    { ar: 'عدم جاهزية الموقع عند بدء العمل', en: 'Site not ready at start', probability: 'medium', impact: 'medium' },
    { ar: 'تغيّر الأسعار أو سعر الصرف قبل التنفيذ', en: 'Price/FX change before execution', probability: 'medium', impact: 'high' },
    { ar: 'نقص العمالة الفنية المدرّبة', en: 'Shortage of skilled technicians', probability: 'low', impact: 'medium' },
    { ar: 'عدم وضوح أو تغيّر متطلبات العميل', en: 'Unclear/changing client requirements', probability: 'medium', impact: 'medium' },
];

const COMMON_MILESTONES: MilestoneSuggestion[] = [
    { ar: 'معاينة الموقع والرفع المساحي', en: 'Site survey' },
    { ar: 'اعتماد العرض والتعاقد', en: 'Quote approval & contract' },
    { ar: 'توريد الأجهزة والخامات', en: 'Equipment & material supply' },
    { ar: 'التركيب والتمديدات', en: 'Installation & cabling' },
    { ar: 'التشغيل والاختبار', en: 'Commissioning & testing' },
    { ar: 'التسليم النهائي', en: 'Final handover' },
];

type Pack = { items: ItemSuggestion[]; milestones: MilestoneSuggestion[]; risks: RiskSuggestion[] };

// Keyed by the Arabic label (what's stored in projects.ProjectType).
const BY_TYPE: Record<string, Pack> = {
    'تركيب وتوريد': {
        items: [
            { category: 'material_essential', ar: 'الأجهزة الرئيسية (كاميرات/أجهزة)', en: 'Main devices' },
            { category: 'material_essential', ar: 'كابلات وتوصيلات', en: 'Cables & connectors' },
            { category: 'material_complementary', ar: 'إكسسوارات ومثبتات', en: 'Accessories & mounts' },
            { category: 'labor', ar: 'عمالة تركيب وتمديد', en: 'Installation labor' },
            { category: 'engineer', ar: 'مهندس إشراف وتهيئة', en: 'Supervision & configuration engineer' },
            { category: 'equipment', ar: 'معدات تركيب (سقالات/عدة)', en: 'Installation equipment' },
        ],
        milestones: COMMON_MILESTONES,
        risks: [...COMMON_RISKS, { ar: 'صعوبات تركيب في المواقع المرتفعة/الخارجية', en: 'Difficult high/outdoor installation', probability: 'medium', impact: 'medium' }],
    },
    'صيانة دورية': {
        items: [
            { category: 'engineer', ar: 'زيارة فحص دورية', en: 'Periodic inspection visit' },
            { category: 'labor', ar: 'أعمال صيانة وتنظيف', en: 'Maintenance & cleaning' },
            { category: 'material_complementary', ar: 'قطع غيار ومستهلكات', en: 'Spare parts & consumables' },
        ],
        milestones: [
            { ar: 'جدولة الزيارات', en: 'Schedule visits' },
            { ar: 'الفحص والصيانة الوقائية', en: 'Inspection & preventive maintenance' },
            { ar: 'تقرير الحالة والتسليم', en: 'Status report & handover' },
        ],
        risks: [...COMMON_RISKS, { ar: 'توقف النظام أثناء الصيانة', en: 'System downtime during maintenance', probability: 'low', impact: 'high' }, { ar: 'عدم توفر قطع الغيار', en: 'Spare parts unavailable', probability: 'medium', impact: 'medium' }],
    },
    'فايبر أوبتيك': {
        items: [
            { category: 'material_essential', ar: 'كابل فايبر ووصلات', en: 'Fiber cable & splices' },
            { category: 'equipment', ar: 'أجهزة لحام/قياس (OTDR)', en: 'Fusion/OTDR equipment' },
            { category: 'labor', ar: 'عمالة سحب ولحام', en: 'Pulling & splicing labor' },
            { category: 'engineer', ar: 'مهندس اختبار وتوثيق', en: 'Testing & documentation engineer' },
        ],
        milestones: COMMON_MILESTONES,
        risks: [...COMMON_RISKS, { ar: 'تلف الكابل أثناء السحب', en: 'Cable damage during pulling', probability: 'medium', impact: 'high' }, { ar: 'فقد إشارة زائد في اللحام', en: 'Excess splice loss', probability: 'low', impact: 'medium' }],
    },
};

const GENERIC: Pack = {
    items: [
        { category: 'material_essential', ar: 'خامات/أجهزة أساسية', en: 'Essential materials/devices' },
        { category: 'labor', ar: 'عمالة تنفيذ', en: 'Execution labor' },
        { category: 'engineer', ar: 'إشراف هندسي', en: 'Engineering supervision' },
    ],
    milestones: COMMON_MILESTONES,
    risks: COMMON_RISKS,
};

export function suggestionsFor(projectType: string | null | undefined): Pack {
    if (!projectType) return GENERIC;
    return BY_TYPE[projectType] || GENERIC;
}

// A sensible default quality criterion per cost-category, so each plan line gets a quality
// standard automatically (editable). Mirrors the "risks auto-populate" behaviour the owner asked for.
const QUALITY_BY_CATEGORY: Record<string, { ar: string; en: string }> = {
    labor: { ar: 'تنفيذ وفق الأصول الفنية ونظافة الموقع بعد العمل', en: 'Workmanship to standard; site cleaned after work' },
    engineer: { ar: 'مطابقة للمواصفات واعتماد هندسي موثّق', en: 'Spec-compliant with documented engineering sign-off' },
    material_essential: { ar: 'أصلي/مطابق للمواصفات مع ضمان المورّد', en: 'Genuine/spec-compliant with supplier warranty' },
    material_complementary: { ar: 'جودة مقبولة ومطابقة للغرض', en: 'Acceptable quality, fit for purpose' },
    equipment: { ar: 'معايَر وصالح للاستخدام وآمن', en: 'Calibrated, serviceable and safe' },
    subcontract: { ar: 'وفق نطاق العمل المتفق عليه ومراجعة الاستلام', en: 'Per agreed scope with acceptance review' },
    time: { ar: 'الالتزام بالمدة المخطّطة', en: 'Meets the planned duration' },
    other: { ar: 'مطابق للمتطلبات المتفق عليها', en: 'Meets agreed requirements' },
};
export function qualityFor(category: string, ar: boolean): string {
    const q = QUALITY_BY_CATEGORY[category] || QUALITY_BY_CATEGORY.other;
    return ar ? q.ar : q.en;
}

// ── Project management methodologies & their phase templates ──
export const METHODOLOGIES: TypeDef[] = [
    { key: 'agile', ar: 'أجايل (Agile)', en: 'Agile' },
    { key: 'scrum', ar: 'سكرَم (Scrum)', en: 'Scrum' },
    { key: 'kanban', ar: 'كانبان (Kanban)', en: 'Kanban' },
    { key: 'xp', ar: 'البرمجة القصوى (XP)', en: 'Extreme Programming (XP)' },
    { key: 'safe', ar: 'أجايل الموسّع (SAFe)', en: 'Scaled Agile (SAFe)' },
    { key: 'waterfall', ar: 'ووترفول (Waterfall)', en: 'Waterfall' },
    { key: 'pmbok', ar: 'التقليدية PMI/PMBOK', en: 'Traditional (PMI/PMBOK)' },
    { key: 'prince2', ar: 'برينس2 (PRINCE2)', en: 'PRINCE2' },
    { key: 'cpm', ar: 'المسار الحرج (CPM)', en: 'Critical Path (CPM)' },
    { key: 'ccpm', ar: 'السلسلة الحرجة (CCPM)', en: 'Critical Chain (CCPM)' },
    { key: 'lean', ar: 'لين (Lean)', en: 'Lean' },
    { key: 'six_sigma', ar: 'سيكس سيجما (Six Sigma)', en: 'Six Sigma' },
    { key: 'lean_six_sigma', ar: 'لين + سيكس سيجما', en: 'Lean Six Sigma' },
    { key: 'rad', ar: 'التطوير السريع (RAD)', en: 'Rapid App Dev (RAD)' },
    { key: 'apf', ar: 'الإطار التكيّفي (APF)', en: 'Adaptive (APF)' },
    { key: 'hybrid', ar: 'هايبرد (مزيج)', en: 'Hybrid' },
];

const METHODOLOGY_PHASES: Record<string, MilestoneSuggestion[]> = {
    waterfall: [
        { ar: 'تحليل المتطلبات', en: 'Requirements analysis' }, { ar: 'التصميم', en: 'Design' },
        { ar: 'التنفيذ', en: 'Implementation' }, { ar: 'الاختبار', en: 'Testing' }, { ar: 'التسليم', en: 'Delivery' },
    ],
    agile: [
        { ar: 'تخطيط المنتج (Backlog)', en: 'Product backlog planning' }, { ar: 'سبرنت 1', en: 'Sprint 1' },
        { ar: 'سبرنت 2', en: 'Sprint 2' }, { ar: 'مراجعة وتسليم تدريجي', en: 'Review & incremental delivery' }, { ar: 'استعراض نهائي', en: 'Retrospective & close' },
    ],
    lean: [
        { ar: 'تحديد القيمة', en: 'Define value' }, { ar: 'رسم تدفّق القيمة', en: 'Value-stream map' },
        { ar: 'إزالة الهدر', en: 'Eliminate waste' }, { ar: 'إنشاء التدفّق والسحب', en: 'Flow & pull' }, { ar: 'التحسين المستمر (Kaizen)', en: 'Continuous improvement' },
    ],
    six_sigma: [
        { ar: 'تعريف (Define)', en: 'Define' }, { ar: 'قياس (Measure)', en: 'Measure' },
        { ar: 'تحليل (Analyze)', en: 'Analyze' }, { ar: 'تحسين (Improve)', en: 'Improve' }, { ar: 'ضبط (Control)', en: 'Control' },
    ],
    lean_six_sigma: [
        { ar: 'تعريف (Define)', en: 'Define' }, { ar: 'قياس (Measure)', en: 'Measure' }, { ar: 'تحليل (Analyze)', en: 'Analyze' },
        { ar: 'تحسين وإزالة الهدر (Improve)', en: 'Improve & eliminate waste' }, { ar: 'ضبط (Control)', en: 'Control' },
    ],
    hybrid: [
        { ar: 'تخطيط', en: 'Plan' }, { ar: 'تنفيذ تكراري', en: 'Iterative execution' },
        { ar: 'ضبط الجودة', en: 'Quality control' }, { ar: 'التسليم', en: 'Delivery' },
    ],
    scrum: [
        { ar: 'تجهيز الـBacklog', en: 'Product backlog' }, { ar: 'تخطيط السبرنت', en: 'Sprint planning' },
        { ar: 'تنفيذ السبرنت', en: 'Sprint execution' }, { ar: 'مراجعة السبرنت', en: 'Sprint review' }, { ar: 'الريتروسبكتيف', en: 'Retrospective' },
    ],
    kanban: [
        { ar: 'قائمة الانتظار (To Do)', en: 'To Do' }, { ar: 'قيد التنفيذ (WIP)', en: 'In progress' },
        { ar: 'مراجعة', en: 'Review' }, { ar: 'تم (Done)', en: 'Done' },
    ],
    xp: [
        { ar: 'التخطيط', en: 'Planning' }, { ar: 'تصميم بسيط', en: 'Simple design' },
        { ar: 'برمجة واختبارات', en: 'Pair programming & tests' }, { ar: 'تكامل مستمر', en: 'Continuous integration' }, { ar: 'إصدار', en: 'Release' },
    ],
    safe: [
        { ar: 'تخطيط PI', en: 'PI planning' }, { ar: 'تنفيذ التكرارات', en: 'Iteration execution' },
        { ar: 'عرض النظام', en: 'System demo' }, { ar: 'الفحص والتكيّف', en: 'Inspect & Adapt' },
    ],
    pmbok: [
        { ar: 'البدء (Initiating)', en: 'Initiating' }, { ar: 'التخطيط (Planning)', en: 'Planning' },
        { ar: 'التنفيذ (Executing)', en: 'Executing' }, { ar: 'المراقبة والتحكم', en: 'Monitoring & controlling' }, { ar: 'الإغلاق (Closing)', en: 'Closing' },
    ],
    prince2: [
        { ar: 'بدء المشروع', en: 'Starting up' }, { ar: 'التوجيه', en: 'Directing' }, { ar: 'التهيئة', en: 'Initiating' },
        { ar: 'التحكم بالمراحل', en: 'Controlling stages' }, { ar: 'إدارة تسليم المنتج', en: 'Managing delivery' }, { ar: 'إغلاق المشروع', en: 'Closing' },
    ],
    cpm: [
        { ar: 'تحديد الأنشطة', en: 'Define activities' }, { ar: 'تسلسل الأنشطة', en: 'Sequence activities' },
        { ar: 'تقدير المدد', en: 'Estimate durations' }, { ar: 'تحديد المسار الحرج', en: 'Identify critical path' }, { ar: 'التنفيذ والمتابعة', en: 'Execute & monitor' },
    ],
    ccpm: [
        { ar: 'تخطيط السلسلة الحرجة', en: 'Plan critical chain' }, { ar: 'إضافة الحواجز الزمنية', en: 'Add buffers' },
        { ar: 'التنفيذ', en: 'Execution' }, { ar: 'إدارة الحواجز', en: 'Buffer management' },
    ],
    rad: [
        { ar: 'متطلبات سريعة', en: 'Requirements' }, { ar: 'نماذج أولية', en: 'Prototyping' },
        { ar: 'بناء تكراري', en: 'Iterative build' }, { ar: 'الانتقال والتسليم', en: 'Cutover' },
    ],
    apf: [
        { ar: 'نطاق مبدئي', en: 'Version scope' }, { ar: 'دورات تكرارية', en: 'Iterative cycles' },
        { ar: 'مراجعة العميل', en: 'Client checkpoint' }, { ar: 'التسليم النهائي', en: 'Final review' },
    ],
};

// Methodology phases when a methodology is set; otherwise the project-type milestones.
export function methodologyPhases(methodology: string | null | undefined): MilestoneSuggestion[] | null {
    if (!methodology) return null;
    return METHODOLOGY_PHASES[methodology] || null;
}
