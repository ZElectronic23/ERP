import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppProvider } from '@/contexts/AppContext';
import FloatingActions from '@/components/ui/FloatingActions';
import NotificationBell from '@/components/NotificationBell';
import UserMenu from '@/components/UserMenu';
import Image from 'next/image';
import { locales } from '@/config/locales';

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

  // الوقت والتاريخ (سيتم تحديثهما في كل صفحة عبر useEffect، لكن يمكن وضعهما هنا أيضاً مع client component)
  // لكن لتبسيط، سنترك الوقت في كل صفحة كما هو، أو ننشئ مكون TimeDisplay.

  return (
    <NextIntlClientProvider messages={messages}>
      <AppProvider>
        <div className="min-h-screen flex flex-col">
          {/* ==================== HEADER العام ==================== */}
          <div className="relative w-full mb-2" style={{ minHeight: '70px' }}>
            {/* الوقت - يسار (سيتم تحديثه عبر useEffect في كل صفحة) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              {/* يمكنك وضع TimeDisplay هنا أو تركه للصفحات */}
            </div>

            {/* اللوجو - وسط */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Image src="/assets/images/ERP.svg" alt="ERP" width={140} height={140} className="w-28 h-28 md:w-32 md:h-32 object-contain" priority />
            </div>

            {/* يمين: الإشعارات + قائمة المستخدم */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2" style={{ zIndex: 99999 }}>
              <NotificationBell />
              <UserMenu />
            </div>
          </div>

          {/* المحتوى الرئيسي */}
          <main className="flex-1">
            {children}
          </main>

          {/* الأزرار العائمة (واتساب + AI) */}
          <FloatingActions />
        </div>
      </AppProvider>
    </NextIntlClientProvider>
  );
}