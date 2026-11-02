import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';
import { canDecide } from '@/lib/approvals/roles';

// Permission-aware assistant. No external LLM: it reads the server-verified identity and
// permissions, then answers from REAL ERP data scoped to what the user is allowed to see.
// It never approves/rejects or bypasses access control.

interface QA { keys: string[]; ar: string; en: string; }
const GENERAL: QA[] = [
    { keys: ['حذف', 'delete', 'المحذوفات', 'trash', 'استعاده', 'restore'], ar: 'للحذف اضغط «حذف» — العنصر يروح للمحذوفات ويتعاد خلال 15 يوم، والحذف النهائي للمدير التنفيذي.', en: 'Delete moves items to Trash (recoverable 15 days); permanent delete is CEO-only.' },
    { keys: ['تصدير', 'اكسل', 'excel', 'export'], ar: 'في الحسابات اضغط «⬇ تصدير Excel» في ميزان المراجعة أو القيود أو المصروفات.', en: 'In Accounting use "⬇ Export Excel".' },
    { keys: ['تسعير', 'سعر', 'price'], ar: 'سعر البيع يُحسب تلقائياً من التكلفة حسب هامش الربح (الإعدادات في الحسابات).', en: 'Sell price is auto-calculated from cost by the margin.' },
];

const isEn = (m: string) => /[a-z]/i.test(m) && !/[؀-ۿ]/.test(m);
const has = (m: string, keys: string[]) => keys.some(k => m.includes(k.toLowerCase()));

