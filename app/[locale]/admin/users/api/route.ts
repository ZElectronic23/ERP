import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // التحقق من عدم وجود البريد مسبقاً
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', body.email)
      .maybeSingle();
    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email address has already been registered' }, { status: 400 });
    }

    const { data: authUsers, error: authCheckError } = await supabaseAdmin.auth.admin.listUsers();
    if (!authCheckError) {
      const existingAuthUser = authUsers.users.find(u => u.email === body.email);
      if (existingAuthUser) {
        return NextResponse.json({ error: 'A user with this email address has already been registered in auth' }, { status: 400 });
      }
    }

    const password = body.password;
    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: body.user_metadata?.full_name || '',
        role: body.user_metadata?.role || 'employee',
        is_admin: body.user_metadata?.is_admin || false
      }
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        entity_id: authData.user.id,
        email: body.email,
        full_name: body.user_metadata?.full_name || '',
        role_key: body.user_metadata?.role || 'employee',
        is_admin: body.user_metadata?.is_admin || false,
        entity_type: body.entity_type || 'employee',
        password_hash: hashedPassword,
        profile_image: body.profile_image || null,
        language: body.language || 'ar',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({ user: userData, message: 'User created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error occurred' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('entity_id, profile_image')
      .eq('email', body.email)
      .single();
    if (fetchError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // حالة status
    if (action === 'status') {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('email', body.email);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ message: `Status updated to ${body.status}` });
    }

    // حالة delete (soft / hard)
    if (action === 'delete') {
      const soft = body.soft !== false;
      if (soft) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('email', body.email);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
        return NextResponse.json({ message: 'User moved to deleted' });
      } else {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.entity_id);
        if (authDeleteError) return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('email', body.email);
        if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
        return NextResponse.json({ message: 'User permanently deleted' });
      }
    }

    // حالة restore
    if (action === 'restore') {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('email', body.email);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ message: 'User restored' });
    }

    // تحديث بيانات المستخدم (بدون action)
    const metadata: any = {
      full_name: body.user_metadata?.full_name,
      role: body.user_metadata?.role,
      is_admin: body.user_metadata?.is_admin
    };
    await supabaseAdmin.auth.admin.updateUserById(user.entity_id, { user_metadata: metadata }).catch(e => console.error('Auth update error:', e));

    const updateData: any = {
      full_name: body.user_metadata?.full_name,
      role_key: body.user_metadata?.role,
      is_admin: body.user_metadata?.is_admin,
      entity_type: body.entity_type,
      updated_at: new Date().toISOString()
    };
    if (body.user_metadata?.profile_image !== undefined) updateData.profile_image = body.user_metadata.profile_image;

    const newPassword = body.password || body.user_metadata?.password;
    if (newPassword) {
      updateData.password_hash = await bcrypt.hash(newPassword, 12);
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.entity_id, { password: newPassword });
      if (authUpdateError) console.error('❌ Auth password update error:', authUpdateError);
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('email', body.email)
      .select()
      .single();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

    return NextResponse.json({ user: userData, message: 'User updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error occurred' }, { status: 500 });
  }
}