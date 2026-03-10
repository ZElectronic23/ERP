// seed_users_final.js
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// البيانات المصححة (من الـ JSON الذي أرسلته مع تحديث كلمات المرور النصية)
const usersData = [
    // المستخدمون الجدد (لديهم بالفعل UUID)
    { email: 'g@f.n', password: '12345678', full_name: 'g', role_key: 'employee', entity_type: 'employee', is_admin: false, profile_image: 'https://zgvdroiqiyaekciscjtd.supabase.co/storage/v1/object/public/avatars/avatars/ee3968f2-5eea-4b8e-b192-d0631b4b2866.png', user_code: 'User-0001' },
    { email: 'mz@z.z', password: '12345678', full_name: 'z', role_key: 'employee', entity_type: 'employee', is_admin: false, profile_image: 'https://zgvdroiqiyaekciscjtd.supabase.co/storage/v1/object/public/avatars/avatars/60a5f153-7161-4b47-92c7-13680bfb56da.png', user_code: 'User-0002' },
    { email: 'me@me.me', password: '12345678', full_name: 'me', role_key: 'employee', entity_type: 'employee', is_admin: false, profile_image: null, user_code: 'User-0003' },
    { email: 'mo@no.as', password: '12345678', full_name: 'حماصه', role_key: 'investor', entity_type: 'partner', is_admin: true, profile_image: null, user_code: 'User-0013' },

    // المستخدمون القدامى (نحتاج لتحديث كلمات المرور إلى مشفرة)
    { email: 'ahmed.ali@zelectronic.com', password: 'ahmed123', full_name: 'أحمد علي', role_key: 'Technician', entity_type: 'employee', is_admin: false, profile_image: 'https://zgvdroiqiyaekciscjtd.supabase.co/storage/v1/object/public/avatars/avatars/6283d29d-c2f1-4bea-b5ca-13ed68b94823.jpg', user_code: 'User-0004' },
    { email: 'mahmoud9zidan9@gmail.com', password: 'mahmoud123', full_name: 'محمد حسن', role_key: 'PM', entity_type: 'employee', is_admin: false, profile_image: null, user_code: 'User-0005' },
    { email: 'finance@zelectronic.com', password: 'finance123', full_name: 'سارة عبد الله', role_key: 'Finance', entity_type: 'employee', is_admin: false, profile_image: null, user_code: 'User-0006' },
    { email: 'fatma@company.com', password: 'fatma123', full_name: 'فاطمة كمال', role_key: 'CRM', entity_type: 'employee', is_admin: false, profile_image: null, user_code: 'User-0007' },
    { email: 'ahmed@company.com', password: 'ahmed123', full_name: 'أحمد يوسف', role_key: 'HRD', entity_type: 'employee', is_admin: false, profile_image: null, user_code: 'User-0008' },
    { email: 'z.electronic23@gmail.com', password: 'zelectronic', full_name: 'محمود زيدان', role_key: 'CEO', entity_type: 'partner', is_admin: true, profile_image: 'https://github.com/ZElectronic23/Dashboard/blob/c09ae69e29a6683f32a1d8a72cb0ceb351fdd180/assets/mahmoudzidan.jpg?raw=true', user_code: 'User-0009' },
    { email: 'karim.partner@zelectronic.com', password: 'karim123', full_name: 'كريم محمود lpl', role_key: 'TechPartner', entity_type: 'partner', is_admin: false, profile_image: null, user_code: 'User-0010' },
    { email: 'emad@lifetimecode.com', password: 'emad123', full_name: 'م/عماد محمد ي', role_key: 'TechPartner', entity_type: 'partner', is_admin: false, profile_image: null, user_code: 'User-0011' },
    { email: 'shereef@dineco.com', password: 'shereef123', full_name: 'شركة شريف أبو زيد', role_key: 'TechPartner', entity_type: 'partner', is_admin: false, profile_image: null, user_code: 'User-0012' }
];

