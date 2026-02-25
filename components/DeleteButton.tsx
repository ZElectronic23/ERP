'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function DeleteButton({ productId }: { productId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
            setLoading(true);
            await supabase
                .from('products')
                .update({ deleted_at: new Date().toISOString() })
                .eq('product_id', productId);
            router.refresh();
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="px-2 py-1 bg-red-500/20 rounded-lg text-red-300 text-xs hover:bg-red-500 hover:text-white transition flex items-center justify-center gap-1 disabled:opacity-50"
        >
            <span className="material-icons text-xs">delete</span>
            {loading ? '...' : ''}
        </button>
    );
}