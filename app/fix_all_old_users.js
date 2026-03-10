// fix_all_old_users.js
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function isUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(value || '')
}

async function getAllAuthUsers() {
    const { data, error } = await supabase.auth.admin.listUsers()
    if (error) {
        console.error('Error listing auth users:', error)
        return []
    }
    return data.users
}

async function createAuthForOldUsers() {
    // 1. جلب جميع المستخدمين من جدول users
    const { data: dbUsers, error: dbError } = await supabase
        .from('users')
        .select('*')

    if (dbError) {
        console.error('❌ Error fetching users:', dbError)
        return
    }

    // 2. جلب جميع المستخدمين من Auth
    const authUsers = await getAllAuthUsers()
    const authEmails = new Set(authUsers.map(u => u.email))

    console.log(`📊 إجمالي المستخدمين في قاعدة البيانات: ${dbUsers.length}`)
    console.log(`📊 إجمالي المستخدمين في Auth: ${authUsers.length}`)

    let created = 0
    let skipped = 0
    let failed = 0

    for (const user of dbUsers) {
        // إذا كان entity_id بالفعل UUID، نتخطى
        if (isUUID(user.entity_id)) {
            console.log(`⏩ ${user.email} -> لديه UUID بالفعل (${user.entity_id})`)
            skipped++
            continue
        }

        // إذا كان البريد موجوداً في Auth، نقوم فقط بتحديث entity_id
        if (authEmails.has(user.email)) {
            console.log(`⚠️ ${user.email} موجود في Auth لكن entity_id نصي. جاري التحديث...`)
            const authUser = authUsers.find(u => u.email === user.email)
            if (authUser) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ entity_id: authUser.id })
                    .eq('email', user.email)

                if (updateError) {
                    console.error(`❌ فشل تحديث entity_id لـ ${user.email}:`, updateError.message)
                    failed++
                } else {
                    console.log(`✅ تم تحديث entity_id لـ ${user.email} -> ${authUser.id}`)
                    created++
                }
            }
            continue
        }

        // لم يتم العثور على البريد في Auth → ننشئ مستخدم جديد
        console.log(`🆕 إنشاء مستخدم Auth لـ ${user.email} (entity_id قديم: ${user.entity_id})`)

        const tempPassword = 'Temp@' + Math.random().toString(36).slice(-8) + 'A1!'

        const { data: newAuth, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                full_name: user.full_name || '',
                role: user.role_key || 'employee',
                is_admin: user.is_admin || false
            }
        })

        if (createError) {
            console.error(`❌ فشل إنشاء مستخدم Auth لـ ${user.email}:`, createError.message)
            failed++
            continue
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ entity_id: newAuth.user.id })
            .eq('email', user.email)

        if (updateError) {
            console.error(`❌ فشل تحديث entity_id لـ ${user.email}:`, updateError.message)
            await supabase.auth.admin.deleteUser(newAuth.user.id)
            failed++
        } else {
            console.log(`✅ تم إنشاء وتحديث ${user.email} -> ${newAuth.user.id}, كلمة المرور المؤقتة: ${tempPassword}`)
            created++
        }
    }

    console.log('\n📌 الملخص:')
    console.log(`   - تم إنشاء/تحديث: ${created}`)
    console.log(`   - تم التخطي (لديهم UUID): ${skipped}`)
    console.log(`   - فشل: ${failed}`)
}

createAuthForOldUsers().catch(console.error)