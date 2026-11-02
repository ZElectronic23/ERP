'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

interface Project {
    ProjectCode: string;
    ProjectName: string;
    ClientID: string | null;
    ProjectType: string | null;
    Status: string | null;
    PlanStatus: string | null;
    Budget: number | null;
    created_at: string;
    deleted_at: string | null;
}

const PLAN_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    draft: { ar: 'مسودة', en: 'Draft', cls: 'bg-gray-500/20 text-gray-300' },
    approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-500/20 text-green-400' },
    rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-500/20 text-red-400' },
};

export default function ProjectsPage() {
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', clientId: '', type: 'تركيب وتوريد' });

    const clientName = (id: string | null) => clients.find(c => c.ClientId === id)?.ClientName || '—';

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: projs }, { data: cls }] = await Promise.all([
            supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('clients').select('ClientId, ClientName').is('deleted_at', null),
        ]);
        setProjects((projs as Project[]) || []);
        setClients(cls || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const nextCode = async (): Promise<string> => {
        const { data } = await supabase.from('projects').select('ProjectCode').ilike('ProjectCode', 'PRJ-%').order('ProjectCode', { ascending: false }).limit(1);
        let n = 1;
        if (data && data.length) {
            const m = String(data[0].ProjectCode).match(/PRJ-(\d+)/);
            if (m) n = parseInt(m[1]) + 1;
        }
        return `PRJ-${n.toString().padStart(3, '0')}`;
    };

    const createProject = async () => {
        if (!form.name.trim()) return;
        setCreating(true);
        const code = await nextCode();
        const { error } = await supabase.from('projects').insert([{
            ProjectCode: code,
            ProjectName: form.name.trim(),
            ClientID: form.clientId || null,
            ProjectType: form.type || null,
            Status: 'planning',
            PlanStatus: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }]);
        setCreating(false);
        if (!error) {
            setShowCreate(false);
            setForm({ name: '', clientId: '', type: 'تركيب وتوريد' });
            router.push(`/${locale}/projects/${code}`);
        } else {
            alert(error.message);
        }
    };

    const softDelete = async (code: string) => {
        if (!confirm(L('نقل المشروع للمحذوفات؟', 'Move project to trash?'))) return;
        const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('ProjectCode', code);
        if (!error) load();
    };

    const field = 'w-full px-4 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold transition-all text-sm';

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('المشاريع', 'Projects')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L(`إجمالي ${projects.length} مشروع`, `${projects.length} projects`)}</p>
                    </div>
                    <button onClick={() => setShowCreate(true)} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">
                        {L('+ مشروع جديد', '+ New Project')}
                    </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '760px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الكود', 'Code'), L('اسم المشروع', 'Project'), L('العميل', 'Client'), L('النوع', 'Type'), L('الحالة', 'Status'), L('حالة الخطة', 'Plan'), L('الميزانية', 'Budget'), L('الإجراءات', 'Actions')].map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</td></tr>
                            ) : projects.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-10 text-[#C0C0C0]">{L('لا توجد مشاريع', 'No projects')}</td></tr>
                            ) : projects.map(p => {
                                const ps = PLAN_STATUS[p.PlanStatus || 'draft'] || PLAN_STATUS.draft;
                                return (
                                    <tr key={p.ProjectCode} className="odd:bg-white/[0.02] hover:bg-[#DBA935]/10 transition border-b border-[#3E3B3F]/60 text-white cursor-pointer"
                                        onClick={() => router.push(`/${locale}/projects/${p.ProjectCode}`)}>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium">{p.ProjectCode}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{p.ProjectName}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{clientName(p.ClientID)}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{p.ProjectType || '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{p.Status || '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs ${ps.cls}`}>{isAr ? ps.ar : ps.en}</span></td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">{p.Budget ? `${Number(p.Budget).toLocaleString()} ${L('ج.م', 'EGP')}` : '—'}</td>
                                        <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <span className="inline-flex items-center gap-3">
                                                <button onClick={() => router.push(`/${locale}/projects/${p.ProjectCode}`)} className="text-[#DBA935] hover:underline">{L('فتح', 'Open')}</button>
                                                <button onClick={() => softDelete(p.ProjectCode)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowCreate(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20">
                            <h2 className="text-lg font-alata text-gold">{L('مشروع جديد', 'New Project')}</h2>
                            <button onClick={() => setShowCreate(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-silver mb-1 text-sm">{L('اسم المشروع', 'Project name')}</label>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder={L('مثال: شبكة كاميرات فرع المعادي', 'e.g. CCTV network - Maadi branch')} />
                            </div>
                            <div>
                                <label className="block text-silver mb-1 text-sm">{L('العميل', 'Client')}</label>
                                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={field}>
                                    <option value="">{L('— بدون —', '— none —')}</option>
                                    {clients.map(c => <option key={c.ClientId} value={c.ClientId}>{c.ClientName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-silver mb-1 text-sm">{L('النوع', 'Type')}</label>
                                <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={createProject} disabled={creating || !form.name.trim()} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">
                                    {creating ? L('جارٍ الإنشاء...', 'Creating...') : L('إنشاء وبدء التخطيط', 'Create & plan')}
                                </button>
                                <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
