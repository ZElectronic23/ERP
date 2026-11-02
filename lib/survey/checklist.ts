// Phase 4: automated pre-visit preparation checklist.
// buildChecklist() derives ONLY applicable items from the survey's work types, assets,
// selected diagnostics and recorded answers. computeReadiness() turns the items' statuses
// into a go / prepare / await-approval / decision recommendation based on the actual
// CRITICAL prerequisites — never a universal rule.

import { selectDiagnostics } from './diagnostics';

export interface SuggestedItem {
    item_key: string;
    kind: string;
    label_ar: string;
    label_en: string;
    detail?: string;
    critical?: boolean;
    remote_possible?: boolean;
    status?: string;
}

export const ITEM_STATUSES = ['required', 'prepared', 'verified', 'unavailable', 'na', 'awaiting_approval'] as const;

export const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
    required: { ar: 'مطلوب', en: 'Required' },
    prepared: { ar: 'تم التجهيز', en: 'Prepared' },
    verified: { ar: 'تم التحقق', en: 'Verified' },
    unavailable: { ar: 'غير متاح', en: 'Unavailable' },
    na: { ar: 'لا ينطبق', en: 'N/A' },
    awaiting_approval: { ar: 'بانتظار الموافقة', en: 'Awaiting approval' },
};

export const KIND_LABEL: Record<string, { ar: string; en: string }> = {
    tool: { ar: 'أداة', en: 'Tool' },
    software: { ar: 'برنامج', en: 'Software' },
    bootable: { ar: 'وسيط إقلاع', en: 'Bootable media' },
    driver: { ar: 'تعريف/أداة شركة', en: 'Driver/vendor utility' },
    cable: { ar: 'كابلات وكهرباء', en: 'Cables & power' },
    measuring: { ar: 'أداة قياس', en: 'Measuring instrument' },
    spare: { ar: 'قطع غيار', en: 'Spare parts' },
    access: { ar: 'صلاحيات/وصول', en: 'Access/credentials' },
    backup: { ar: 'نسخ احتياطي', en: 'Backup' },
    skill: { ar: 'مهارة فنية', en: 'Technician skill' },
    specialist: { ar: 'أخصائي', en: 'Specialist' },
    subcontractor: { ar: 'مقاول باطن', en: 'Subcontractor' },
    site_access: { ar: 'الوصول للموقع', en: 'Site access' },
    approval: { ar: 'اعتماد/تفويض', en: 'Approval' },
    prior_record: { ar: 'سجلات سابقة', en: 'Prior records' },
    other: { ar: 'أخرى', en: 'Other' },
};

