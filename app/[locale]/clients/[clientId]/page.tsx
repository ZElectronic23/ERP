import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getClientById } from '@/lib/db/queries/clients';
import { supabaseAdmin } from '@/lib/supabase/admin';

const DOC_LABEL: Record<string, { ar: string; en: string }> = {
    OF: { ar: 'عرض سعر', en: 'Price Offer' }, IN: { ar: 'فاتورة', en: 'Invoice' },
    VR: { ar: 'زيارة فنية', en: 'Visit' }, REP: { ar: 'صيانة', en: 'Maintenance' }, HO: { ar: 'تسليم', en: 'Handover' },
};

export default async function ClientProfilePage({ params }: { params: Promise<{ locale: string; clientId: string }> }) {
    const { locale, clientId } = await params;
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const cookieStore = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: { get(name: string) { return cookieStore.get(name)?.value; } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect(`/${locale}/login`);

    let client: any;
    try { client = await getClientById(clientId); } catch { return notFound(); }
    if (!client) return notFound();

    // full history via service role
    const { data: docs } = await supabaseAdmin.from('documents').select('*').eq('client_id', clientId).is('deleted_at', null).order('doc_date', { ascending: false });
    const list = docs || [];
    const invoices = list.filter(d => d.doc_type === 'IN');
    const offers = list.filter(d => d.doc_type === 'OF');

    const totalInvoiced = invoices.reduce((s, d) => s + (Number(d.total) || 0), 0);
    const totalPaid = invoices.reduce((s, d) => s + (Number(d.paid_amount) || 0), 0);
    const outstanding = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? Math.round(totalPaid / totalInvoiced * 100) : 0;
    const acceptedOffers = offers.filter(o => o.offer_status === 'accepted').length;

    const money = (n: number) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${L('ج.م', 'EGP')}`;
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : '—';

    const Card = ({ title, value, sub, color = '#DBA935' }: { title: string; value: string; sub?: string; color?: string }) => (
        <div className="bg-black/30 rounded-2xl border border-[#DBA935]/20 p-4">
            <p className="text-[#C0C0C0] text-xs mb-1">{title}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
            {sub && <p className="text-[#C0C0C0]/60 text-[11px] mt-1">{sub}</p>}
        </div>
    );

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-6xl mx-auto space-y-5">
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20">
                    <div className="flex flex-wrap justify-between items-start gap-3">
                        <div>
                            <Link href={`/${locale}/clients`} className="text-[#DBA935] text-xs hover:underline">← {L('العملاء', 'Clients')}</Link>
                            <h1 className="text-2xl font-bold text-[#DBA935] mt-1">{client.ClientName}</h1>
                            <div className="flex flex-wrap gap-3 mt-2 text-sm text-[#C0C0C0]">
                                <span>{client.client_kind === 'potential' ? L('عميل محتمل', 'Potential') : L('عميل فعلي', 'Actual')}</span>
                                {client['Mobile No.'] && <span dir="ltr">📞 {client['Mobile No.']}</span>}
                                {client['E-Mail'] && <span dir="ltr">✉ {client['E-Mail']}</span>}
                                {client.Address && <span>📍 {client.Address}</span>}
                            </div>
                        </div>
                        <Link href={`/${locale}/clients/${clientId}/edit`} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90 transition">{L('تعديل البيانات', 'Edit')}</Link>
                    </div>
                    {client.notes && <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-yellow-200 text-sm">📝 {client.notes}</div>}
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card title={L('إجمالي الفواتير', 'Total invoiced')} value={money(totalInvoiced)} sub={`${invoices.length} ${L('فاتورة', 'invoices')}`} />
                    <Card title={L('المحصّل', 'Collected')} value={money(totalPaid)} color="#4ade80" />
                    <Card title={L('المتبقي (مستحقات)', 'Outstanding')} value={money(outstanding)} color={outstanding > 0 ? '#f87171' : '#4ade80'} />
                    <Card title={L('نسبة التحصيل', 'Collection rate')} value={`${collectionRate}%`} color={collectionRate >= 80 ? '#4ade80' : collectionRate >= 50 ? '#facc15' : '#f87171'} />
                    <Card title={L('عروض مقبولة', 'Accepted offers')} value={`${acceptedOffers}/${offers.length}`} />
                </div>

                {/* Documents history */}
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl border border-[#DBA935]/20">
                    <h2 className="text-[#DBA935] font-bold mb-3">{L('سجل المستندات (فواتير وعروض وتقارير)', 'Documents (invoices, offers, reports)')}</h2>
                    <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                        <table className="w-full text-sm" style={{ minWidth: '720px' }}>
                            <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الرقم', 'No.'), L('النوع', 'Type'), L('التاريخ', 'Date'), L('الإجمالي', 'Total'), L('المدفوع', 'Paid'), L('الحالة', 'Status'), ''].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {list.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-[#C0C0C0]">{L('لا توجد مستندات', 'No documents')}</td></tr>
                                    : list.map(d => (
                                        <tr key={d.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white hover:bg-[#DBA935]/10">
                                            <td className="py-2 px-3 whitespace-nowrap"><Link href={`/${locale}/documents/${d.id}`} className="text-[#DBA935] hover:underline font-medium">{d.doc_number}</Link></td>
                                            <td className="py-2 px-3 whitespace-nowrap">{isAr ? DOC_LABEL[d.doc_type]?.ar : DOC_LABEL[d.doc_type]?.en}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{fmtDate(d.doc_date)}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{d.total ? money(d.total) : '—'}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{d.doc_type === 'IN' ? money(d.paid_amount) : '—'}</td>
                                            <td className="py-2 px-3 text-xs">
                                                {d.doc_type === 'OF' ? (d.offer_status || '—') : (d.payment_status || d.status || '—')}
                                                {d.doc_type === 'IN' && d.payment_status !== 'paid' && d.unpaid_reason && (
                                                    <span className="block text-[#C0C0C0]/70 text-[11px] mt-0.5">📝 {d.unpaid_reason}</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 whitespace-nowrap"><Link href={`/${locale}/documents/${d.id}`} className="text-[#DBA935] hover:underline">{L('فتح', 'Open')}</Link></td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Warranty certificates — one per invoice, linked by invoice number */}
                <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl border border-[#DBA935]/20">
                    <h2 className="text-[#DBA935] font-bold mb-3">🛡️ {L('شهادات الضمان (شهادة لكل فاتورة)', 'Warranty certificates (one per invoice)')}</h2>
                    {invoices.length === 0 ? <p className="text-[#C0C0C0] text-sm">{L('لا توجد فواتير بعد', 'No invoices yet')}</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {invoices.map(d => (
                                <Link key={d.id} href={`/${locale}/documents/${d.id}`} className="rounded-xl border border-[#DBA935]/30 bg-[#DBA935]/5 p-3 hover:bg-[#DBA935]/10 transition block">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[#DBA935] text-sm font-medium">{d.doc_number}</span>
                                        <span className="text-[11px] text-[#C0C0C0]">{fmtDate(d.doc_date)}</span>
                                    </div>
                                    <p className="text-[#C0C0C0] text-xs mt-2">{L('اضغط لعرض/طباعة شهادة الضمان', 'Click to view/print the warranty certificate')}</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
