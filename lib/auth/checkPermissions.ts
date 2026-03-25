import { supabaseAdmin } from '@/lib/supabase/admin';
import { User } from '@supabase/supabase-js';

export async function checkPermission(
    user: User,
    resource: string,
    action: string
): Promise<boolean> {
    // جلب دور المستخدم من جدول users (لدينا custom users)
    const { data: userData, error } = await supabaseAdmin
        .from('users')
        .select('role_key')
        .eq('id', user.id)
        .single();

    if (error || !userData) return false;

    const role = userData.role_key;

    // التحقق من الصلاحية في جدول permissions
    const { data: perm, error: permError } = await supabaseAdmin
        .from('permissions')
        .select('*')
        .eq('resource', resource)
        .eq('action', action)
        .contains('allowed_roles', [role])
        .maybeSingle();

    return !!perm;
}