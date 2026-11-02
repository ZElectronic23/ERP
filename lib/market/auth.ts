// Who may trigger market-data updates (config-level change → management/finance only).
export function canManageMarket(role_key: string | null, is_admin: boolean): boolean {
    if (is_admin) return true;
    const rk = (role_key || '').toLowerCase();
    return rk === 'ceo' || rk.includes('manager') || rk.includes('financ');
}
