'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteButton({ clientId, locale }: { clientId: string; locale: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this client?')) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/clients?action=soft-delete&clientId=${clientId}`, {
                method: 'PATCH',
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert('Failed to delete');
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
            className="text-red-600 hover:text-red-900"
        >
            {loading ? '...' : 'Delete'}
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
            className="text-green-600 hover:text-green-900"
        >
            {loading ? '...' : 'Restore'}
        </button>
    );
}