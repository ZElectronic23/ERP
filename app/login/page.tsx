'use client';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'
import { translations, Language } from '@/lib/translations'
import WeatherPopup from '@/components/WeatherPopup'
import { fetchWeatherData } from '@/lib/weather'

export default function LoginPage() {
  const router = useRouter()

  // ==================== STATES ====================
  const [isClient, setIsClient] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Weather states
  const [isWeatherOpen, setIsWeatherOpen] = useState(false)
  const [weatherData, setWeatherData] = useState<any>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [isDateExpanded, setIsDateExpanded] = useState(false)

  // ==================== LANGUAGE ====================
  const [language, setLanguage] = useState<Language>('ar')
  const t = translations[language]

  useEffect(() => {
    setIsClient(true)
    try {
      const savedLang = localStorage.getItem('preferred-language') as Language || 'ar'
      setLanguage(savedLang)
      document.documentElement.lang = savedLang
      document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'
    } catch (e) {
      console.log('localStorage not available')
    }
  }, [])

  // ==================== WEATHER ====================
  const openWeatherPopup = async () => {
    setIsWeatherOpen(true)
    setWeatherLoading(true)

    try {
      const data = await fetchWeatherData(language)
      setWeatherData(data)
    } catch (error: any) {
      console.error('Error in weather popup:', error)
      // تمرير رسالة بسيطة للبوب أب بدلاً من الاكتفاء بعدم وجود بيانات
      setWeatherData(
        error && typeof error === 'object' && 'error' in error
          ? error
          : {
              error: true,
              message:
                language === 'ar'
                  ? 'تعذر جلب بيانات الطقس الآن'
                  : 'Unable to fetch weather data right now',
            },
      )
    } finally {
      setWeatherLoading(false)
    }
  }

  // ==================== TOGGLE LANGUAGE ====================
  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    document.documentElement.lang = newLang
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
    try {
      localStorage.setItem('preferred-language', newLang)
    } catch (e) {
      console.log('localStorage not available')
    }
  }

  // ==================== HANDLE LOGIN ====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (error) throw error

      if (data.user) {
        if (rememberMe) {
          localStorage.setItem('remembered-email', email)
        } else {
          localStorage.removeItem('remembered-email')
        }

        router.push('/products')
        router.refresh()
      }
    } catch (error: any) {
      if (error.message === 'Invalid login credentials') {
        setError(language === 'ar' ? 'بريد إلكتروني أو كلمة مرور غير صحيحة' : 'Invalid email or password')
      } else {
        setError(error.message || (language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  // ==================== TECH SUPPORT ====================
  const handleTechSupport = () => {
    const message = language === 'ar'
      ? 'محتاج مساعده في حساب ERP الخاص بي'
      : 'I need help with my ERP account'
    window.open(`https://wa.me/201004496397?text=${encodeURIComponent(message)}`, '_blank')
  }

  // استرجاع البريد الإلكتروني المحفوظ
  useEffect(() => {
    const remembered = localStorage.getItem('remembered-email')
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
  }, [])

  // ==================== DATE FORMATTING ====================
  const now = new Date()
  const timeString = now.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const dayName = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }).slice(0, 3)
  const day = now.getDate().toString().padStart(2, '0')
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const year = now.getFullYear().toString().slice(-2)
  const shortDate = `${dayName} ${day}/${month}/${year}`
  const fullDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  if (!isClient) {
    return (
      <div className="min-h-screen bg-darkwhite flex items-center justify-center">
        <div className="text-gold">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-2"
      style={{
        backgroundImage: "url('/assets/images/BG.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* طبقة شفافة فوق الخلفية - أقصر حجماً */}
      <div className="w-full max-w-[280px] bg-darkwhite/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-2">

        {/* ==================== HEADER ==================== */}
        <div className="flex justify-between items-center mb-0.5">
          {/* الوقت والتاريخ والطقس */}
          <div className="relative">
            <div
              className="relative"
              onMouseEnter={() => setIsDateExpanded(true)}
              onMouseLeave={() => setIsDateExpanded(false)}
            >
              <div className="flex items-center gap-0.5 text-silver cursor-pointer hover:border hover:border-gold/50 rounded-full px-1 py-0.5 transition-all">
                <span suppressHydrationWarning className="text-[10px] md:text-xs">{timeString}</span>
                {isDateExpanded && (
                  <>
                    <span className="text-[8px] text-silver/80">{shortDate}</span>
                    <button
                      onClick={openWeatherPopup}
                      className="text-gold hover:text-yellow-500 transition-colors"
                      title={fullDate}
                    >
                      <Image
                        src="/assets/images/cloud.svg"
                        alt="الطقس"
                        width={12}
                        height={12}
                        className="w-3 h-3 object-contain"
                        priority
                      />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* زر اللغة */}
          <button
            onClick={toggleLanguage}
            className="px-1.5 py-0.5 rounded-full border border-gold/30 text-gold hover:bg-gold/40 hover:text-darkwhite transition-colors text-[8px] font-medium"
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        {/* ==================== LOGO - ضعف الحجم ==================== */}
        <div className="flex justify-center my-0.5">
          <div className="relative w-72 h-72 md:w-80 md:h-80">
            <Image
              src="/assets/images/ERP.svg"
              alt="ERP"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* ==================== ERROR MESSAGE ==================== */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-1 mb-0.5">
            <p className="text-red-400 text-[9px] text-center">{error}</p>
          </div>
        )}

        {/* ==================== LOGIN FORM ==================== */}
        <form onSubmit={handleLogin} className="space-y-1.5">
          {/* Email Field */}
          <div>
            <label className="block text-silver text-[8px] mb-0.5">
              {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-1.5 py-1 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-[9px] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
              placeholder={language === 'ar' ? 'example@domain.com' : 'example@domain.com'}
            />
          </div>

          {/* Password Field - مع أيقونة عين */}
          <div>
            <label className="block text-silver text-[8px] mb-0.5">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-1.5 py-1 bg-[#0a0a0c] border border-silver/30 rounded-xl text-white text-[9px] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${language === 'ar' ? 'left-1' : 'right-1'} top-1/2 -translate-y-1/2 text-silver hover:text-gold transition-colors`}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Tech Support */}
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-1 cursor-pointer group">
              <div className="relative w-3 h-3">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-3 h-3 border-2 rounded-md transition-all duration-200 ${rememberMe
                    ? 'border-gold bg-gold'
                    : 'border-silver/30 bg-transparent group-hover:border-gold/50'
                  }`}>
                  {rememberMe && (
                    <svg className="w-2 h-2 text-darkwhite absolute top-0.5 left-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-silver text-[8px] select-none">
                {language === 'ar' ? 'تذكرني' : 'Remember'}
              </span>
            </label>

            <button
              type="button"
              onClick={handleTechSupport}
              className="px-1.5 py-0.5 bg-gold/20 border border-gold/30 rounded-xl text-gold text-[8px] font-medium hover:bg-[#2a2a2e] hover:text-white transition-all duration-200 flex items-center gap-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-2.5 h-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.639 9.639 0 01-2.355-.284 2.198 2.198 0 01-1.822.534 8.973 8.973 0 01-2.997-.728c.065-.116.126-.234.183-.354.404-.842.704-1.74.878-2.633C5.681 15.299 4.5 13.78 4.5 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <span>{language === 'ar' ? 'الدعم الفني' : 'Tech-Sup'}</span>
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-1 bg-gold text-darkwhite rounded-xl font-bold text-[9px] hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-0.5"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-0.5">
                <span className="inline-block animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-darkwhite"></span>
                <span className="text-[7px]">{language === 'ar' ? 'جاري...' : 'Loading...'}</span>
              </span>
            ) : (
              language === 'ar' ? 'دخول' : 'Login'
            )}
          </button>
        </form>

        {/* ==================== FOOTER ==================== */}
        <p className="text-center text-silver/60 text-[6px] mt-1">
          {language === 'ar' ? 'جميع الحقوق محفوظة © 2020' : 'All rights reserved © 2020'}
        </p>
      </div>

      {/* Weather Popup */}
      <WeatherPopup
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        weatherData={weatherData}
        loading={weatherLoading}
        language={language}
      />
    </div>
  )
}