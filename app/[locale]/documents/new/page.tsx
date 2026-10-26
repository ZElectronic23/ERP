'use client';

import DocumentEditor from '@/components/documents/DocumentEditor';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

export default function NewDocumentPage() {
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'ar';
  const isRTL = locale === 'ar';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[#DBA935] mb-6">
          {isRTL ? 'إنشاء مستند جديد' : 'Create New Document'}
        </h1>
        <DocumentEditor />
      </div>
    </div>
  );
}
