// Phase 3: the Z.Electronic business journey (Lead → … → Evaluation), modeled as ordered stages.
// Stages map to REAL records (client, survey, project, OF/IN documents, contract, payments, tasks,
// procurement, evaluation) so the journey reflects actual data rather than a parallel flow.
// Gated stages require the project's approval cycle to be approved (reuses the approvals engine).

export interface Stage {
    key: string;
    order: number;
    ar: string;
    en: string;
    gate?: boolean;   // advancing INTO this stage requires an approved approval cycle
}

export const STAGES: Stage[] = [
    { key: 'lead', order: 1, ar: 'عميل محتمل', en: 'Lead' },
    { key: 'customer', order: 2, ar: 'عميل فعلي', en: 'Customer' },
    { key: 'survey', order: 3, ar: 'مسح فني', en: 'Survey' },
    { key: 'assessment', order: 4, ar: 'تقييم فني', en: 'Technical assessment' },
    { key: 'project', order: 5, ar: 'مشروع', en: 'Project' },
    { key: 'pricing_quotation', order: 6, ar: 'تسعير وعرض سعر', en: 'Pricing & quotation' },
    { key: 'internal_approval', order: 7, ar: 'اعتماد داخلي', en: 'Internal approval', gate: true },
    { key: 'customer_approval', order: 8, ar: 'موافقة العميل', en: 'Customer approval' },
    { key: 'contract', order: 9, ar: 'تعاقد', en: 'Contract' },
    { key: 'advance_payment', order: 10, ar: 'دفعة مقدمة', en: 'Advance payment' },
    { key: 'procurement', order: 11, ar: 'مشتريات', en: 'Procurement' },
    { key: 'execution', order: 12, ar: 'تنفيذ', en: 'Execution' },
    { key: 'acceptance', order: 13, ar: 'قبول العميل', en: 'Customer acceptance' },
    { key: 'invoicing', order: 14, ar: 'فوترة', en: 'Invoicing' },
    { key: 'collection', order: 15, ar: 'تحصيل', en: 'Collection' },
    { key: 'handover', order: 16, ar: 'تسليم', en: 'Handover' },
    { key: 'warranty', order: 17, ar: 'ضمان وما بعد البيع', en: 'Warranty & after-sales' },
    { key: 'evaluation', order: 18, ar: 'تقييم العميل', en: 'Customer evaluation' },
];

export const stageByKey = (k: string | null | undefined): Stage | undefined => STAGES.find(s => s.key === k);
export const orderOf = (k: string | null | undefined): number => stageByKey(k)?.order ?? 0;

// Facts derived from real linked records.
export interface JourneyFacts {
    hasClient?: boolean;
    hasSurvey?: boolean;
    surveyAssessed?: boolean;   // survey submitted/reviewed/approved
    hasProject?: boolean;
    hasOffer?: boolean;         // a price offer (doc_type OF) exists
    internalApproved?: boolean; // project/offer approval_status = approved
    customerApproved?: boolean;
    hasContract?: boolean;
    hasPayment?: boolean;
    hasProcurement?: boolean;
    hasTasks?: boolean;
    hasInvoice?: boolean;       // a doc_type IN exists
    invoicePaid?: boolean;
    completed?: boolean;        // project Status completed/closed
    hasEvaluation?: boolean;
}

// Highest-order stage whose evidence is present (the journey reflects what actually happened).
export function deriveStage(f: JourneyFacts): string {
    if (f.hasEvaluation) return 'evaluation';
    if (f.completed) return 'handover';
    if (f.invoicePaid) return 'collection';
    if (f.hasInvoice) return 'invoicing';
    if (f.hasTasks) return 'execution';
    if (f.hasProcurement) return 'procurement';
    if (f.hasPayment) return 'advance_payment';
    if (f.hasContract) return 'contract';
    if (f.customerApproved) return 'customer_approval';
    if (f.internalApproved) return 'internal_approval';
    if (f.hasOffer) return 'pricing_quotation';
    if (f.hasProject) return 'project';
    if (f.surveyAssessed) return 'assessment';
    if (f.hasSurvey) return 'survey';
    if (f.hasClient) return 'customer';
    return 'lead';
}

// Allowed manual transitions from a stage: the immediate next stage(s). Moving backward is allowed
// (correction) but forward skips of more than one stage are not, to keep the journey auditable.
export function nextStages(current: string | null | undefined): Stage[] {
    const o = orderOf(current);
    return STAGES.filter(s => s.order === o + 1);
}

export function isForwardSkip(from: string | null | undefined, to: string): boolean {
    return orderOf(to) > orderOf(from) + 1;
}
