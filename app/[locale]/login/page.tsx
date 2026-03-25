'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { translations, Language } from '@/lib/translations';
import WeatherPopup from '@/components/WeatherPopup';
import { fetchWeatherData } from '@/lib/weather';

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter();

  const [isClient, setIsClient] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [arabicWarning, setArabicWarning] = useState('');

  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(false);

  const [language, setLanguage] = useState<Language>('ar');
  const t = translations[language];
  const [locale, setLocale] = useState<string>('ar');

  // جلب اللغة المحفوظة وإعداد locale
  useEffect(() => {
    setIsClient(true);
    try {
      const savedLang = localStorage.getItem('preferred-language') as Language || 'ar';
      setLanguage(savedLang);
      setLocale(savedLang);
      document.documentElement.lang = savedLang;
      document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) {
      console.log('localStorage not available');
    }
  }, []);

  // استخراج locale من params بعد حل Promise (ضروري لـ Next.js 15+)
  useEffect(() => {
    params.then(({ locale: pLocale }) => {
      setLocale(pLocale);
      setLanguage(pLocale as Language);
      document.documentElement.lang = pLocale;
      document.documentElement.dir = pLocale === 'ar' ? 'rtl' : 'ltr';
    });
  }, [params]);

  const containsArabic = (text: string) => {
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicRegex.test(text);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (containsArabic(val)) {
      setArabicWarning('تحذير: كلمة المرور تحتوي على أحرف عربية، يفضل استخدام أحرف إنجليزية وأرقام ورموز');
    } else {
      setArabicWarning('');
    }
  };

  const openWeatherPopup = async () => {
    setIsWeatherOpen(true);
    setWeatherLoading(true);
    try {
      const data = await fetchWeatherData(language);
      setWeatherData(data);
    } catch (error: any) {
      console.error('Error in weather popup:', error);
      setWeatherData({
        error: true,
        message: language === 'ar' ? 'تعذر جلب بيانات الطقس الآن' : 'Unable to fetch weather data right now',
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    setLocale(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('preferred-language', newLang);
    } catch (e) { }
  };

  const handleTechSupport = () => {
    const message = language === 'ar'
      ? 'محتاج مساعده في حساب ERP الخاص بي'
      : 'I need help with my ERP account';
    window.open(`https://wa.me/201004496397?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('status')
          .eq('email', data.user.email)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching user status:', userError);
        }

        const isActive = !userData || userData.status === 'active';

        if (!isActive) {
          await supabase.auth.signOut();
          const errorMsg = language === 'ar'
            ? 'حسابك معطل، يرجى التواصل مع الدعم الفني'
            : 'Your account is deactivated, please contact support';
          setError(errorMsg);
          setLoading(false);
          return;
        }

        if (rememberMe) {
          localStorage.setItem('remembered-email', email);
        } else {
          localStorage.removeItem('remembered-email');
        }

        // التوجيه إلى dashboard مع اللغة
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch (error: any) {
      if (error.message === 'Invalid login credentials') {
        setError(language === 'ar' ? 'بريد إلكتروني أو كلمة مرور غير صحيحة' : 'Invalid email or password');
      } else {
        setError(error.message || (language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const remembered = localStorage.getItem('remembered-email');
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  const now = new Date();
  const timeString = now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const dayName = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }).slice(0, 3);
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);
  const shortDate = `${dayName} ${day}/${month}/${year}`;
  const fullDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!isClient) {
    return (
      <div className="min-h-screen bg-darkwhite flex items-center justify-center">
        <div className="text-gold">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-2"
      style={{
        backgroundImage: "url('/assets/images/BG.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-[280px] bg-darkwhite/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-2">
        {/* نفس المحتوى كما هو موجود سابقاً */}
        {/* ... */}
        {/* لاحظ أن باقي المحتوى هو نفسه كما في إصداراتك السابقة */}
      </div>

      <WeatherPopup
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        weatherData={weatherData}
        loading={weatherLoading}
        language={language}
      />
    </div>
  );
}