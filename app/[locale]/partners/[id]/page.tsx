'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';

export default function PartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [partner, setPartner] = useState<any>(null);
    const [links, setLinks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: p }, { data: lk }] = await Promise.all([
            supabase.from('partners').select('*').eq('PartnerID', id).maybeSingle(),
            supabase.from('project_partners').select('*').eq('partner_id', id),
        ]);
        setPartner(p);
        setLinks(lk || []);
        const codes = (lk || []).map((x: any) => x.project_code);
        if (codes.length) {
            const { data: prj } = await supabase.from('projects').select('ProjectCode, ProjectName, Status, PlanStatus, Budget').in('ProjectCode', codes);
            setProjects(prj || []);
        } else setProjects([]);
        setLoading(false);
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const money = (n: number) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${L('ج.م', 'EGP')}`;
    const proj = (code: string) => projects.find(p => p.ProjectCode === code);
    const totalShareValue = links.reduce((s, l) => { const pr = proj(l.project_code); return s + (Number(pr?.Budget) || 0) * (Number(l.share_pct) || 0) / 100; }, 0);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (!partner) return <div className="min-h-screen flex items-center justify-center text-silver" dir={isAr ? 'rtl' : 'ltr'}>{L('الشريك غير موجود', 'Partner not found')}</div>;

    const types = [partner.IsFinancialPartner && L('شريك مالي', 'Financial'), partner.IsTechnicalPartner && L('شريك فني', 'Technical')].filter(Boolean).join(' · ') || (partner.Type || '');

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20">
                    <button onClick={() => router.push(`/${locale}/partners`)} className="text-[#DBA935] text-xs hover:underline">← {L('الشركاء', 'Partners')}</button>
                    <h1 className="text-2xl font-bold text-[#DBA935] mt-1">{partner.PartnerName}</h1>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-[#C0C0C0]">
                        {partner.CompanyName && <span>{partner.CompanyName}</span>}
                        {types && <span className="text-[#DBA935]">{types}</span>}
                        {partner.SharePercentage && <span>{L('نسبة عامة', 'Default share')}: {partner.SharePercentage}%</span>}
                        {partner.PartnerEmail && <span dir="ltr">✉ {partner.PartnerEmail}</span>}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-black/30 rounded-2xl border border-[#DBA935]/20 p-4"><p className="text-[#C0C0C0] text-xs mb-1">{L('عدد المشاريع', 'Projects')}</p><p className="text-xl font-bold text-[#DBA935]">{links.length}</p></div>
                    <div className="bg-black/30 rounded-2xl border border-[#DBA935]/20 p-4"><p className="text-[#C0C0C0] text-xs mb-1">{L('قيمة نصيبه التقديري', 'Estimated share value')}</p><p className="text-xl font-bold text-green-400">{money(totalShareValue)}</p></div>
                    <div className="bg-black/30 rounded-2xl border border-[#DBA935]/20 p-4"><p className="text-[#C0C0C0] text-xs mb-1">{L('الحالة', 'Status')}</p><p className="text-xl font-bold text-[#DBA935]">{partner.IsActive ? L('نشط', 'Active') : L('غير نشط', 'Inactive')}</p></div>
                </div>

                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl border border-[#DBA935]/20">
                    <h2 className="text-[#DBA935] font-bold mb-3">{L('المشاريع المرتبطة بالشريك ونسبته فيها', 'Linked projects & shares')}</h2>
                    <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                        <table className="w-full text-sm" style={{ minWidth: '680px' }}>
                            <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('المشروع', 'Project'), L('الدور', 'Role'), L('النسبة %', 'Share %'), L('الميزانية', 'Budget'), L('نصيبه', 'His share'), L('حالة المشروع', 'Project status'), ''].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {links.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-[#C0C0C0]">{L('غير مرتبط بأي مشروع بعد', 'Not linked to any project yet')}</td></tr>
                                    : links.map(l => {
                                        const pr = proj(l.project_code);
                                        const share = (Number(pr?.Budget) || 0) * (Number(l.share_pct) || 0) / 100;
                                        return (
                                            <tr key={l.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white hover:bg-[#DBA935]/10">
                                                <td className="py-2 px-3 whitespace-nowrap text-[#DBA935]">{pr?.ProjectName || l.project_code}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{l.role || '—'}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{l.share_pct || 0}%</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{pr?.Budget ? money(pr.Budget) : '—'}</td>
                                                <td className="py-2 px-3 whitespace-nowrap text-green-400">{money(share)}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{pr?.Status || '—'}</td>
                                                <td className="py-2 px-3 whitespace-nowrap"><button onClick={() => router.push(`/${locale}/projects/${l.project_code}`)} className="text-[#DBA935] hover:underline">{L('فتح', 'Open')}</button></td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
