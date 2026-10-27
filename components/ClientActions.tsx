'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteButton({ clientId, locale }: { clientId: string; locale: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        const msg = locale === 'ar' ? 'نقل هذا العميل للمحذوفات؟' : 'Move this client to trash?';
        if (!confirm(msg)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/clients?action=soft-delete&clientId=${clientId}`, {
                method: 'PATCH',
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert(locale === 'ar' ? 'فشل الحذف' : 'Failed to delete');
            }
        } catch (error) {
            console.error(error);
            alert('Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="text-red-400 hover:text-red-300"
        >
            {loading ? '...' : (locale === 'ar' ? 'حذف' : 'Delete')}
        </button>
    );
}

export function PermanentDeleteButton({ clientId, locale }: { clientId: string; locale: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handlePermanentDelete = async () => {
        const msg = locale === 'ar'
            ? 'حذف نهائي لا يمكن التراجع عنه. متأكد؟'
            : 'Permanent delete cannot be undone. Are you sure?';
        if (!confirm(msg)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/clients?action=permanent-delete&clientId=${clientId}`, {
                method: 'PATCH',
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert(locale === 'ar' ? 'فشل الحذف النهائي (للمدير التنفيذي فقط)' : 'Permanent delete failed (CEO only)');
            }
        } catch (error) {
            console.error(error);
            alert('Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePermanentDelete}
            disabled={loading}
            className="text-red-700 hover:text-red-900 font-semibold ms-2"
        >
            {loading ? '...' : (locale === 'ar' ? 'حذف نهائي' : 'Delete forever')}
        </button>
    );
}

export function RestoreButton({ clientId, locale }: { clientId: string; locale: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleRestore = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/clients?action=restore&clientId=${clientId}`, {
                method: 'PATCH',
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert('Failed to restore');
            }
        } catch (error) {
            console.error(error);
            alert('Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleRestore}
            disabled={loading}
            className="text-green-400 hover:text-green-300"
        >
            {loading ? '...' : (locale === 'ar' ? 'استعادة' : 'Restore')}
        </button>
    );
}