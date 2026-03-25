import { getClients } from '@/lib/db/queries/clients';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { DeleteButton, RestoreButton } from '@/components/ClientActions';

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
    searchParams: { page?: string; search?: string; includeDeleted?: string };
    params: Promise<{ locale: string }>;
}) {
    // انتظار params للحصول على locale
    const { locale } = await params;

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

    const page = parseInt(searchParams.page || '1');
    const search = searchParams.search || '';
    const includeDeleted = searchParams.includeDeleted === 'true';

    const { data: clients, count } = await getClients({
        includeDeleted,
        page,
        limit: 10,
        search,
    });

    const totalPages = count ? Math.ceil(count / 10) : 0;
    const lang = locale === 'ar' ? 'ar' : 'en';
    const t = (key: keyof typeof translations[typeof lang]) => translations[lang][key] || key;

    return (
        <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold mb-6">{t('clients')}</h1>

            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <Link
                    href={`/${locale}/clients/new`}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    {t('addNew')}
                </Link>
                <div className="flex gap-2">
                    <form className="flex gap-2">
                        <input
                            type="text"
                            name="search"
                            defaultValue={search}
                            placeholder={t('search')}
                            className="border rounded px-3 py-2"
                        />
                        <button type="submit" className="bg-gray-200 px-4 py-2 rounded">
                            {t('search')}
                        </button>
                    </form>
                    <form>
                        <input
                            type="hidden"
                            name="includeDeleted"
                            value={includeDeleted ? 'false' : 'true'}
                        />
                        <button type="submit" className="bg-gray-200 px-4 py-2 rounded">
                            {t('includeDeleted')}
                        </button>
                    </form>
                </div>
            </div>

            <div className="overflow-x-auto bg-white shadow rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clientId')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clientName')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('mobile')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('email')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clientType')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('disValue')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('createdAt')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {clients.map((client) => (
                            <tr key={client.ClientId}>
                                <td className="px-6 py-4 whitespace-nowrap">{client.ClientId}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{client.ClientName}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{client['Mobile No.']}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{client['E-Mail']}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{client['Client Type']}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{client.DisValue ? `${client.DisValue * 100}%` : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(client.created_at, locale)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {client.deleted_at ? (
                                        <RestoreButton clientId={client.ClientId} locale={locale} />
                                    ) : (
                                        <>
                                            <Link
                                                href={`/${locale}/clients/${client.ClientId}/edit`}
                                                className="text-blue-600 hover:text-blue-900 ml-2"
                                            >
                                                {t('edit')}
                                            </Link>
                                            <DeleteButton clientId={client.ClientId} locale={locale} />
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                    {page > 1 && (
                        <Link
                            href={`/${locale}/clients?page=${page - 1}&search=${search}&includeDeleted=${includeDeleted}`}
                            className="px-4 py-2 bg-gray-200 rounded"
                        >
                            {t('previous')}
                        </Link>
                    )}
                    <span className="px-4 py-2">
                        {page} / {totalPages}
                    </span>
                    {page < totalPages && (
                        <Link
                            href={`/${locale}/clients?page=${page + 1}&search=${search}&includeDeleted=${includeDeleted}`}
                            className="px-4 py-2 bg-gray-200 rounded"
                        >
                            {t('next')}
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}