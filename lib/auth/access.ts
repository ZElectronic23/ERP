// Shared, client-safe access model: which modules a user may see, and whether they may see
// sensitive company financials (revenue / profit / company-wide analytics). Used by BOTH the
// navigation (UserMenu) and the dashboard so the same rule hides a module everywhere — a
// technician never sees P&L, a partner sees only what concerns them.
//
// Precedence: explicit user_permissions rows (can_view) win when present; otherwise fall back
// to sensible per-role defaults. This is a UI gate; server routes/RLS remain the hard enforcement.

export type ModuleKey =
    | 'clients' | 'documents' | 'invoices' | 'legal' | 'approvals' | 'projects' | 'surveys'
    | 'knowledge' | 'maintenance' | 'products' | 'employees' | 'hr' | 'payroll' | 'evaluations'
    | 'accounting' | 'market' | 'partners' | 'support' | 'marketing' | 'admin'
    // personal workspace + newer modules
    | 'calendar' | 'meetings' | 'learning' | 'competency' | 'roadmap' | 'rnd';

export const ALL_MODULES: ModuleKey[] = [
    'clients', 'documents', 'invoices', 'legal', 'approvals', 'projects', 'surveys', 'knowledge',
    'maintenance', 'products', 'employees', 'hr', 'payroll', 'evaluations', 'accounting', 'market', 'partners', 'support', 'marketing',
    'calendar', 'meetings', 'learning', 'competency', 'roadmap', 'rnd', 'admin',
];

// Personal-workspace modules every INTERNAL (non-partner) user gets by default — calendar,
// meetings, learning, competency and development roadmap are self-service for all staff.
// Registering them here means a newly added workspace module shows up for everyone without
// editing each role; owner/full roles already see everything.
export const COMMON_MODULES: ModuleKey[] = ['calendar', 'meetings', 'learning', 'competency', 'roadmap', 'knowledge'];

// Roles with unrestricted access (owner-level).
const FULL_ROLES = ['ceo', 'admin', 'general_manager'];
// External/partner roles: see only their own share — never company modules or financials,
// even if the account is flagged is_admin.
const PARTNER_ROLES = ['investor', 'partner', 'techpartner', 'technical_partner', 'financial_partner'];

// Per-role default module visibility (when no explicit user_permissions rows exist).
const ROLE_DEFAULTS: Record<string, ModuleKey[]> = {
    crm: ['clients', 'documents', 'invoices', 'approvals', 'surveys', 'evaluations', 'knowledge', 'maintenance', 'support'],
    sales: ['clients', 'documents', 'invoices', 'approvals', 'support', 'market', 'knowledge'],
    pr: ['clients', 'support', 'knowledge'],
    finance: ['accounting', 'invoices', 'documents', 'market', 'approvals', 'payroll', 'partners'],
    hrd: ['employees', 'hr', 'payroll', 'evaluations', 'approvals'],
    hr: ['employees', 'hr', 'payroll', 'evaluations', 'approvals'],
    pm: ['projects', 'surveys', 'maintenance', 'documents', 'approvals', 'products', 'knowledge', 'clients', 'rnd'],
    project_manager: ['projects', 'surveys', 'maintenance', 'documents', 'approvals', 'products', 'knowledge', 'clients', 'rnd'],
    technician: ['maintenance', 'projects', 'surveys', 'knowledge', 'approvals', 'rnd'],
    // Research & Development: owns the R&D board, touches products/projects/surveys it feeds.
    rnd: ['rnd', 'projects', 'products', 'surveys', 'documents', 'approvals', 'knowledge', 'clients', 'market'],
    researcher: ['rnd', 'projects', 'products', 'surveys', 'documents', 'approvals', 'knowledge'],
    support: ['support', 'maintenance', 'knowledge', 'clients', 'approvals', 'evaluations'],
    marketing: ['marketing', 'market', 'clients', 'knowledge'],
};

export interface AccessInput {
    role_key?: string | null;
    is_admin?: boolean | null;
    entity_type?: string | null;
}
export interface PermRow { module: string; can_view?: boolean | null; }

export interface Access {
    role: string;
    isFull: boolean;        // owner-level (sees everything)
    isPartner: boolean;     // external/partner (own share only)
    canFinancials: boolean; // may see revenue / profit / company-wide analytics
    modules: Set<string>;
    has: (m: ModuleKey | string) => boolean;
}

export function buildAccess(user: AccessInput | null | undefined, permRows?: PermRow[] | null): Access {
    const rk = (user?.role_key || '').toLowerCase().trim();
    const isPartner = PARTNER_ROLES.includes(rk) || (user?.entity_type || '').toLowerCase() === 'partner';
    const isFull = !isPartner && (FULL_ROLES.includes(rk) || !!user?.is_admin);

    // Financials are owner/finance/manager only — never partners/technicians.
    const canFinancials = isFull || (!isPartner && (rk.includes('financ') || rk === 'manager'));

    let modules: Set<string>;
    if (isFull) {
        modules = new Set(ALL_MODULES);
    } else if (isPartner) {
        modules = new Set<string>(['partners']); // their own share only
    } else if (permRows && permRows.length) {
        modules = new Set(permRows.filter(p => p.can_view).map(p => p.module));
        // personal-workspace modules stay available even under explicit permissions
        COMMON_MODULES.forEach(m => modules.add(m));
    } else {
        modules = new Set<string>([...(ROLE_DEFAULTS[rk] || []), ...COMMON_MODULES]);
    }
    return {
        role: rk, isFull, isPartner, canFinancials, modules,
        has: (m) => isFull || modules.has(m as string),
    };
}
