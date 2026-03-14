// lib/notifications.ts
import { supabaseAdmin } from './supabaseAdmin'; // تحتاج إلى تهيئة supabase مع service role key

export async function createNotification({
    userId,
    title,
    message,
    type = 'info',
    link,
}: {
    userId: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    link?: string;
}) {
    const { error } = await supabaseAdmin
        .from('notifications')
        .insert([{ user_id: userId, title, message, type, link }]);

    if (error) console.error('Error creating notification:', error);
    return !error;
}