export async function POST(request: Request) {
    const authed = await requireUser();
    const body = await request.json().catch(() => ({}));
    const message: string = (body?.message || '').toString();
    const page: string = (body?.page || 'default').toString();
    const m = message.toLowerCase();
    const en = isEn(m);

    if (!authed) return NextResponse.json({ reply: en ? 'Please sign in to use the assistant.' : 'من فضلك سجّل الدخول لاستخدام المساعد.' });
    const { entity_id, role_key, is_admin, email } = authed.profile;

    // load this user's module permissions
    const { data: permRows } = await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', entity_id);
    const canView = (mod: string) => is_admin || (role_key || '').toLowerCase() === 'ceo'
        || (permRows || []).some((p: any) => p.module === mod && p.can_view);

    // ── never perform an approval/decision via the assistant ──
    if (has(m, ['اعتمد ', 'وافق على', 'ارفض', 'اقبل الطلب', 'approve this', 'approve it', 'reject this', 'sign off'])) {
        return NextResponse.json({ reply: en
            ? 'I can’t approve or reject on your behalf. Open the item and use the approval panel — only you (the authorized approver) can record the decision.'
            : 'لا يمكنني الاعتماد أو الرفض نيابةً عنك. افتح العنصر واستخدم لوحة الاعتماد — القرار لازم يسجّله المعتمِد المخوّل بنفسه.' });
    }

    // ── pending approvals I must act on ──
    if (has(m, ['اعتمادات', 'الاعتمادات', 'موافقات', 'للموافقة', 'معلقة عندي', 'بانتظار', 'pending approval', 'approvals waiting', 'to approve'])) {
        const { data: steps } = await supabaseAdmin.from('approvals').select('*').eq('status', 'pending');
        const mine = (steps || []).filter((s: any) => s.requested_by !== entity_id && canDecide(s.required_role || null, role_key, is_admin));
        // keep only the earliest-pending step per entity
        const seen = new Set<string>(); const actionable: any[] = [];
        mine.sort((a: any, b: any) => a.step_order - b.step_order).forEach((s: any) => { const k = s.entity_type + s.entity_id; if (!seen.has(k)) { seen.add(k); actionable.push(s); } });
        if (actionable.length === 0) return NextResponse.json({ reply: en ? 'You have no approvals waiting for your decision.' : 'لا توجد اعتمادات بانتظار قرارك حالياً.' });
        const lines = actionable.slice(0, 8).map((s: any) => `• ${s.title} (${s.entity_type}) — ${en ? 'from' : 'من'} ${s.requested_by_name || '—'}`).join('\n');
        return NextResponse.json({ reply: (en ? `You have ${actionable.length} approval(s) waiting:\n` : `عندك ${actionable.length} اعتماد بانتظار قرارك:\n`) + lines + (en ? '\nOpen the item to Approve/Reject.' : '\nافتح العنصر للاعتماد/الرفض.') });
    }

    // ── my submitted requests ──
    if (has(m, ['طلباتي', 'طلباتى', 'قدمتها', 'my requests', 'my submissions'])) {
        const { data: mine } = await supabaseAdmin.from('approvals').select('entity_type, status, requested_by').eq('requested_by', entity_id);
        if (!mine || mine.length === 0) return NextResponse.json({ reply: en ? 'You have not submitted any requests through the approval cycle yet.' : 'لم تُقدّم أي طلبات عبر دورة الاعتماد بعد.' });
        const byStatus: Record<string, number> = {};
        mine.forEach((s: any) => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
        const summary = Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(' · ');
        return NextResponse.json({ reply: (en ? 'Your request steps: ' : 'حالة خطوات طلباتك: ') + summary });
    }

    // ── my leave balance (linked by email) ──
    if (has(m, ['رصيد', 'اجازات', 'إجازات', 'اجازتي', 'إجازتي', 'leave balance', 'my leave'])) {
        const { data: emp } = await supabaseAdmin.from('employees').select('Name, LeaveBalance').eq('WorkEmail', email).maybeSingle();
        if (!emp) return NextResponse.json({ reply: en ? 'I couldn’t find an employee profile linked to your account (by work email).' : 'لم أجد ملف موظف مرتبط بحسابك (عن طريق بريد العمل).' });
        return NextResponse.json({ reply: en ? `Your remaining leave balance: ${emp.LeaveBalance ?? 0} days.` : `رصيد إجازاتك المتبقي: ${emp.LeaveBalance ?? 0} يوم.` });
    }

    // ── document / invoice status by number ──
    const docMatch = message.match(/ZE-[A-Z]+-\S+/i);
    if (docMatch && has(m, ['فاتورة', 'مستند', 'عرض', 'حالة', 'invoice', 'document', 'status', 'offer'])) {
        if (!canView('documents') && !canView('invoices')) return NextResponse.json({ reply: en ? 'You don’t have permission to view documents.' : 'ليس لديك صلاحية الاطلاع على المستندات.' });
        const { data: d } = await supabaseAdmin.from('documents').select('doc_number, doc_type, status, payment_status, approval_status, total').eq('doc_number', docMatch[0]).maybeSingle();
        if (!d) return NextResponse.json({ reply: en ? `No document found with number ${docMatch[0]}.` : `لا يوجد مستند بالرقم ${docMatch[0]}.` });
        return NextResponse.json({ reply: en
            ? `${d.doc_number}: type ${d.doc_type}, total ${Number(d.total || 0).toLocaleString()}, status ${d.status}, payment ${d.payment_status || '—'}, approval ${d.approval_status || '—'}.`
            : `${d.doc_number}: النوع ${d.doc_type}، الإجمالي ${Number(d.total || 0).toLocaleString()}، الحالة ${d.status}، الدفع ${d.payment_status || '—'}، الاعتماد ${d.approval_status || '—'}.` });
    }

    // ── what can I access ──
    if (has(m, ['صلاحياتي', 'صلاحيات', 'مسموح', 'permissions', 'what can i', 'access'])) {
        if (is_admin || (role_key || '').toLowerCase() === 'ceo') return NextResponse.json({ reply: en ? 'As CEO/Admin you have full access to all modules.' : 'بصفتك مدير تنفيذي/أدمن لديك صلاحية كاملة على كل الوحدات.' });
        const mods = (permRows || []).filter((p: any) => p.can_view).map((p: any) => p.module);
        return NextResponse.json({ reply: mods.length ? (en ? 'You can view: ' : 'تقدر تطّلع على: ') + mods.join(', ') : (en ? 'No module permissions are assigned to you yet — ask an administrator.' : 'لا توجد صلاحيات محددة لك بعد — راجع المسؤول.') });
    }

    // ── page how-to / navigation fallback ──
    for (const qa of GENERAL) if (has(m, qa.keys)) return NextResponse.json({ reply: en ? qa.en : qa.ar });
    return NextResponse.json({ reply: en
        ? 'I can help with: your pending approvals, your requests, your leave balance, a document’s status (give its number), and what you can access. I never approve/reject on your behalf.'
        : 'أقدر أساعدك في: الاعتمادات المعلقة عندك، طلباتك، رصيد إجازاتك، حالة مستند (ابعت رقمه)، وصلاحياتك. ولا أعتمد/أرفض نيابةً عنك.' });
}
