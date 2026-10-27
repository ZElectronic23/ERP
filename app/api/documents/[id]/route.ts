// app/api/documents/[id]/route.ts — Get, Update, Delete single document
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GET /api/documents/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const { data: doc, error } = await supabase
      .from('documents')
      .select(`
        *,
        clients!documents_client_id_fkey ( id, name, phone, email, address, company_name ),
        employees!documents_assigned_employee_fkey ( id, name, role, phone ),
        users!documents_created_by_fkey ( id, full_name, email )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('document_items')
      .select('*')
      .eq('document_id', id)
      .order('sort_order');
    if (itemsError) throw itemsError;

    return NextResponse.json({ document: { ...doc, items: items || [] } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/documents/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { items, ...docData } = body;

    // Update document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .update({
        ...docData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (docError) throw docError;

    // Replace items if provided
    if (items !== undefined) {
      // Delete existing items
      await supabase.from('document_items').delete().eq('document_id', id);

      // Insert new items
      if (items.length > 0) {
        const docItems = items.map((item: any, idx: number) => ({
          document_id: id,
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
    }

    return NextResponse.json({ document: doc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/documents/[id] — soft delete (set status to cancelled)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const { error } = await supabase
      .from('documents')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
