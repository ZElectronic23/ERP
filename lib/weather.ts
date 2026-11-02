// lib/weather.ts - كود الطقس منفصل ومنظم
import { Language } from './translations'

// دالة تحويل كود الطقس لنص
const getWeatherCondition = (code: number, language: Language) => {
    const conditions: Record<number, { ar: string, en: string }> = {
        0: { ar: 'صفاء', en: 'Clear sky' },
        1: { ar: 'صافي', en: 'Mainly clear' },
        2: { ar: 'غائم جزئياً', en: 'Partly cloudy' },
        3: { ar: 'غائم', en: 'Overcast' },
        45: { ar: 'ضباب', en: 'Fog' },
        51: { ar: 'رذاذ خفيف', en: 'Light drizzle' },
        53: { ar: 'رذاذ', en: 'Moderate drizzle' },
        55: { ar: 'رذاذ كثيف', en: 'Dense drizzle' },
        61: { ar: 'مطر خفيف', en: 'Slight rain' },
        63: { ar: 'مطر', en: 'Moderate rain' },
        65: { ar: 'مطر غزير', en: 'Heavy rain' },
        71: { ar: 'ثلج خفيف', en: 'Slight snow' },
        73: { ar: 'ثلج', en: 'Moderate snow' },
        75: { ar: 'ثلج كثيف', en: 'Heavy snow' },
        95: { ar: 'عاصفة رعدية', en: 'Thunderstorm' }
    }
    return conditions[code]?.[language] || (language === 'ar' ? 'غير معروف' : 'Unknown')
}

// Cairo fallback (used when geolocation is unavailable/denied, e.g. inside the desktop app)
const CAIRO = { lat: 30.0444, lon: 31.2357, ar: 'القاهرة', en: 'Cairo' }

// Fetch weather for given coordinates (shared by the geolocation and fallback paths)
async function fetchByCoords(latitude: number, longitude: number, language: Language, defaultCity: string) {
    const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m&timezone=auto`
    )
    if (!weatherResponse.ok) throw new Error('weather service failed')
    const weatherData = await weatherResponse.json()

    let cityName = defaultCity
    try {
        const cityResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${language}`,
            { headers: { 'User-Agent': 'ZElectronics-ERP/1.0 (contact@zelectronic.com)' } }
        )
        if (cityResponse.ok) {
            const cityData = await cityResponse.json()
            cityName = cityData.address?.city || cityData.address?.town || cityData.address?.village || cityData.address?.county || cityName
        }
    } catch { /* keep default city */ }

    return {
        error: false,
        temp: Math.round(weatherData.current_weather.temperature),
        condition: getWeatherCondition(weatherData.current_weather.weathercode, language),
        windSpeed: weatherData.current_weather.windspeed,
        location: cityName,
        // Open-Meteo returns is_day (1 = daytime, 0 = night) with current_weather.
        isDay: weatherData.current_weather.is_day === 1,
        weatherCode: weatherData.current_weather.weathercode,
    }
}

// دالة جلب بيانات الطقس — تستخدم موقع المستخدم، ولو مش متاح ترجع لطقس القاهرة تلقائياً
export const fetchWeatherData = async (language: Language) => {
    const cairoCity = language === 'ar' ? CAIRO.ar : CAIRO.en
    const fallback = () => fetchByCoords(CAIRO.lat, CAIRO.lon, language, cairoCity)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return fallback()
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    resolve(await fetchByCoords(position.coords.latitude, position.coords.longitude, language, language === 'ar' ? 'موقعك الحالي' : 'Your location'))
                } catch {
                    try { resolve(await fallback()) } catch (e) { reject({ error: true, message: language === 'ar' ? 'فشل الاتصال بخدمة الطقس' : 'Failed to connect to weather service' }) }
                }
            },
            async () => {
                // geolocation denied/unavailable → fall back to Cairo instead of failing
                try { resolve(await fallback()) } catch { reject({ error: true, message: language === 'ar' ? 'فشل الاتصال بخدمة الطقس' : 'Failed to connect to weather service' }) }
            },
            { timeout: 8000 }
        )
    })
}