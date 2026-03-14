import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  console.log('========== SOFT DELETE API ==========')

  try {
    const body = await request.json()
    const { email, soft } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    if (soft) {
      // Soft delete - تعيين status = 'deleted'
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .select()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        user: data?.[0] || null,
        message: 'User moved to deleted'
      })
    } else {
      // Hard delete - حذف نهائي
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('email', email)

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'User permanently deleted'
      })
    }

  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}