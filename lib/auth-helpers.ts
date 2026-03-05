import { supabase } from './supabaseClient'

// دالة لإنشاء مستخدم جديد في Auth
export const createAuthUser = async (email: string, password: string, userData: any) => {
    try {
        // 1. إنشاء المستخدم في auth.users باستخدام Admin API
        const { data, error } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // تأكيد البريد تلقائياً
            user_metadata: {
                full_name: userData.full_name,
                role: userData.role_key,
                is_admin: userData.is_admin || false
            }
        })

        if (error) throw error

        // 2. ربط user_id مع public.users
        if (data.user) {
            const { error: updateError } = await supabase
                .from('users')
                .update({ entity_id: data.user.id })
                .eq('email', email)

            if (updateError) console.error('Error updating user entity_id:', updateError)
        }

        return { success: true, user: data.user }
    } catch (error) {
        console.error('Error creating auth user:', error)
        return { success: false, error }
    }
}

// دالة لتحديث مستخدم في Auth
export const updateAuthUser = async (userId: string, updates: any) => {
    try {
        const { data, error } = await supabase.auth.admin.updateUserById(
            userId,
            {
                email: updates.email,
                password: updates.password,
                user_metadata: updates.user_metadata
            }
        )

        if (error) throw error
        return { success: true, user: data.user }
    } catch (error) {
        console.error('Error updating auth user:', error)
        return { success: false, error }
    }
}

// دالة لحذف مستخدم من Auth
export const deleteAuthUser = async (userId: string) => {
    try {
        const { error } = await supabase.auth.admin.deleteUser(userId)
        if (error) throw error
        return { success: true }
    } catch (error) {
        console.error('Error deleting auth user:', error)
        return { success: false, error }
    }
}

// دالة لترحيل كل المستخدمين من public.users إلى auth.users
export const migrateAllUsersToAuth = async () => {
    try {
        // 1. جلب كل المستخدمين من public.users
        const { data: users, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .is('entity_id', null) // فقط اللي معندهمش entity_id

        if (fetchError) throw fetchError

        const results = []

        // 2. لكل مستخدم، أنشئه في auth
        for (const user of users) {
            // كلمة مرور افتراضية 0000
            const defaultPassword = '0000'

            const result = await createAuthUser(user.email, defaultPassword, user)
            results.push({
                email: user.email,
                success: result.success,
                error: result.error
            })
        }

        return { success: true, results }
    } catch (error) {
        console.error('Error migrating users:', error)
        return { success: false, error }
    }
}