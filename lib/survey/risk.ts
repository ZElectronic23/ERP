// Phase 5: evidence-based risk assessment + approval gates.
//
// IMPORTANT: no invented failure probabilities, device lifespans or universal multipliers.
// Risk is expressed as QUALITATIVE classes (likelihood × impact → level) through a transparent,
// documented matrix, and every suggested rating carries a `basis` that cites the actual evidence
// (work type, recorded condition, diagnostic result, missing backup, etc.). A material risk cannot
// be accepted/mitigated without a basis + mitigation recorded.

import { selectDiagnostics } from './diagnostics';

export type Likelihood = 'rare' | 'possible' | 'likely';
export type Impact = 'low' | 'medium' | 'high' | 'critical';
export type Level = 'low' | 'medium' | 'high' | 'critical';

export const LIKELIHOOD_LABEL: Record<Likelihood, { ar: string; en: string }> = {
    rare: { ar: 'نادر', en: 'Rare' }, possible: { ar: 'محتمل', en: 'Possible' }, likely: { ar: 'مرجّح', en: 'Likely' },
};
export const IMPACT_LABEL: Record<Impact, { ar: string; en: string }> = {
    low: { ar: 'منخفض', en: 'Low' }, medium: { ar: 'متوسط', en: 'Medium' }, high: { ar: 'مرتفع', en: 'High' }, critical: { ar: 'حرج', en: 'Critical' },
};
export const LEVEL_LABEL: Record<Level, { ar: string; en: string; cls: string }> = {
    low: { ar: 'منخفض', en: 'Low', cls: 'bg-green-500/20 text-green-300' },
    medium: { ar: 'متوسط', en: 'Medium', cls: 'bg-yellow-500/20 text-yellow-300' },
    high: { ar: 'مرتفع', en: 'High', cls: 'bg-orange-500/20 text-orange-300' },
    critical: { ar: 'حرج', en: 'Critical', cls: 'bg-red-500/20 text-red-300' },
};

// Transparent qualitative matrix (documented, not an invented number).
const MATRIX: Record<Likelihood, Record<Impact, Level>> = {
    rare: { low: 'low', medium: 'low', high: 'medium', critical: 'high' },
    possible: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' },
    likely: { low: 'medium', medium: 'high', high: 'critical', critical: 'critical' },
};
export function levelOf(l?: string | null, i?: string | null): Level | null {
    if (!l || !i) return null;
    return MATRIX[l as Likelihood]?.[i as Impact] || null;
}

export const DIMENSIONS: { key: string; ar: string; en: string }[] = [
    { key: 'equipment_failure', ar: 'عطل المعدة القائمة', en: 'Existing equipment failure' },
    { key: 'handling_damage', ar: 'ضرر أثناء المناولة/الفك/التركيب', en: 'Handling/disassembly/install damage' },
    { key: 'data_loss', ar: 'فقد البيانات', en: 'Data loss' },
    { key: 'service_interruption', ar: 'انقطاع الخدمة', en: 'Service interruption' },
    { key: 'scope_expansion', ar: 'توسّع نطاق العمل', en: 'Scope expansion' },
    { key: 'missing_resources', ar: 'نقص أدوات/قطع/معدات', en: 'Missing tools/parts/equipment' },
    { key: 'specialist_dependency', ar: 'الاعتماد على أخصائي', en: 'Specialist dependency' },
    { key: 'schedule_overrun', ar: 'تجاوز الجدول الزمني', en: 'Schedule overrun' },
    { key: 'cost_underestimation', ar: 'نقص تقدير التكلفة', en: 'Cost underestimation' },
    { key: 'site_client_constraints', ar: 'قيود الموقع/اعتماد العميل', en: 'Site/client constraints' },
];

export interface SuggestedRisk {
    dimension: string; likelihood: Likelihood; impact: Impact; basis_ar: string; basis_en: string; requires_approval?: boolean;
}

