import { supabaseAdmin } from '@/lib/supabase/admin';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE' | 'PERMANENT_DELETE';

export async function logAudit({
    tableName,
    recordId,
    action,
    oldData = null,
    newData = null,
    userId,
}: {
    tableName: string;
    recordId: number | string;
    action: AuditAction;
    oldData?: any;
    newData?: any;
    userId: string;
}) {
    const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert({
            table_name: tableName,
            record_id: recordId,
            action,
            old_data: oldData,
            new_data: newData,
            user_id: userId,
            happened_at: new Date().toISOString(),
        });

    if (error) {
        console.error('Audit log failed:', error);
        // لا نرمي الخطأ حتى لا يؤثر على العملية الرئيسية
    }
}