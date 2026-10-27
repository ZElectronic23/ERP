import { getClients } from '@/lib/db/queries/clients';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { DeleteButton, RestoreButton, PermanentDeleteButton } from '@/components/ClientActions';

const daysLeft = (deletedAt: string): number => {
    const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
    return Math.max(0, 15 - elapsed);
};

const translations = {
    ar: {
        clients: 'العملاء',
        clientId: 'رقم العميل',
        clientName: 'اسم العميل',
        mobile: 'الجوال',
        email: 'البريد الإلكتروني',
        address: 'العنوان',
        disReason: 'سبب الخصم',
        disValue: 'قيمة الخصم',
        clientType: 'نوع العميل',
        followUpFrequency: 'تكرار المتابعة',
        lastFollowUp: 'آخر متابعة',
        nextFollowUp: 'المتابعة القادمة',
        followUpMethod: 'طريقة المتابعة',
        createdAt: 'تاريخ الإنشاء',
        actions: 'الإجراءات',
        addNew: 'إضافة عميل جديد',
        search: 'بحث',
        includeDeleted: 'عرض المحذوفين',
        previous: 'السابق',
        next: 'التالي',
        edit: 'تعديل',
        delete: 'حذف',
        restore: 'استعادة',
        active: 'نشط',
        inactive: 'غير نشط',
        lead: 'عميل محتمل',
    },
    en: {
        clients: 'Clients',
        clientId: 'Client ID',
        clientName: 'Client Name',
        mobile: 'Mobile',
        email: 'Email',
        address: 'Address',
        disReason: 'Discount Reason',
        disValue: 'Discount Value',
        clientType: 'Client Type',
        followUpFrequency: 'Follow-up Frequency',
        lastFollowUp: 'Last Follow-up',
        nextFollowUp: 'Next Follow-up',
        followUpMethod: 'Follow-up Method',
        createdAt: 'Created At',
        actions: 'Actions',
        addNew: 'Add New Client',
        search: 'Search',
        includeDeleted: 'Include Deleted',
        previous: 'Previous',
        next: 'Next',
        edit: 'Edit',
        delete: 'Delete',
        restore: 'Restore',
        active: 'Active',
        inactive: 'Inactive',
        lead: 'Lead',
    },
};

