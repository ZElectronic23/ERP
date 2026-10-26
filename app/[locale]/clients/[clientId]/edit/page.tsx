import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import ClientForm from '@/components/ClientForm';
import { getClientById } from '@/lib/db/queries/clients';

export default async function EditClientPage({
    params,
}: {
    params: Promise<{ locale: string; clientId: string }>;
}) {
    const { locale, clientId } = await params;
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

    const client = await getClientById(clientId);

    if (!client) {
        return notFound();
    }

    async function updateClientAction(formData: FormData) {
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
            LastFollowUpDate: formData.get('LastFollowUpDate'),
            NextFollowUpDate: formData.get('NextFollowUpDate'),
            FollowUpMethod: formData.get('FollowUpMethod'),
        };

        const { updateClient } = await import('@/lib/db/queries/clients');
        await updateClient(clientId, clientData);

        redirect(`/${locale}/clients`);
    }

    return (
        <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold mb-6">Edit Client</h1>
            <ClientForm action={updateClientAction} locale={locale} initialData={client} />
        </div>
    );
}