// صلاحيات view/edit من البيانات الأصلية
const viewAccessMap = {
    'Technician': ['Tasks', 'Products', 'Clients'],
    'PM': ['Projects', 'Tasks', 'Expenses', 'Invoices', 'Clients'],
    'Finance': ['Invoices', 'Expenses', 'CashAdvance', 'Profit_Summary', 'PartnerTransactions'],
    'CRM': ['Clients', 'FollowUp', 'ClientFeedback', 'Invoices'],
    'HRD': ['Employees', 'JobApplications', 'Evaluation', 'TrainingNeeds', 'Leaves'],
    'CEO': ['Projects', 'Employees', 'Clients', 'Invoices', 'Evaluation', 'Profit_Summary'],
    'TechPartner': ['AssignedProjects', 'Tasks', 'Products']
};

const editAccessMap = {
    'Technician': ['Tasks'],
    'PM': ['Projects', 'Tasks', 'Expenses'],
    'Finance': ['Invoices', 'Expenses', 'CashAdvance'],
    'CRM': ['FollowUp', 'ClientFeedback'],
    'HRD': ['Employees', 'JobApplications', 'Evaluation'],
    'CEO': [],
    'TechPartner': ['Tasks']
};

async function seedUsers() {
    console.log('🚀 بدء عملية إنشاء المستخدمين...\n')

    for (const [index, user] of usersData.entries()) {
        console.log(`⏳ معالجة ${index + 1}/${usersData.length}: ${user.email}`)

        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(user.password, 12)

        // إنشاء المستخدم في Auth
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: {
                full_name: user.full_name,
                role: user.role_key,
                is_admin: user.is_admin
            }
        })

        if (createError) {
            // إذا كان المستخدم موجوداً بالفعل، نأخذ معرفه
            if (createError.message.includes('already exists')) {
                console.log(`⚠️  ${user.email} موجود مسبقاً، جلب معرفه...`)
                const { data: existing } = await supabase.auth.admin.listUsers()
                const found = existing.users.find(u => u.email === user.email)
                if (found) {
                    await supabase
                        .from('users')
                        .insert([{
                            entity_id: found.id,
                            email: user.email,
                            password_hash: hashedPassword,
                            full_name: user.full_name,
                            role_key: user.role_key,
                            entity_type: user.entity_type,
                            is_admin: user.is_admin,
                            profile_image: user.profile_image,
                            user_code: user.user_code,
                            view_access: viewAccessMap[user.role_key] || null,
                            edit_access: editAccessMap[user.role_key] || null,
                            status: 'active'
                        }])
                        .then(() => console.log(`✅ ${user.email} تم إدراجه في جدول users (باستخدام UUID موجود)`))
                        .catch(err => console.error(`❌ فشل إدراج ${user.email}:`, err.message))
                }
            } else {
                console.error(`❌ فشل إنشاء ${user.email}:`, createError.message)
            }
            continue
        }

        // إدراج المستخدم في جدول users
        const { error: insertError } = await supabase
            .from('users')
            .insert([{
                entity_id: authUser.user.id,
                email: user.email,
                password_hash: hashedPassword,
                full_name: user.full_name,
                role_key: user.role_key,
                entity_type: user.entity_type,
                is_admin: user.is_admin,
                profile_image: user.profile_image,
                user_code: user.user_code,
                view_access: viewAccessMap[user.role_key] || null,
                edit_access: editAccessMap[user.role_key] || null,
                status: 'active'
            }])

        if (insertError) {
            console.error(`❌ فشل إدراج ${user.email} في جدول users:`, insertError.message)
            // حذف مستخدم Auth إذا فشل الإدراج
            await supabase.auth.admin.deleteUser(authUser.user.id)
        } else {
            console.log(`✅ ${user.email} -> تم بنجاح (UUID: ${authUser.user.id})`)
        }
    }

    console.log('\n🎉 تم الانتهاء من معالجة جميع المستخدمين.')
}

seedUsers().catch(console.error)