// Derive ONLY the material (triggered) dimensions from recorded evidence, with a cited basis.
export function buildRisks(
    survey: { work_types?: string[]; answers?: Record<string, any> },
    assets: { category?: string; os_family?: string }[],
): SuggestedRisk[] {
    const wt = survey.work_types || [];
    const ans = survey.answers || {};
    const out: SuggestedRisk[] = [];
    const anyOf = (...k: string[]) => k.some(x => wt.includes(x));
    const diags = (assets || []).flatMap(a => selectDiagnostics(a));
    const hasServiceImpact = diags.some(d => d.impact === 'service');
    const hasSpecialist = diags.some(d => d.status === 'needs_review' || d.tier === 'specialist') || ans.findings?.specialist_required === true || ans.diagnostic_sequence?.specialist_needed === true;
    const backupMissing = (ans.baseline_condition?.data_backup_exists && ans.baseline_condition.data_backup_exists !== 'نعم' && ans.baseline_condition.data_backup_exists !== 'Yes');

    // data loss
    if (wt.includes('data_service'))
        out.push({ dimension: 'data_loss', likelihood: 'possible', impact: 'critical', requires_approval: true, basis_ar: 'عملية بيانات (استرجاع/محو) — أي خطأ قد يفقد البيانات نهائياً.', basis_en: 'Data operation (recovery/erase) — any error may permanently lose data.' });
    else if (anyOf('corrective', 'upgrade', 'server_storage', 'integration') || backupMissing)
        out.push({ dimension: 'data_loss', likelihood: backupMissing ? 'likely' : 'possible', impact: 'high', requires_approval: backupMissing, basis_ar: backupMissing ? 'عمل قد يؤثر على البيانات ولا يوجد نسخ احتياطي مؤكَّد.' : 'عمل قد يؤثر على التخزين/النظام.', basis_en: backupMissing ? 'Data-affecting work with no confirmed backup.' : 'Work that may affect storage/system.' });

    // service interruption
    if (hasServiceImpact || anyOf('server_storage', 'network', 'it_infra', 'integration'))
        out.push({ dimension: 'service_interruption', likelihood: 'possible', impact: 'high', requires_approval: hasServiceImpact, basis_ar: hasServiceImpact ? 'إجراء قد يوقف الخدمة أثناء التنفيذ.' : 'عمل على بنية تشغيلية قد يقطع الخدمة.', basis_en: hasServiceImpact ? 'A procedure may interrupt service during execution.' : 'Work on operational infrastructure may interrupt service.' });

    // handling damage
    if (anyOf('supply_install', 'upgrade', 'corrective', 'completion'))
        out.push({ dimension: 'handling_damage', likelihood: 'possible', impact: 'medium', basis_ar: 'يتضمن فكّ/تركيب/مناولة للمعدات.', basis_en: 'Involves disassembly/installation/handling.' });

    // equipment failure (from recorded condition — not from brand)
    const cond = ans.condition_assessment?.physical_condition;
    const damaged = ans.condition_assessment?.visible_damage === true;
    if (cond === 'ضعيف' || cond === 'Poor' || damaged)
        out.push({ dimension: 'equipment_failure', likelihood: 'likely', impact: 'high', basis_ar: `الحالة المسجّلة ${damaged ? 'بها تلف ظاهر' : 'ضعيفة'} — احتمال عطل أثناء العمل.`, basis_en: `Recorded condition is ${damaged ? 'visibly damaged' : 'poor'} — failure likely during work.` });
    else if (cond === 'متوسط' || cond === 'Fair' || ans.reported_fault?.fault_description)
        out.push({ dimension: 'equipment_failure', likelihood: 'possible', impact: 'medium', basis_ar: 'حالة متوسطة أو عطل مُبلّغ عنه.', basis_en: 'Fair condition or a reported fault.' });

    // scope expansion
    if (ans.findings?.unresolved_findings || ans.findings?.recommended_scope || ans.diagnostic_sequence?.specialist_needed === true)
        out.push({ dimension: 'scope_expansion', likelihood: 'possible', impact: 'medium', basis_ar: 'نتائج غير محسومة أو نطاق موصى به إضافي.', basis_en: 'Unresolved findings or extra recommended scope.' });

    // specialist dependency
    if (hasSpecialist)
        out.push({ dimension: 'specialist_dependency', likelihood: 'possible', impact: 'medium', basis_ar: 'توجد إجراءات تتطلب أخصائياً أو قيد المراجعة.', basis_en: 'Procedures requiring a specialist or under review exist.' });

    // missing resources
    if (ans.corrective_action?.parts_required || ans.corrective_action?.requires_approval === true)
        out.push({ dimension: 'missing_resources', likelihood: 'possible', impact: 'medium', basis_ar: 'قطع/إجراء تصحيحي قد لا تكون متوفرة عند الزيارة.', basis_en: 'Parts/corrective action may not be on hand at the visit.' });

    // site / client constraints
    if (ans.acceptance?.client_signoff_required === true)
        out.push({ dimension: 'site_client_constraints', likelihood: 'possible', impact: 'medium', basis_ar: 'العمل يعتمد على توقيع/تواجد العميل.', basis_en: 'Work depends on client sign-off/availability.' });

    // schedule / cost: only when complexity drivers are already present (dependent, qualitative)
    if (wt.includes('combined') || wt.length >= 3)
        out.push({ dimension: 'schedule_overrun', likelihood: 'possible', impact: 'medium', basis_ar: 'مشروع مركّب/متعدد الأنواع يرفع احتمال تجاوز الجدول.', basis_en: 'A combined/multi-type project raises overrun likelihood.' });

    return out.map(r => ({ ...r }));
}

