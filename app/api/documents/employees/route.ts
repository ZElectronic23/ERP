// app/api/documents/employees/route.ts — List employees for document assignment
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    let query = supabase
      .from('employees')
      .select('id, name, role, department, phone, email')
      .order('name');

    if (role && role !== 'any') {
      query = query.or(`role.ilike.%${role}%,department.ilike.%${role}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ employees: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
