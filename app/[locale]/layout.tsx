import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppProvider } from '@/contexts/AppContext';
import { locales } from '@/config/locales'; // ✅ استيراد من الملف الجديد

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locale) {
    console.error('❌ Locale is missing');
    notFound();
  }

  if (!locales.includes(locale as any)) {
    console.error(`❌ Unsupported locale: ${locale}`);
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AppProvider>
        {children}
      </AppProvider>
    </NextIntlClientProvider>
  );
}