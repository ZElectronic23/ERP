import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import ClientForm from '../../components/ClientForm';
import { getClientById } from '@/lib/db/queries/clients';

export default async function EditClientPage({
    params: { locale, clientId },
}: {
    params: { locale: string; clientId: string };
}) {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return notFound();
    }

    const client = await getClientById(clientId);

    if (!client) {
        return notFound();
    }

    async function updateClient(formData: FormData) {
        'use server';

        const supabase = createServerComponentClient({ cookies });
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
            <ClientForm action={updateClient} locale={locale} initialData={client} />
        </div>
    );
}