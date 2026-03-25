// lib/utils.ts
export function formatDate(dateString: string | null, locale: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}