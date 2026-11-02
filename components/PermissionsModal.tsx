'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const MODULES: { key: string; ar: string; en: string }[] = [
    { key: 'clients', ar: 'العملاء', en: 'Clients' },
    { key: 'documents', ar: 'المستندات', en: 'Documents' },
    { key: 'invoices', ar: 'الفواتير', en: 'Invoices' },
    { key: 'legal', ar: 'القانونية', en: 'Legal' },
    { key: 'projects', ar: 'المشاريع', en: 'Projects' },
    { key: 'maintenance', ar: 'الصيانة', en: 'Maintenance' },
    { key: 'products', ar: 'المنتجات والخدمات', en: 'Products' },
    { key: 'employees', ar: 'الموظفون', en: 'Employees' },
    { key: 'hr', ar: 'الحضور والإجازات', en: 'HR' },
    { key: 'payroll', ar: 'الرواتب', en: 'Payroll' },
    { key: 'evaluations', ar: 'التقييمات', en: 'Evaluations' },
    { key: 'accounting', ar: 'الحسابات', en: 'Accounting' },
    { key: 'partners', ar: 'الشركاء', en: 'Partners' },
    { key: 'users', ar: 'المستخدمون', en: 'Users' },
];
type Perm = { can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean };
const EMPTY: Perm = { can_view: false, can_add: false, can_edit: false, can_delete: false };

export default function PermissionsModal({ userId, userName, locale = 'ar', onClose }: { userId: string; userName: string; locale?: string; onClose: () => void }) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [perms, setPerms] = useState<Record<string, Perm>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('user_permissions').select('*').eq('user_id', userId);
            const map: Record<string, Perm> = {};
            (data || []).forEach((r: any) => { map[r.module] = { can_view: r.can_view, can_add: r.can_add, can_edit: r.can_edit, can_delete: r.can_delete }; });
            setPerms(map); setLoading(false);
        })();
    }, [userId]);

    const get = (m: string): Perm => perms[m] || EMPTY;
    const toggle = (m: string, k: keyof Perm) => setPerms(p => {
        const cur = p[m] || { ...EMPTY };
        const next = { ...cur, [k]: !cur[k] };
        if (k !== 'can_view' && next[k]) next.can_view = true; // any action implies view
        return { ...p, [m]: next };
    });
    const setAll = (m: string, val: boolean) => setPerms(p => ({ ...p, [m]: { can_view: val, can_add: val, can_edit: val, can_delete: val } }));

    const save = async () => {
        setSaving(true); setMsg('');
        const rows = MODULES.map(m => ({ user_id: userId, module: m.key, ...get(m.key), updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,module' });
        setSaving(false); setMsg(error ? error.message : L('تم حفظ الصلاحيات ✓', 'Permissions saved ✓'));
    };

    const cb = (checked: boolean, on: () => void) => (
        <input type="checkbox" checked={checked} onChange={on} className="accent-[#DBA935] w-4 h-4 cursor-pointer" />
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start p-5 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                    <div>
                        <h2 className="text-lg font-alata text-gold">{L('صلاحيات المستخدم', 'User Permissions')}</h2>
                        <p className="text-silver/70 text-xs mt-0.5">{userName}</p>
                    </div>
                    <button onClick={onClose} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                </div>
                {loading ? <div className="p-8 text-center text-silver">{L('جارٍ التحميل...', 'Loading...')}</div> : (
                    <div className="p-5">
                        <p className="text-silver/60 text-[11px] mb-3">{L('حدّد ما يستطيع المستخدم فعله في كل شاشة. «اطلاع» يعني يشوف فقط.', 'Set what the user can do per screen. "View" = read-only.')}</p>
                        <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                            <table className="w-full text-sm" style={{ minWidth: '520px' }}>
                                <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                    {[L('الشاشة', 'Screen'), L('اطلاع', 'View'), L('إضافة', 'Add'), L('تعديل', 'Edit'), L('حذف', 'Delete'), L('الكل', 'All')].map((h, i) => <th key={i} className="py-2 px-3 text-center font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {MODULES.map(m => {
                                        const p = get(m.key);
                                        const all = p.can_view && p.can_add && p.can_edit && p.can_delete;
                                        return (
                                            <tr key={m.key} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                <td className="py-1.5 px-3 whitespace-nowrap">{isAr ? m.ar : m.en}</td>
                                                <td className="py-1.5 px-3 text-center">{cb(p.can_view, () => toggle(m.key, 'can_view'))}</td>
                                                <td className="py-1.5 px-3 text-center">{cb(p.can_add, () => toggle(m.key, 'can_add'))}</td>
                                                <td className="py-1.5 px-3 text-center">{cb(p.can_edit, () => toggle(m.key, 'can_edit'))}</td>
                                                <td className="py-1.5 px-3 text-center">{cb(p.can_delete, () => toggle(m.key, 'can_delete'))}</td>
                                                <td className="py-1.5 px-3 text-center">{cb(all, () => setAll(m.key, !all))}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {msg && <div className="mt-3 text-sm text-gold">{msg}</div>}
                        <div className="flex gap-3 pt-4">
                            <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ الصلاحيات', 'Save permissions')}</button>
                            <button onClick={onClose} className="px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إغلاق', 'Close')}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
