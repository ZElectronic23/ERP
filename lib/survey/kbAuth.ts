// Knowledge-base authorization (server-side). Reading is open to any signed-in user;
// editing is limited to technical/managerial roles, and approving/suspending to managers+.
export function canEditKb(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    if (rk === 'ceo') return true;
    return ['manager', 'engineer', 'specialist', 'tech', 'it'].some(k => rk.includes(k));
}

export function canApproveKb(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk === 'ceo' || rk.includes('manager');
}

export const KB_STATUSES = ['draft', 'review', 'approved', 'needs_update', 'suspended'] as const;
// setting these requires approver authority
export const RESTRICTED_STATUSES = ['approved', 'suspended'];
