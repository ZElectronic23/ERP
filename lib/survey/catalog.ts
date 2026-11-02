// Universal Technical Survey — Phase 1 catalog.
// Defines WORK TYPES and the dynamic SECTIONS/FIELDS each type reveals.
// This is organizational form structure only (not fabricated diagnostic thresholds or
// OS-specific commands — those belong to the Phase 2 diagnostic engine + knowledge base).

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'bool' | 'result';

export interface Field {
    key: string;
    ar: string;
    en: string;
    type: FieldType;
    options?: { ar: string; en: string }[];
    help?: { ar: string; en: string };
}

export interface Section {
    key: string;
    ar: string;
    en: string;
    fields: Field[];
}

// Standardized result vocabulary (spec §5). A test cannot be "ناجح" without real evidence.
export const RESULT_OPTIONS: { ar: string; en: string }[] = [
    { ar: 'ناجح', en: 'Pass' },
    { ar: 'فشل', en: 'Fail' },
    { ar: 'تحذير', en: 'Warning' },
    { ar: 'لم يُختبر', en: 'Not tested' },
    { ar: 'تعذّر الاختبار', en: 'Could not test' },
    { ar: 'لا ينطبق', en: 'N/A' },
];

// Asset categories + confirmed OS families (never assume OS from the brand — spec §4).
export const ASSET_CATEGORIES: { key: string; ar: string; en: string }[] = [
    { key: 'windows_pc', ar: 'كمبيوتر مكتبي (Windows)', en: 'Windows PC' },
    { key: 'laptop', ar: 'لابتوب', en: 'Laptop' },
    { key: 'linux', ar: 'نظام Linux', en: 'Linux system' },
    { key: 'macbook', ar: 'ماك / MacBook', en: 'MacBook / macOS' },
    { key: 'aio', ar: 'All-in-One', en: 'All-in-One' },
    { key: 'server', ar: 'سيرفر', en: 'Server' },
    { key: 'storage', ar: 'وحدة تخزين', en: 'Storage device' },
    { key: 'printer', ar: 'طابعة / متعدد الوظائف', en: 'Printer / MFD' },
    { key: 'network', ar: 'جهاز شبكة', en: 'Networking device' },
    { key: 'cctv_ip', ar: 'كاميرات IP', en: 'IP CCTV' },
    { key: 'cctv_analog', ar: 'كاميرات تناظرية', en: 'Analog CCTV' },
    { key: 'other', ar: 'أخرى', en: 'Other' },
];

export const OS_FAMILIES: { key: string; ar: string; en: string }[] = [
    { key: 'windows', ar: 'Windows', en: 'Windows' },
    { key: 'linux', ar: 'Linux', en: 'Linux' },
    { key: 'macos', ar: 'macOS', en: 'macOS' },
    { key: 'other', ar: 'نظام آخر', en: 'Other OS' },
    { key: 'na', ar: 'لا يوجد نظام تشغيل', en: 'No OS' },
];

// Reusable option sets
const YN_UNSURE = [{ ar: 'نعم', en: 'Yes' }, { ar: 'لا', en: 'No' }, { ar: 'غير مؤكد', en: 'Unsure' }];
const CONDITION = [{ ar: 'ممتاز', en: 'Excellent' }, { ar: 'جيد', en: 'Good' }, { ar: 'متوسط', en: 'Fair' }, { ar: 'ضعيف', en: 'Poor' }];
const RISK = [{ ar: 'منخفض', en: 'Low' }, { ar: 'متوسط', en: 'Medium' }, { ar: 'مرتفع', en: 'High' }];

const note = (): Field => ({ key: 'notes', ar: 'ملاحظات / استثناءات', en: 'Notes / exceptions', type: 'textarea' });
const result = (key: string, ar: string, en: string): Field => ({ key, ar, en, type: 'result' });

