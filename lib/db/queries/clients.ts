import { supabaseAdmin } from '@/lib/supabase/admin';

// تعريف النوع بناءً على الجدول الفعلي
export type Client = {
    ClientId: string;
    ClientName: string;
    'Mobile No.': string | null;
    'E-Mail': string | null;
    Address: string | null;
    DisReason: string | null;
    DisValue: number | null;
    'Client Type': string | null;
    FollowUpFrequency: string | null;
    LastFollowUpDate: string | null; // تاريخ بصيغة ISO
    NextFollowUpDate: string | null;
    FollowUpMethod: string | null;
    client_kind: string | null; // actual | potential
    notes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type NewClient = {
    ClientId?: string; // يمكن توليده تلقائياً أو يدوياً
    ClientName: string;
    'Mobile No.'?: string | null;
    'E-Mail'?: string | null;
    Address?: string | null;
    DisReason?: string | null;
    DisValue?: number | null;
    'Client Type'?: string | null;
    FollowUpFrequency?: string | null;
    LastFollowUpDate?: string | null;
    NextFollowUpDate?: string | null;
    FollowUpMethod?: string | null;
    client_kind?: string | null;
    notes?: string | null;
};

export type UpdateClient = Partial<NewClient>;

// دالة مساعدة للتعامل مع الأعمدة ذات الأسماء الخاصة
function formatColumnName(col: string): string {
    // الأعمدة التي تحتوي مسافات أو علامات تحتاج إلى اقتباس مزدوج في الاستعلام
    // لكن supabase تتعامل تلقائياً إذا استخدمنا أسماء الأعمدة كخواص كائن
    return col;
}

export async function getClients({
    includeDeleted = false,
    page = 1,
    limit = 50,
    search = '',
    kind = '',
}: {
    includeDeleted?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    kind?: string;
} = {}) {
    let query = supabaseAdmin
        .from('clients')
        .select('*', { count: 'exact' });

    if (!includeDeleted) {
        query = query.is('deleted_at', null);
    }

    if (kind === 'actual' || kind === 'potential') {
        query = query.eq('client_kind', kind);
    }

    if (search) {
        // البحث في ClientName و E-Mail و Mobile No.
        query = query.or(
            `ClientName.ilike.%${search}%,"E-Mail".ilike.%${search}%,"Mobile No.".ilike.%${search}%`
        );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) throw error;
    return { data: data as Client[], count };
}

export async function getClientById(clientId: string, includeDeleted = false) {
    let query = supabaseAdmin
        .from('clients')
        .select('*')
        .eq('ClientId', clientId);

    if (!includeDeleted) {
        query = query.is('deleted_at', null);
    }

    const { data, error } = await query.single();
    if (error) throw error;
    return data as Client;
}

// دالة لتوليد ClientId تلقائي (اختياري)
export async function generateClientId(): Promise<string> {
    // الحصول على آخر ClientId
    const { data, error } = await supabaseAdmin
        .from('clients')
        .select('ClientId')
        .order('ClientId', { ascending: false })
        .limit(1);

    if (error) throw error;

    let nextNumber = 1;
    if (data && data.length > 0) {
        const lastId = data[0].ClientId;
        const match = lastId.match(/^CLT-(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }
    return `CLT-${nextNumber.toString().padStart(3, '0')}`;
}

export async function createClient(client: NewClient, userId: string) {
    // إذا لم يتم توفير ClientId، قم بتوليده
    if (!client.ClientId) {
        client.ClientId = await generateClientId();
    }

    const { data, error } = await supabaseAdmin
        .from('clients')
        .insert({
            ...client,
            created_by: userId, // تأكد من وجود هذا العمود، إذا لم يكن موجوداً يمكن إضافته أو تجاهله
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw error;
    return data as Client;
}

// Only these columns may be set through an update — blocks mass assignment of the primary key
// and system columns (ClientId / created_at / updated_at / deleted_at) from the request body.
const CLIENT_EDITABLE: (keyof NewClient)[] = [
    'ClientName', 'Mobile No.', 'E-Mail', 'Address', 'DisReason', 'DisValue', 'Client Type',
    'FollowUpFrequency', 'LastFollowUpDate', 'NextFollowUpDate', 'FollowUpMethod', 'client_kind', 'notes',
];

export async function updateClient(clientId: string, updates: UpdateClient) {
    const safe: Record<string, any> = {};
    for (const k of CLIENT_EDITABLE) if (k in (updates as any)) safe[k as string] = (updates as any)[k];
    const { data, error } = await supabaseAdmin
        .from('clients')
        .update({
            ...safe,
            updated_at: new Date().toISOString(),
        })
        .eq('ClientId', clientId)
        .select()
        .single();

    if (error) throw error;
    return data as Client;
}

export async function softDeleteClient(clientId: string) {
    const { data, error } = await supabaseAdmin
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('ClientId', clientId)
        .select()
        .single();

    if (error) throw error;
    return data as Client;
}

export async function restoreClient(clientId: string) {
    const { data, error } = await supabaseAdmin
        .from('clients')
        .update({ deleted_at: null })
        .eq('ClientId', clientId)
        .select()
        .single();

    if (error) throw error;
    return data as Client;
}

export async function permanentDeleteClient(clientId: string) {
    const { error } = await supabaseAdmin
        .from('clients')
        .delete()
        .eq('ClientId', clientId);

    if (error) throw error;
}