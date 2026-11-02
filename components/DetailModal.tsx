'use client';

import { useEffect } from 'react';

export interface DetailRow {
    label: string;
    value: React.ReactNode;
    full?: boolean;   // span both columns
}

interface Props {
    title: string;
    subtitle?: string;
    rows: DetailRow[];
    onClose: () => void;
    locale?: string;
    children?: React.ReactNode;   // extra content (e.g. a lines table)
}

// Reusable read-only detail popup for any table row.
export default function DetailModal({ title, subtitle, rows, onClose, locale = 'ar', children }: Props) {
    const isAr = locale === 'ar';
    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                    <div>
                        <h2 className="text-lg font-alata text-gold">{title}</h2>
                        {subtitle && <p className="text-silver/70 text-xs mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                </div>
                <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        {rows.map((r, i) => (
                            <div key={i} className={r.full ? 'sm:col-span-2' : ''}>
                                <p className="text-silver/60 text-[11px] mb-0.5">{r.label}</p>
                                <div className="text-white text-sm break-words">{r.value ?? '—'}</div>
                            </div>
                        ))}
                    </div>
                    {children && <div className="mt-4">{children}</div>}
                </div>
            </div>
        </div>
    );
}