// ── Section library ──
export const SECTIONS: Record<string, Section> = {
    general: {
        key: 'general', ar: 'بيانات عامة', en: 'General',
        fields: [
            { key: 'requested_work', ar: 'الخدمة / العمل المطلوب', en: 'Requested work', type: 'textarea' },
            { key: 'urgency', ar: 'الأولوية', en: 'Priority', type: 'select', options: [{ ar: 'منخفضة', en: 'Low' }, { ar: 'عادية', en: 'Normal' }, { ar: 'مرتفعة', en: 'High' }, { ar: 'حرجة', en: 'Critical' }] },
            { key: 'client_need_confirmed', ar: 'تم تأكيد احتياج العميل', en: 'Client need confirmed', type: 'bool' },
        ],
    },
    site_readiness: {
        key: 'site_readiness', ar: 'جاهزية الموقع', en: 'Site readiness',
        fields: [
            { key: 'power_available', ar: 'مصدر الكهرباء', en: 'Power source', type: 'select', options: [{ ar: 'متوفر', en: 'Available' }, { ar: 'غير متوفر', en: 'Unavailable' }, { ar: 'غير مؤكد', en: 'Unsure' }] },
            { key: 'space_ready', ar: 'المكان مجهّز', en: 'Space prepared', type: 'bool' },
            { key: 'environment_suitable', ar: 'البيئة مناسبة (تهوية/حرارة)', en: 'Environment suitable', type: 'select', options: [{ ar: 'مناسبة', en: 'Suitable' }, { ar: 'غير مناسبة', en: 'Unsuitable' }, { ar: 'يحتاج تجهيز', en: 'Needs prep' }] },
            { key: 'access_path_clear', ar: 'مسار الوصول متاح', en: 'Access path clear', type: 'bool' },
            note(),
        ],
    },
    install_prereq: {
        key: 'install_prereq', ar: 'متطلبات التركيب', en: 'Installation prerequisites',
        fields: [
            result('prerequisites_met', 'المتطلبات مكتملة', 'Prerequisites met'),
            { key: 'required_licenses', ar: 'التراخيص المطلوبة', en: 'Required licenses', type: 'text' },
            { key: 'compatibility_confirmed', ar: 'تم تأكيد التوافق', en: 'Compatibility confirmed', type: 'select', options: YN_UNSURE },
            note(),
        ],
    },
    cabling: {
        key: 'cabling', ar: 'الكابلات والتمديدات', en: 'Cabling',
        fields: [
            { key: 'cabling_type', ar: 'نوع التمديد', en: 'Cabling type', type: 'select', options: [{ ar: 'شبكة', en: 'Network' }, { ar: 'كهرباء', en: 'Power' }, { ar: 'ألياف', en: 'Fiber' }, { ar: 'مدمج', en: 'Mixed' }, { ar: 'أخرى', en: 'Other' }] },
            { key: 'cabling_route_ready', ar: 'المسار جاهز', en: 'Route ready', type: 'bool' },
            { key: 'labeling_done', ar: 'تم ترقيم/تمييز الكابلات', en: 'Labeling done', type: 'bool' },
            note(),
        ],
    },
    configuration: {
        key: 'configuration', ar: 'الإعداد والتهيئة', en: 'Configuration',
        fields: [
            { key: 'config_scope', ar: 'نطاق الإعداد', en: 'Configuration scope', type: 'textarea' },
            { key: 'network_config_needed', ar: 'يتطلب إعداد شبكة', en: 'Network config needed', type: 'bool' },
            { key: 'backup_before_change', ar: 'نسخ احتياطي قبل التغيير', en: 'Backup before change', type: 'bool', help: { ar: 'مطلوب قبل أي تغيير قد يفقد بيانات.', en: 'Required before any change that may lose data.' } },
            note(),
        ],
    },
    acceptance: {
        key: 'acceptance', ar: 'معايير القبول', en: 'Acceptance',
        fields: [
            { key: 'acceptance_criteria', ar: 'معايير قبول العميل', en: 'Acceptance criteria', type: 'textarea' },
            { key: 'client_signoff_required', ar: 'يتطلب توقيع العميل', en: 'Client sign-off required', type: 'bool' },
            note(),
        ],
    },
    condition_assessment: {
        key: 'condition_assessment', ar: 'تقييم الحالة', en: 'Condition assessment',
        fields: [
            { key: 'physical_condition', ar: 'الحالة الفيزيائية', en: 'Physical condition', type: 'select', options: CONDITION },
            { key: 'visible_damage', ar: 'تلف ظاهر', en: 'Visible damage', type: 'bool' },
            note(),
        ],
    },
    maintenance_checks: {
        key: 'maintenance_checks', ar: 'أعمال الصيانة الدورية', en: 'Scheduled maintenance',
        fields: [
            result('scheduled_items_done', 'بنود الصيانة المجدولة', 'Scheduled items'),
            { key: 'parts_replaced', ar: 'قطع تم استبدالها', en: 'Parts replaced', type: 'text' },
            note(),
        ],
    },
    functional_test: {
        key: 'functional_test', ar: 'اختبار وظيفي', en: 'Functional test',
        fields: [
            result('powers_on', 'يعمل عند التشغيل', 'Powers on'),
            result('core_function_ok', 'الوظيفة الأساسية سليمة', 'Core function OK'),
            note(),
        ],
    },
    reported_fault: {
        key: 'reported_fault', ar: 'العطل المُبلّغ عنه', en: 'Reported fault',
        fields: [
            { key: 'fault_description', ar: 'وصف العطل', en: 'Fault description', type: 'textarea' },
            { key: 'fault_frequency', ar: 'تكرار العطل', en: 'Frequency', type: 'select', options: [{ ar: 'دائم', en: 'Constant' }, { ar: 'متقطع', en: 'Intermittent' }, { ar: 'عند التشغيل', en: 'On startup' }, { ar: 'أخرى', en: 'Other' }] },
            { key: 'first_occurred', ar: 'أول ظهور', en: 'First occurred', type: 'text' },
        ],
    },
    baseline_condition: {
        key: 'baseline_condition', ar: 'الحالة المرجعية قبل العمل', en: 'Baseline condition',
        fields: [
            { key: 'baseline_recorded', ar: 'تم توثيق الحالة قبل العمل', en: 'Baseline recorded', type: 'bool' },
            { key: 'known_defects', ar: 'عيوب معروفة', en: 'Known defects', type: 'textarea' },
            { key: 'data_backup_exists', ar: 'يوجد نسخ احتياطي للبيانات', en: 'Data backup exists', type: 'select', options: YN_UNSURE, help: { ar: 'مهم قبل أي عمل قد يؤثر على البيانات.', en: 'Important before any data-affecting work.' } },
        ],
    },
    diagnostic_sequence: {
        key: 'diagnostic_sequence', ar: 'تسلسل التشخيص المبدئي', en: 'Initial diagnostic',
        fields: [
            result('symptoms_reproduced', 'تم تكرار الأعراض', 'Symptoms reproduced'),
            { key: 'suspected_area', ar: 'المنطقة المشتبه بها', en: 'Suspected area', type: 'select', options: [{ ar: 'طاقة', en: 'Power' }, { ar: 'لوحة أم', en: 'Mainboard' }, { ar: 'تخزين', en: 'Storage' }, { ar: 'ذاكرة', en: 'Memory' }, { ar: 'شبكة', en: 'Network' }, { ar: 'برمجيات', en: 'Software' }, { ar: 'أخرى', en: 'Other' }] },
            { key: 'specialist_needed', ar: 'يتطلب أخصائي', en: 'Specialist needed', type: 'bool' },
            note(),
        ],
    },
    corrective_action: {
        key: 'corrective_action', ar: 'الإجراء التصحيحي المقترح', en: 'Proposed corrective action',
        fields: [
            { key: 'proposed_action', ar: 'الإجراء المقترح', en: 'Proposed action', type: 'textarea' },
            { key: 'parts_required', ar: 'قطع مطلوبة', en: 'Parts required', type: 'text' },
            { key: 'risk_level', ar: 'مستوى المخاطرة', en: 'Risk level', type: 'select', options: RISK },
            { key: 'requires_approval', ar: 'يتطلب اعتماد الإدارة', en: 'Requires management approval', type: 'bool' },
        ],
    },
    upgrade_checks: {
        key: 'upgrade_checks', ar: 'الترقية / الاستبدال', en: 'Upgrade / replacement',
        fields: [
            { key: 'current_spec', ar: 'المواصفات الحالية', en: 'Current spec', type: 'text' },
            { key: 'target_spec', ar: 'المواصفات المستهدفة', en: 'Target spec', type: 'text' },
            { key: 'compatibility_confirmed', ar: 'تم تأكيد التوافق', en: 'Compatibility confirmed', type: 'select', options: YN_UNSURE },
            { key: 'data_migration_needed', ar: 'يتطلب نقل بيانات', en: 'Data migration needed', type: 'bool' },
        ],
    },
    integration_checks: {
        key: 'integration_checks', ar: 'تكامل الأنظمة', en: 'System integration',
        fields: [
            { key: 'systems_involved', ar: 'الأنظمة المعنية', en: 'Systems involved', type: 'textarea' },
            { key: 'interfaces', ar: 'الواجهات / نقاط الربط', en: 'Interfaces', type: 'text' },
            { key: 'data_protection_measures', ar: 'إجراءات حماية البيانات', en: 'Data-protection measures', type: 'textarea' },
        ],
    },
    it_infra_checks: {
        key: 'it_infra_checks', ar: 'بنية تحتية لتقنية المعلومات', en: 'IT infrastructure',
        fields: [
            { key: 'scope', ar: 'نطاق التنفيذ', en: 'Scope', type: 'textarea' },
            { key: 'existing_infra', ar: 'البنية القائمة', en: 'Existing infrastructure', type: 'textarea' },
            { key: 'downtime_window', ar: 'نافذة التوقف المسموح بها', en: 'Allowed downtime window', type: 'text' },
        ],
    },
    network_checks: {
        key: 'network_checks', ar: 'فحوص الشبكة', en: 'Network checks',
        fields: [
            { key: 'topology', ar: 'طوبولوجيا الشبكة', en: 'Topology', type: 'select', options: [{ ar: 'نجمة', en: 'Star' }, { ar: 'شجرة', en: 'Tree' }, { ar: 'مختلط', en: 'Mixed' }, { ar: 'غير محدد', en: 'Undetermined' }] },
            { key: 'devices_count', ar: 'عدد الأجهزة', en: 'Device count', type: 'number' },
            result('connectivity_ok', 'الاتصال سليم', 'Connectivity OK'),
            note(),
        ],
    },
    server_role: {
        key: 'server_role', ar: 'السيرفر ودوره', en: 'Server & role',
        fields: [
            { key: 'os_confirmed', ar: 'تم تأكيد نظام التشغيل فعلياً', en: 'OS actually confirmed', type: 'bool', help: { ar: 'لا تفترض النظام من نوع الجهاز — أكّده.', en: 'Never assume the OS from the device — confirm it.' } },
            { key: 'intended_role', ar: 'الدور المقصود', en: 'Intended role', type: 'text' },
            { key: 'services', ar: 'الخدمات المشغّلة', en: 'Running services', type: 'textarea' },
            note(),
        ],
    },
    storage_checks: {
        key: 'storage_checks', ar: 'فحوص التخزين', en: 'Storage checks',
        fields: [
            { key: 'storage_capacity', ar: 'السعة', en: 'Capacity', type: 'text' },
            result('storage_health', 'سلامة التخزين', 'Storage health'),
            { key: 'raid_config', ar: 'إعداد RAID', en: 'RAID config', type: 'text' },
            note(),
        ],
    },
    cctv_cameras: {
        key: 'cctv_cameras', ar: 'الكاميرات', en: 'Cameras',
        fields: [
            { key: 'camera_count', ar: 'عدد الكاميرات', en: 'Camera count', type: 'number' },
            { key: 'camera_type', ar: 'نوع الكاميرات', en: 'Camera type', type: 'select', options: [{ ar: 'IP', en: 'IP' }, { ar: 'تناظري', en: 'Analog' }, { ar: 'مدمج', en: 'Mixed' }] },
            result('cameras_functional', 'الكاميرات تعمل', 'Cameras functional'),
            note(),
        ],
    },
    cctv_recorder: {
        key: 'cctv_recorder', ar: 'جهاز التسجيل', en: 'Recorder',
        fields: [
            { key: 'recorder_type', ar: 'نوع المسجل', en: 'Recorder type', type: 'select', options: [{ ar: 'NVR', en: 'NVR' }, { ar: 'DVR', en: 'DVR' }, { ar: 'غير موجود', en: 'None' }] },
            { key: 'channels', ar: 'عدد القنوات', en: 'Channels', type: 'number' },
            result('recording_ok', 'التسجيل يعمل', 'Recording OK'),
            { key: 'retention_days', ar: 'مدة الاحتفاظ (أيام)', en: 'Retention (days)', type: 'number' },
        ],
    },
    cctv_network_power: {
        key: 'cctv_network_power', ar: 'الشبكة والتغذية', en: 'Network & power',
        fields: [
            { key: 'poe_or_power', ar: 'التغذية', en: 'Power feed', type: 'select', options: [{ ar: 'PoE', en: 'PoE' }, { ar: 'مصدر منفصل', en: 'Separate PSU' }, { ar: 'مدمج', en: 'Mixed' }] },
            result('network_ok', 'الشبكة سليمة', 'Network OK'),
            note(),
        ],
    },
    printer_checks: {
        key: 'printer_checks', ar: 'فحوص الطابعة', en: 'Printer checks',
        fields: [
            { key: 'connection', ar: 'نوع التوصيل', en: 'Connection', type: 'select', options: [{ ar: 'USB', en: 'USB' }, { ar: 'شبكة', en: 'Network' }, { ar: 'لاسلكي', en: 'Wireless' }] },
            result('prints_test_page', 'طباعة صفحة اختبار', 'Prints test page'),
            { key: 'consumables_level', ar: 'مستوى المستهلكات', en: 'Consumables level', type: 'select', options: [{ ar: 'مرتفع', en: 'High' }, { ar: 'متوسط', en: 'Medium' }, { ar: 'منخفض', en: 'Low' }, { ar: 'فارغ', en: 'Empty' }] },
            note(),
        ],
    },
    workstation_checks: {
        key: 'workstation_checks', ar: 'محطة العمل الهندسية', en: 'Engineering workstation',
        fields: [
            { key: 'specs_adequate', ar: 'المواصفات كافية', en: 'Specs adequate', type: 'select', options: YN_UNSURE },
            { key: 'required_software', ar: 'البرامج المطلوبة', en: 'Required software', type: 'textarea' },
            { key: 'licensing_ok', ar: 'التراخيص سليمة', en: 'Licensing OK', type: 'select', options: YN_UNSURE },
            note(),
        ],
    },
    data_service_checks: {
        key: 'data_service_checks', ar: 'خدمات البيانات', en: 'Data services',
        fields: [
            { key: 'service_type', ar: 'نوع الخدمة', en: 'Service type', type: 'select', options: [{ ar: 'استرجاع بيانات', en: 'Data recovery' }, { ar: 'محو آمن', en: 'Secure erase' }] },
            { key: 'authorization_confirmed', ar: 'تم تأكيد التفويض الكتابي', en: 'Written authorization confirmed', type: 'bool', help: { ar: 'لا عملية محو/استرجاع بدون تفويض — تتطلب اعتماد.', en: 'No erase/recovery without authorization — requires approval.' } },
            { key: 'media_type', ar: 'نوع الوسيط', en: 'Media type', type: 'text' },
            { key: 'backup_before', ar: 'نسخ احتياطي قبل البدء', en: 'Backup before start', type: 'bool' },
        ],
    },
    inventory_assessment_checks: {
        key: 'inventory_assessment_checks', ar: 'جرد وتقييم الأصول', en: 'Inventory & asset assessment',
        fields: [
            { key: 'asset_count_estimate', ar: 'عدد الأصول التقديري', en: 'Estimated asset count', type: 'number' },
            { key: 'labeling_scheme', ar: 'نظام الترقيم', en: 'Labeling scheme', type: 'text' },
            note(),
        ],
    },
    findings: {
        key: 'findings', ar: 'النتائج والتوصيات', en: 'Findings & recommendations',
        fields: [
            { key: 'summary', ar: 'ملخص النتائج', en: 'Findings summary', type: 'textarea' },
            { key: 'unresolved_findings', ar: 'نتائج غير محسومة', en: 'Unresolved findings', type: 'textarea' },
            { key: 'recommended_scope', ar: 'نطاق العمل الموصى به', en: 'Recommended scope', type: 'textarea' },
            { key: 'specialist_required', ar: 'يتطلب تدخّل أخصائي', en: 'Specialist required', type: 'bool' },
        ],
    },
};

