import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    console.log('========== STATUS UPDATE API ==========')

    try {
        const body = await request.json()
        const { email, status } = body

        if (!email || !status) {
            return NextResponse.json(
                { error: 'Email and status are required' },
                { status: 400 }
            )
        }

        if (!['active', 'inactive', 'deleted'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status value' },
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

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq('email', email)
            .select()

        if (error) {
            console.error('Status update error:', error)
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            user: data?.[0] || null,
            message: `User status updated to ${status}`
        })

    } catch (error: any) {
        console.error('Status update error:', error)
        return NextResponse.json(
            { error: error.message || 'Unknown error' },
            { status: 500 }
        )
    }
}