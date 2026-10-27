// app/api/documents/route.ts — List & Create documents
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/documents?type=OF&status=draft&page=1&limit=20
export async function GET(req: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('documents')
      .select(`
        *,
        clients!documents_client_id_fkey ( id, name, phone, email ),
        employees!documents_assigned_employee_fkey ( id, name ),
        users!documents_created_by_fkey ( id, full_name, email )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const showDeleted = searchParams.get('deleted') === 'true';
    query = showDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

    if (docType) query = query.eq('doc_type', docType);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`doc_number.ilike.%${search}%,notes.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      documents: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/documents — Create new document with auto-number
export async function POST(req: NextRequest) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { items, ...docData } = body;

    // 1. Get next document number via DB function
    const { data: numData, error: numError } = await supabase.rpc('next_doc_number', {
      p_type: docData.doc_type,
    });
    if (numError) throw numError;
    const docNumber = numData;

    // 2. Insert document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        ...docData,
        doc_number: docNumber,
        linked_doc_ids: docData.linked_doc_ids || [],
      })
      .select()
      .single();
    if (docError) throw docError;

    // 3. Insert items if any
    if (items && items.length > 0) {
      const docItems = items.map((item: any, idx: number) => ({
        document_id: doc.id,
        sort_order: idx + 1,
        item_type: item.itemType || item.item_type || 'custom',
        item_id: item.itemId || item.item_id || null,
        item_name: item.itemName || item.item_name,
        item_unit: item.itemUnit || item.item_unit || '',
        category: item.category || '',
        quantity: item.quantity,
        unit_price: item.unitPrice || item.unit_price,
        floor_price: item.floorPrice || item.floor_price || 0,
        target_price: item.targetPrice || item.target_price || 0,
        discount_pct: item.discountPct || item.discount_pct || 0,
        discount_amount: item.discountAmount || item.discount_amount || 0,
        line_total: item.lineTotal || item.line_total || 0,
        condition: item.condition || null,
        action_taken: item.actionTaken || item.action_taken || null,
        notes: item.notes || null,
      }));

      const { error: itemError } = await supabase
        .from('document_items')
        .insert(docItems);
      if (itemError) throw itemError;
    }

    return NextResponse.json({ document: doc, doc_number: docNumber }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