// Work types (spec §3). Each maps to the sections it reveals — irrelevant sections never show.
export const WORK_TYPES: { key: string; ar: string; en: string; sections: string[] }[] = [
    { key: 'supply_install', ar: 'توريد وتركيب جديد', en: 'Supply & installation', sections: ['site_readiness', 'install_prereq', 'cabling', 'configuration', 'acceptance'] },
    { key: 'preventive', ar: 'صيانة وقائية', en: 'Preventive maintenance', sections: ['condition_assessment', 'maintenance_checks', 'functional_test'] },
    { key: 'corrective', ar: 'صيانة علاجية / إصلاح عطل', en: 'Corrective maintenance', sections: ['reported_fault', 'baseline_condition', 'diagnostic_sequence', 'corrective_action'] },
    { key: 'completion', ar: 'استكمال مشروع قائم', en: 'Project completion', sections: ['site_readiness', 'configuration', 'acceptance'] },
    { key: 'upgrade', ar: 'ترقية / استبدال', en: 'Upgrade / replacement', sections: ['upgrade_checks', 'baseline_condition', 'acceptance'] },
    { key: 'integration', ar: 'تكامل أنظمة', en: 'System integration', sections: ['integration_checks', 'configuration', 'acceptance'] },
    { key: 'it_infra', ar: 'بنية تحتية لتقنية المعلومات', en: 'IT infrastructure', sections: ['it_infra_checks', 'cabling', 'configuration', 'acceptance'] },
    { key: 'network', ar: 'شبكات (تركيب / أعطال)', en: 'Networking', sections: ['network_checks', 'cabling', 'configuration'] },
    { key: 'server_storage', ar: 'سيرفرات وتخزين', en: 'Servers & storage', sections: ['server_role', 'storage_checks', 'functional_test'] },
    { key: 'cctv', ar: 'كاميرات مراقبة (CCTV/NVR/DVR)', en: 'CCTV / NVR / DVR', sections: ['cctv_cameras', 'cctv_recorder', 'cctv_network_power', 'storage_checks'] },
    { key: 'printer', ar: 'طابعات ومتعدد الوظائف', en: 'Printers & MFDs', sections: ['printer_checks', 'functional_test'] },
    { key: 'workstation', ar: 'محطات عمل هندسية وبرامج', en: 'Engineering workstations', sections: ['workstation_checks', 'functional_test'] },
    { key: 'inventory_assessment', ar: 'جرد وتقييم فني للأصول', en: 'Technical inventory', sections: ['inventory_assessment_checks', 'condition_assessment'] },
    { key: 'data_service', ar: 'استرجاع / محو بيانات آمن', en: 'Data recovery / secure erase', sections: ['data_service_checks', 'baseline_condition'] },
    { key: 'combined', ar: 'مشروع مركّب (توريد + تركيب + صيانة + تكامل)', en: 'Combined project', sections: ['site_readiness', 'install_prereq', 'condition_assessment', 'diagnostic_sequence', 'configuration', 'acceptance'] },
    { key: 'other', ar: 'نوع آخر', en: 'Other', sections: [] },
];

// Build the ordered, de-duplicated section list for the chosen work types.
// Always begins with "general" and ends with "findings".
export function sectionsFor(workTypes: string[]): Section[] {
    const keys: string[] = ['general'];
    for (const wt of workTypes) {
        const def = WORK_TYPES.find(w => w.key === wt);
        (def?.sections || []).forEach(s => { if (!keys.includes(s)) keys.push(s); });
    }
    keys.push('findings');
    return keys.map(k => SECTIONS[k]).filter(Boolean);
}

// Count fields that have a non-empty answer, for the progress indicator.
export function computeProgress(workTypes: string[], answers: Record<string, any>): number {
    const secs = sectionsFor(workTypes);
    let total = 0, filled = 0;
    for (const s of secs) for (const f of s.fields) {
        total++;
        const v = answers?.[s.key]?.[f.key];
        if (v !== undefined && v !== null && v !== '' && v !== false) filled++;
    }
    return total === 0 ? 0 : Math.round((filled / total) * 100);
}
