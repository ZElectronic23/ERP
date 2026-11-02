// Client self-service portal data — scoped to the SIGNED-IN client only (mapped by users.client_id,
// or by matching the account email to clients."E-Mail"). GET returns the client's invoices
// (paid vs outstanding), warranties, projects + current journey stage, and their requests/tickets.
// POST opens a new service/product request or a support ticket (optionally tied to a chosen item).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

async function myClient(entityId: string, email: string | null) {
    // Preferred: explicit link on the user account.
    const { data: u } = await supabaseAdmin.from('users').select('client_id').eq('entity_id', entityId).maybeSingle();
    if (u?.client_id) {
        const { data } = await supabaseAdmin.from('clients').select('ClientId, ClientName, "E-Mail"').eq('ClientId', u.client_id).maybeSingle();
        if (data) return data;
    }
    // Fallback: match by email.
    if (email) {
        const { data } = await supabaseAdmin.from('clients').select('ClientId, ClientName, "E-Mail"').eq('E-Mail', email).maybeSingle();
        if (data) return data;
    }
    return null;
}

export async function GET(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = await myClient(authed.profile.entity_id, authed.profile.email);
    if (!client) return NextResponse.json({ error: 'no_client', message: 'حسابك غير مرتبط بعميل. راجع الإدارة.' }, { status: 404 });
    const cid = client.ClientId;

    // Full invoice/warranty detail for one of THIS client's own documents.
    const invoiceId = new URL(request.url).searchParams.get('invoice');
    if (invoiceId) {
        const { data: doc } = await supabaseAdmin.from('documents')
            .select('id, doc_number, doc_type, doc_date, subtotal, total, payment_status, status, warranty_months, warranty_start, warranty_end, project_id')
            .eq('id', invoiceId).eq('client_id', cid).is('deleted_at', null).maybeSingle();
        if (!doc) return NextResponse.json({ error: 'not_found', message: 'الفاتورة غير موجودة.' }, { status: 404 });
        const { data: items } = await supabaseAdmin.from('document_items')
            .select('item_name, item_unit, category, quantity, unit_price, line_total, notes').eq('document_id', invoiceId).order('sort_order');
        return NextResponse.json({ invoice: doc, items: items || [], client: { name: client.ClientName } });
    }

    // Full editable profile (for the self-update form) + any pending update request.
    const [{ data: full }, { data: pendingUpd }] = await Promise.all([
        supabaseAdmin.from('clients').select('"ClientId","ClientName","Mobile No.","E-Mail","Address",commercial_reg_no,id_card_no,lat,lng,location_confirmed_at').eq('ClientId', cid).maybeSingle(),
        supabaseAdmin.from('client_update_requests').select('id, status, created_at').eq('client_id', cid).eq('status', 'pending').order('created_at', { ascending: false }).limit(1),
    ]);

    const [docsRes, projsRes, reqsRes] = await Promise.all([
        supabaseAdmin.from('documents')
            .select('id, doc_number, doc_type, doc_date, total, payment_status, status, approval_status, project_id, warranty_months, warranty_start, warranty_end')
            .eq('client_id', cid).is('deleted_at', null).order('doc_date', { ascending: false }),
        supabaseAdmin.from('projects').select('ProjectCode, ProjectName, Status, journey_stage').eq('ClientID', cid).is('deleted_at', null),
        supabaseAdmin.from('client_requests').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
    ]);

    const docs = docsRes.data || [];
    const invoices = docs.filter((d: any) => d.doc_type === 'IN');
    const isPaid = (d: any) => d.payment_status === 'paid';
    const outstanding = invoices.filter((d: any) => !isPaid(d));
    const outstandingTotal = outstanding.reduce((s: number, d: any) => s + (Number(d.total) || 0), 0);
    // Warranties: invoices that carry warranty info.
    const warranties = invoices
        .filter((d: any) => d.warranty_months || d.warranty_end)
        .map((d: any) => ({ id: d.id, doc_number: d.doc_number, months: d.warranty_months, start: d.warranty_start, end: d.warranty_end }));

    return NextResponse.json({
        client: { id: cid, name: client.ClientName },
        profile: {
            mobile: full?.['Mobile No.'] || '', email: full?.['E-Mail'] || '', address: full?.Address || '',
            commercial_reg_no: full?.commercial_reg_no || '', id_card_no: full?.id_card_no || '',
            lat: full?.lat ?? null, lng: full?.lng ?? null, location_confirmed_at: full?.location_confirmed_at || null,
        },
        pendingUpdate: (pendingUpd && pendingUpd.length) ? pendingUpd[0] : null,
        invoices: invoices.map((d: any) => ({
            id: d.id, doc_number: d.doc_number, doc_date: d.doc_date, total: d.total,
            payment_status: d.payment_status, paid: isPaid(d), project_id: d.project_id,
        })),
        outstanding: { count: outstanding.length, total: outstandingTotal },
        offers: docs.filter((d: any) => d.doc_type === 'OF').map((d: any) => ({ id: d.id, doc_number: d.doc_number, doc_date: d.doc_date, total: d.total, status: d.approval_status || d.status })),
        warranties,
        projects: (projsRes.data || []).map((p: any) => ({ code: p.ProjectCode, name: p.ProjectName, status: p.Status, stage: p.journey_stage })),
        requests: reqsRes.data || [],
    });
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = await myClient(authed.profile.entity_id, authed.profile.email);
    if (!client) return NextResponse.json({ error: 'no_client', message: 'حسابك غير مرتبط بعميل.' }, { status: 404 });

    const b = await request.json().catch(() => ({}));

    // Self-service data update → stored as a PENDING request; applied only after sales/PR review.
    if (b.action === 'profile_update') {
        const allowed = ['mobile', 'email', 'address', 'commercial_reg_no', 'id_card_no', 'lat', 'lng'];
        const changes: Record<string, any> = {};
        for (const k of allowed) if (b[k] !== undefined && b[k] !== null && b[k] !== '') changes[k] = b[k];
        if (Object.keys(changes).length === 0) return NextResponse.json({ error: 'no changes', message: 'لا توجد تغييرات.' }, { status: 400 });
        // one open request at a time
        const { data: existing } = await supabaseAdmin.from('client_update_requests').select('id').eq('client_id', client.ClientId).eq('status', 'pending').limit(1);
        if (existing && existing.length) return NextResponse.json({ error: 'pending_exists', message: 'لديك طلب تحديث قيد المراجعة بالفعل.' }, { status: 409 });
        const { error } = await supabaseAdmin.from('client_update_requests').insert({
            client_id: client.ClientId, changes, created_by: authed.profile.email || null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, message: 'تم إرسال طلب تحديث بياناتك للمراجعة. لن يُطبَّق إلا بعد اعتماد موظف المبيعات/العلاقات العامة.' });
    }

    const kind = ['service', 'product', 'support'].includes(b.kind) ? b.kind : 'support';
    const subject = (b.subject || '').toString().trim();
    if (!subject) return NextResponse.json({ error: 'subject required', message: 'اكتب موضوع الطلب.' }, { status: 400 });

    const { error } = await supabaseAdmin.from('client_requests').insert({
        client_id: client.ClientId, kind, subject,
        item_type: b.item_type || null, item_ref: b.item_ref || null, item_name: b.item_name || null,
        description: (b.description || '').toString() || null,
        created_by: authed.profile.email || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: kind === 'support' ? 'تم فتح تذكرة الدعم ✓' : 'تم إرسال طلبك ✓' });
}