export function buildChecklist(
    survey: { work_types?: string[]; answers?: Record<string, any>; project_code?: string | null },
    assets: { category?: string; os_family?: string }[],
): SuggestedItem[] {
    const wt = survey.work_types || [];
    const ans = survey.answers || {};
    const out = new Map<string, SuggestedItem>();
    const add = (it: SuggestedItem) => { if (!out.has(it.item_key)) out.set(it.item_key, { critical: false, remote_possible: false, status: 'required', ...it }); };
    const anyOf = (...k: string[]) => k.some(x => wt.includes(x));

    // every visit
    add({ item_key: 'site_access', kind: 'site_access', critical: true, label_ar: 'تأكيد موعد الزيارة والوصول للموقع وتوفّر العميل', label_en: 'Confirm visit time, site access and client availability' });
    if (survey.project_code) add({ item_key: 'prior_records', kind: 'prior_record', remote_possible: true, label_ar: 'مراجعة سجلات ونتائج المشروع السابقة', label_en: 'Review prior project records and findings' });

    // per asset + its diagnostics
    const COMPUTER = ['windows_pc', 'laptop', 'linux', 'macbook', 'aio', 'server', 'storage'];
    (assets || []).forEach((a, idx) => {
        if (COMPUTER.includes(a.category || '') && (!a.os_family || a.os_family === 'na'))
            add({ item_key: `identify_${idx}`, kind: 'other', label_ar: 'تأكيد نوع الجهاز ونظام التشغيل على الطبيعة قبل اختيار الاختبارات', label_en: 'Confirm device type and OS on site before selecting tests' });
        for (const pr of selectDiagnostics(a)) {
            if (pr.app) {
                const kind = pr.tier === 'external' ? 'software' : 'tool';
                add({ item_key: `tool_${pr.id}`, kind, detail: pr.ar, remote_possible: ['gui', 'builtin_cmd', 'terminal'].includes(pr.tier), label_ar: `تجهيز: ${pr.app.ar}`, label_en: `Prepare: ${pr.app.en}` });
            }
            if (pr.tier === 'external')
                add({ item_key: `sw_${pr.id}`, kind: 'software', detail: 'تأكد من اعتماده في مكتبة البرامج قبل الاستخدام', label_ar: `برنامج معتمد: ${pr.app?.ar || pr.ar}`, label_en: `Approved software: ${pr.app?.en || pr.en}` });
            if (pr.privilege !== 'none')
                add({ item_key: `access_${pr.privilege}`, kind: 'access', critical: true, label_ar: `صلاحية ${pr.privilege === 'root' ? 'root' : 'مدير'} على الجهاز`, label_en: `${pr.privilege} rights on the device` });
            if (pr.impact === 'service')
                add({ item_key: 'downtime_approval', kind: 'approval', critical: true, status: 'awaiting_approval', label_ar: 'اعتماد نافذة توقّف الخدمة مع العميل', label_en: 'Approve a service-downtime window with the client' });
            if (pr.status === 'needs_review' || pr.tier === 'specialist')
                add({ item_key: 'specialist', kind: 'specialist', label_ar: 'ترتيب أخصائي مؤهّل للإجراءات المتخصصة/قيد المراجعة', label_en: 'Arrange a qualified specialist for specialist/under-review procedures' });
        }
    });

    // work-type driven equipment
    if (anyOf('corrective', 'upgrade', 'server_storage', 'integration', 'data_service', 'it_infra'))
        add({ item_key: 'backup', kind: 'backup', critical: true, label_ar: 'تجهيز وأخذ نسخة احتياطية قبل أي تغيير', label_en: 'Prepare and take a backup before any change' });
    if (wt.includes('data_service'))
        add({ item_key: 'data_auth', kind: 'approval', critical: true, status: 'awaiting_approval', label_ar: 'تفويض كتابي من العميل لعملية البيانات (استرجاع/محو)', label_en: 'Written client authorization for the data operation' });
    if (anyOf('supply_install', 'it_infra', 'network'))
        add({ item_key: 'cables', kind: 'cable', label_ar: 'تجهيز الكابلات والوصلات والمحوّلات ومعدّات الكهرباء اللازمة', label_en: 'Prepare required cables, adapters and power equipment' });
    if (wt.includes('network'))
        add({ item_key: 'net_tester', kind: 'measuring', label_ar: 'جهاز اختبار الشبكة/الكابلات', label_en: 'Network/cable tester' });
    if (wt.includes('cctv'))
        add({ item_key: 'cctv_tools', kind: 'measuring', label_ar: 'أدوات الكاميرات (اختبار PoE/كابل، سلّم عند الحاجة)', label_en: 'CCTV tools (PoE/cable tester, ladder if needed)' });

    // answers driven
    if (ans.corrective_action?.requires_approval === true)
        add({ item_key: 'mgmt_approval', kind: 'approval', critical: true, status: 'awaiting_approval', label_ar: 'اعتماد الإدارة للإجراء التصحيحي المقترح', label_en: 'Management approval for the proposed corrective action' });
    const parts = ans.corrective_action?.parts_required || ans.maintenance_checks?.parts_replaced;
    if (parts) add({ item_key: 'spares', kind: 'spare', label_ar: `تجهيز قطع الغيار: ${parts}`, label_en: `Prepare spare parts: ${parts}` });
    if (ans.findings?.specialist_required === true)
        add({ item_key: 'specialist', kind: 'specialist', label_ar: 'ترتيب أخصائي مؤهّل (حسب نتائج المسح)', label_en: 'Arrange a qualified specialist (per survey findings)' });
    if (ans.configuration?.backup_before_change === true || ans.data_service_checks?.backup_before === true)
        add({ item_key: 'backup', kind: 'backup', critical: true, label_ar: 'تجهيز وأخذ نسخة احتياطية قبل أي تغيير', label_en: 'Prepare and take a backup before any change' });

    return [...out.values()];
}

export type ReadinessLevel = 'go' | 'prepare' | 'await_approval' | 'decision' | 'empty';

export function computeReadiness(items: { critical: boolean; status: string; label_ar: string; label_en?: string | null }[]):
    { level: ReadinessLevel; criticalTotal: number; missingCritical: number; blockers: { ar: string; en: string }[] } {
    if (!items.length) return { level: 'empty', criticalTotal: 0, missingCritical: 0, blockers: [] };
    const crit = items.filter(i => i.critical && i.status !== 'na');
    const unavailable = crit.filter(i => i.status === 'unavailable');
    const awaiting = crit.filter(i => i.status === 'awaiting_approval');
    const pending = crit.filter(i => i.status === 'required');
    let level: ReadinessLevel = 'go';
    if (unavailable.length) level = 'decision';
    else if (awaiting.length) level = 'await_approval';
    else if (pending.length) level = 'prepare';
    const missing = crit.filter(i => !['prepared', 'verified'].includes(i.status));
    return {
        level,
        criticalTotal: crit.length,
        missingCritical: missing.length,
        blockers: [...unavailable, ...awaiting, ...pending].map(i => ({ ar: i.label_ar, en: i.label_en || i.label_ar })),
    };
}
