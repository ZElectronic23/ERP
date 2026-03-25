import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import ClientForm from '../components/ClientForm';

export default async function NewClientPage({
    params: { locale },
}: {
    params: { locale: string };
}) {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return notFound();
    }

    async function createClient(formData: FormData) {
        'use server';

        const supabase = createServerComponentClient({ cookies });
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Unauthorized');

        // استخراج البيانات من FormData
        const clientData: any = {
            ClientName: formData.get('ClientName'),
            'Mobile No.': formData.get('Mobile No.'),
            'E-Mail': formData.get('E-Mail'),
            Address: formData.get('Address'),
            DisReason: formData.get('DisReason'),
            DisValue: formData.get('DisValue') ? parseFloat(formData.get('DisValue') as string) : null,
            'Client Type': formData.get('Client Type'),
            FollowUpFrequency: formData.get('FollowUpFrequency'),
            LastFollowUpDate: formData.get('LastFollowUpDate'),
            NextFollowUpDate: formData.get('NextFollowUpDate'),
            FollowUpMethod: formData.get('FollowUpMethod'),
        };

        const { createClient } = await import('@/lib/db/queries/clients');
        const newClient = await createClient(clientData, user.id);

        redirect(`/${locale}/clients`);
    }

    return (
        <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold mb-6">Add New Client</h1>
            <ClientForm action={createClient} locale={locale} />
        </div>
    );
}