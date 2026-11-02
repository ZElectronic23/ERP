'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

// Invoices live in the unified Documents module (doc_type = IN).
// This route sends the user to the Documents list pre-filtered to invoices.
export default function InvoicesRedirectPage() {
    const router = useRouter();
    const locale = useLocale();

    useEffect(() => {
        router.replace(`/${locale}/documents?type=IN`);
    }, [router, locale]);

    return (
        <div className="min-h-screen flex items-center justify-center" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="text-[#DBA935] text-lg">{locale === 'ar' ? 'جارٍ فتح الفواتير...' : 'Opening invoices...'}</div>
        </div>
    );
}
