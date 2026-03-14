import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppProvider } from '@/contexts/AppContext';
import FloatingActions from '@/components/ui/FloatingActions';
import Header from '@/components/Header';
import { locales } from '@/config/locales';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locale || !locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AppProvider>
        <div
          className="min-h-screen flex flex-col"
          style={{
            backgroundImage: "url('/assets/images/BG.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <FloatingActions />
        </div>
      </AppProvider>
    </NextIntlClientProvider>
  );
}