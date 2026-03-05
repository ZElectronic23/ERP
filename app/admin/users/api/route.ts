import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET() {
  console.log('========== Admin API GET called ==========')

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching users:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ users })

  } catch (error: any) {
    console.error('❌ Error in GET handler:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('POST request body:', { ...body, password: '***' })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // التحقق من عدم وجود البريد مسبقاً
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', body.email)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email address has already been registered' },
        { status: 400 }
      )
    }

    // التحقق من عدم وجود البريد في auth.users
    const { data: authUsers, error: authCheckError } = await supabaseAdmin.auth.admin.listUsers()

    if (!authCheckError) {
      const existingAuthUser = authUsers.users.find(u => u.email === body.email)
      if (existingAuthUser) {
        return NextResponse.json(
          { error: 'A user with this email address has already been registered in auth' },
          { status: 400 }
        )
      }
    }

    // تشفير كلمة المرور
    const password = body.password
    const hashedPassword = await bcrypt.hash(password, 12)

    // إنشاء المستخدم في auth.users أولاً
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: body.user_metadata?.full_name || '',
        role: body.user_metadata?.role || 'employee',
        is_admin: body.user_metadata?.is_admin || false
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      )
    }

    // إنشاء المستخدم في public.users مع status = 'active'
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
      .single()

    if (userError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: userData,
      message: 'User created successfully'
    })

  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    console.log('PATCH request body:', body)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // الحصول على user_id من public.users
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('entity_id, profile_image')
      .eq('email', body.email)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // تحديث metadata في auth
    const metadata: any = {
      full_name: body.user_metadata?.full_name,
      role: body.user_metadata?.role,
      is_admin: body.user_metadata?.is_admin
    }

    await supabaseAdmin.auth.admin.updateUserById(
      user.entity_id,
      { user_metadata: metadata }
    ).catch(e => console.error('Auth update error:', e))

    // تحضير بيانات التحديث
    const updateData: any = {
      full_name: body.user_metadata?.full_name,
      role_key: body.user_metadata?.role,
      is_admin: body.user_metadata?.is_admin,
      entity_type: body.entity_type,
      updated_at: new Date().toISOString()
    }

    if (body.user_metadata?.profile_image !== undefined) {
      updateData.profile_image = body.user_metadata.profile_image
    }

    if (body.user_metadata?.password) {
      updateData.password_hash = await bcrypt.hash(body.user_metadata.password, 12)
      await supabaseAdmin.auth.admin.updateUserById(
        user.entity_id,
        { password: body.user_metadata.password }
      ).catch(e => console.error('Auth password update error:', e))
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('email', body.email)
      .select()
      .single()

    if (userError) {
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: userData,
      message: 'User updated successfully'
    })

  } catch (error: any) {
    console.error('PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' },
      { status: 500 }
    )
  }
}