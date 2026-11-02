// Single source of truth for "who may decide an approval step".
// Used by the approval engine (PATCH /api/approvals), the inbox curation
// (/api/approvals/inbox) and the assistant (/api/chat) so the rule can never drift
// between the enforcer and the views that show actionable items.
//
// Rules:
//  - admins and the CEO may act on any step.
//  - an unassigned step (no required_role) is open to any authorized (internal, non-requester) user.
//  - a CEO-only step is closed to everyone else.
//  - finance steps → finance staff (role contains "financ") or a manager.
//  - manager / legal / hr / finance_manager steps → a manager (admins/CEO already returned true).
//  - any other named step (reviewer / planning / …) → any internal staff role (not an external client).
// The caller must still enforce separation of duties (a requester can't approve their own request)
// and sequence; this function only answers the role question.
export function canDecide(requiredRole: string | null, roleKey: string | null, isAdmin: boolean): boolean {
    if (isAdmin) return true;
    const rk = (roleKey || '').toLowerCase();
    // external clients never decide internal approvals — checked before the unassigned-step shortcut
    if (rk === 'regular_client' || rk === 'client') return false;
    if (rk === 'ceo') return true;
    if (!requiredRole) return true;
    const req = requiredRole.toLowerCase();
    if (req === 'ceo') return false;
    if (req.includes('finance')) return rk.includes('financ') || rk === 'manager';
    if (req === 'manager') return rk === 'manager';
    if (['legal', 'hr', 'finance_manager'].includes(req)) return rk === 'manager';
    // reviewer / planning / other → any internal staff role (not external clients)
    return rk !== 'regular_client' && rk !== 'client';
}
