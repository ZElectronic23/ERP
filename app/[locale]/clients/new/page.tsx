import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import ClientForm from '@/components/ClientForm';

export default async function NewClientPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
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
        return notFound();
    }

    async function createClientAction(formData: FormData) {
        'use server';

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
        if (!user) throw new Error('Unauthorized');

        const clientData: any = {
            ClientName: formData.get('ClientName'),
            'Mobile No.': formData.get('Mobile No.'),
            'E-Mail': formData.get('E-Mail'),
            Address: formData.get('Address'),
            DisReason: formData.get('DisReason'),
            DisValue: formData.get('DisValue') ? parseFloat(formData.get('DisValue') as string) / 100 : null,
            'Client Type': formData.get('Client Type'),
            FollowUpFrequency: formData.get('FollowUpFrequency'),
            LastFollowUpDate: formData.get('LastFollowUpDate') || null,
            NextFollowUpDate: formData.get('NextFollowUpDate') || null,
            FollowUpMethod: formData.get('FollowUpMethod'),
            client_kind: formData.get('client_kind') || 'actual',
            notes: formData.get('notes') || null,
        };

        const { createClient } = await import('@/lib/db/queries/clients');
        await createClient(clientData, user.id);

        redirect(`/${locale}/clients`);
    }

    return (
        <div className="min-h-screen p-4 md:p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold mb-6 text-[#DBA935] max-w-4xl mx-auto">{locale === 'ar' ? 'إضافة عميل جديد' : 'Add New Client'}</h1>
            <ClientForm action={createClientAction} locale={locale} />
        </div>
    );
}