export const GATE_LABEL: Record<string, { ar: string; en: string }> = {
    destructive_data: { ar: 'عملية بيانات مدمّرة (استرجاع/محو) — تتطلب تفويضاً', en: 'Destructive data operation — authorization required' },
    service_impact: { ar: 'إجراء يوقف الخدمة — يتطلب اعتماد نافذة توقّف', en: 'Service-impacting action — downtime approval required' },
    out_of_scope: { ar: 'عمل خارج النطاق المتفق عليه — يتطلب اعتماداً', en: 'Work outside agreed scope — approval required' },
    missing_backup: { ar: 'لا يوجد نسخ احتياطي مؤكَّد قبل عمل يؤثر على البيانات — تصعيد', en: 'No confirmed backup before data-affecting work — escalation' },
    missing_permission: { ar: 'يتطلب صلاحيات مرتفعة على الجهاز — يلزم تفويض الوصول', en: 'Requires elevated device privileges — access authorization needed' },
    specialist_commit: { ar: 'الالتزام بأخصائي/جهة خارجية — لا التزام تلقائي دون اعتماد', en: 'Specialist/subcontractor commitment — no auto-commitment without approval' },
};

export interface SuggestedGate { gate_type: string; reason_ar: string; reason_en: string; required_role: string; }

// Derive the approval gates that the evidence triggers (spec §9).
export function buildGates(
    survey: { work_types?: string[]; answers?: Record<string, any> },
    assets: { category?: string; os_family?: string }[],
): SuggestedGate[] {
    const wt = survey.work_types || [];
    const ans = survey.answers || {};
    const diags = (assets || []).flatMap(a => selectDiagnostics(a));
    const out: SuggestedGate[] = [];

    if (wt.includes('data_service'))
        out.push({ gate_type: 'destructive_data', required_role: 'ceo', reason_ar: 'المسح يتضمن استرجاع/محو بيانات — لا تنفيذ دون تفويض كتابي معتمد.', reason_en: 'Survey includes data recovery/erase — no execution without approved written authorization.' });
    if (diags.some(d => d.impact === 'service'))
        out.push({ gate_type: 'service_impact', required_role: 'manager', reason_ar: 'توجد إجراءات قد توقف الخدمة — يلزم اعتماد نافذة التوقّف مع العميل.', reason_en: 'Procedures may interrupt service — a downtime window must be approved with the client.' });
    if (ans.corrective_action?.requires_approval === true || ans.findings?.recommended_scope)
        out.push({ gate_type: 'out_of_scope', required_role: 'manager', reason_ar: 'عمل تصحيحي/موصى به خارج النطاق — يتطلب اعتماد الإدارة قبل التنفيذ.', reason_en: 'Corrective/recommended work beyond scope — management approval required before execution.' });
    const backupMissing = (ans.baseline_condition?.data_backup_exists && ans.baseline_condition.data_backup_exists !== 'نعم' && ans.baseline_condition.data_backup_exists !== 'Yes');
    if (backupMissing && (wt.includes('data_service') || wt.some(x => ['corrective', 'upgrade', 'server_storage', 'integration'].includes(x))))
        out.push({ gate_type: 'missing_backup', required_role: 'manager', reason_ar: 'عمل قد يؤثر على البيانات بدون نسخ احتياطي مؤكَّد — تصعيد قبل البدء.', reason_en: 'Data-affecting work without a confirmed backup — escalate before starting.' });
    if (diags.some(d => d.privilege === 'admin' || d.privilege === 'root'))
        out.push({ gate_type: 'missing_permission', required_role: 'manager', reason_ar: 'بعض الإجراءات تتطلب صلاحيات مدير/root — يلزم تفويض الوصول من المخوّل.', reason_en: 'Some procedures need admin/root — access authorization required from the authorized party.' });
    if (diags.some(d => d.status === 'needs_review' || d.tier === 'specialist') || ans.findings?.specialist_required === true)
        out.push({ gate_type: 'specialist_commit', required_role: 'manager', reason_ar: 'يلزم أخصائي — لا التزام تلقائي بجهة غير متاحة دون اعتماد.', reason_en: 'A specialist is needed — no automatic commitment to an unavailable party without approval.' });

    return out;
}