export default async function ClientsPage({
    searchParams,
    params,
}: {
    searchParams: Promise<{ page?: string; search?: string; includeDeleted?: string }>;
    params: Promise<{ locale: string }>;
}) {
    // انتظار params و searchParams (أصبحا async في Next 16)
    const { locale } = await params;
    const sp = await searchParams;

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect(`/${locale}/login`);
    }

    // هل المستخدم الحالي مدير تنفيذي (CEO)؟ (صاحب صلاحية الحذف النهائي)
    const { data: me } = await supabase.from('users').select('role_key').eq('email', user.email).maybeSingle();
    const isCEO = (me?.role_key || '').toLowerCase() === 'ceo';

    const page = parseInt(sp.page || '1');
    const search = sp.search || '';
    const includeDeleted = sp.includeDeleted === 'true';

    const { data: clients, count } = await getClients({
        includeDeleted,
        page,
        limit: 10,
        search,
    });

    const totalPages = count ? Math.ceil(count / 10) : 0;
    const lang = locale === 'ar' ? 'ar' : 'en';
    const t = (key: keyof typeof translations[typeof lang]) => translations[lang][key] || key;

    const headers = [t('clientId'), t('clientName'), t('mobile'), t('email'), t('clientType'), t('disValue'), t('createdAt'), t('actions')];

    return (
        <div className="min-h-screen p-4 md:p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{t('clients')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">
                            {lang === 'ar' ? `إجمالي ${count || 0} عميل` : `${count || 0} clients total`}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <form className="flex gap-2">
                            <input
                                type="text"
                                name="search"
                                defaultValue={search}
                                placeholder={t('search')}
                                className="bg-black/30 border border-[#DBA935]/20 rounded-xl px-4 py-2 text-white placeholder-[#C0C0C0]/50 focus:border-[#DBA935] focus:outline-none text-sm"
                            />
                            <button type="submit" className="px-4 py-2 rounded-xl bg-black/30 text-[#C0C0C0] border border-[#DBA935]/20 hover:bg-[#DBA935]/10 transition text-sm">
                                {t('search')}
                            </button>
                        </form>
                        <form>
                            <input type="hidden" name="includeDeleted" value={includeDeleted ? 'false' : 'true'} />
                            <button
                                type="submit"
                                className={`px-4 py-2 rounded-xl transition text-sm ${includeDeleted
                                    ? 'bg-red-500/80 text-white hover:bg-red-500'
                                    : 'bg-black/30 text-[#C0C0C0] border border-[#DBA935]/20 hover:bg-[#DBA935]/10'}`}
                            >
                                {includeDeleted ? (lang === 'ar' ? 'عرض النشطين' : 'Show active') : t('includeDeleted')}
                            </button>
                        </form>
                        {!includeDeleted && (
                            <Link
                                href={`/${locale}/clients/new`}
                                className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm text-center"
                            >
                                {t('addNew')}
                            </Link>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                    <table className="w-full text-sm" style={{ minWidth: '860px' }}>
                        <thead>
                            <tr className="bg-[#242428] text-[#DBA935]/90">
                                {headers.map((h, i) => (
                                    <th key={i} className="py-2.5 px-3 text-start font-semibold whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clients.length === 0 ? (
                                <tr>
                                    <td colSpan={headers.length} className="text-center py-10 text-[#C0C0C0]">
                                        {lang === 'ar' ? 'لا توجد بيانات' : 'No data'}
                                    </td>
                                </tr>
                            ) : clients.map((client) => (
                                <tr key={client.ClientId} className="odd:bg-white/[0.02] hover:bg-[#DBA935]/10 transition border-b border-[#3E3B3F]/60 text-white">
                                    <td className="py-2.5 px-3 whitespace-nowrap text-[#DBA935] font-medium">{client.ClientId}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">{client.ClientName}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">{client['Mobile No.'] || '—'}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">{client['E-Mail'] || '—'}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">{client['Client Type'] || '—'}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">{client.DisValue ? `${client.DisValue * 100}%` : '—'}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap text-[#C0C0C0]">{formatDate(client.created_at, locale)}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                        {client.deleted_at ? (
                                            <span className="inline-flex items-center gap-3">
                                                <span className={`text-xs font-medium ${daysLeft(client.deleted_at) <= 3 ? 'text-red-400' : daysLeft(client.deleted_at) <= 7 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {lang === 'ar' ? `باقي ${daysLeft(client.deleted_at)} يوم` : `${daysLeft(client.deleted_at)}d left`}
                                                </span>
                                                <RestoreButton clientId={client.ClientId} locale={locale} />
                                                {isCEO && <PermanentDeleteButton clientId={client.ClientId} locale={locale} />}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-3">
                                                <Link
                                                    href={`/${locale}/clients/${client.ClientId}/edit`}
                                                    className="text-[#DBA935] hover:underline"
                                                >
                                                    {t('edit')}
                                                </Link>
                                                <DeleteButton clientId={client.ClientId} locale={locale} />
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center mt-5 gap-2">
                        {page > 1 && (
                            <Link
                                href={`/${locale}/clients?page=${page - 1}&search=${search}&includeDeleted=${includeDeleted}`}
                                className="px-3 py-1 rounded-lg bg-black/30 text-[#C0C0C0] border border-[#DBA935]/20 hover:bg-[#DBA935]/20 transition text-sm"
                            >
                                {t('previous')}
                            </Link>
                        )}
                        <span className="text-[#C0C0C0] text-sm px-2">{page} / {totalPages}</span>
                        {page < totalPages && (
                            <Link
                                href={`/${locale}/clients?page=${page + 1}&search=${search}&includeDeleted=${includeDeleted}`}
                                className="px-3 py-1 rounded-lg bg-black/30 text-[#C0C0C0] border border-[#DBA935]/20 hover:bg-[#DBA935]/20 transition text-sm"
                            >
                                {t('next')}
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}