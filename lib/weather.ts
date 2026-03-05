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

// دالة جلب بيانات الطقس مع معالجة أخطاء أفضل
export const fetchWeatherData = async (language: Language) => {
    return new Promise(async (resolve, reject) => {
        if (!navigator.geolocation) {
            reject({
                error: true,
                message: language === 'ar'
                    ? 'متصفحك لا يدعم تحديد الموقع'
                    : 'Your browser does not support geolocation'
            })
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords

                    // جلب بيانات الطقس من Open-Meteo
                    const weatherResponse = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m&timezone=auto`
                    )

                    if (!weatherResponse.ok) {
                        reject({
                            error: true,
                            message: language === 'ar'
                                ? 'فشل الاتصال بخدمة الطقس'
                                : 'Failed to connect to weather service'
                        })
                        return
                    }

                    const weatherData = await weatherResponse.json()

                    // جلب اسم المدينة من OpenStreetMap
                    let cityName = language === 'ar' ? 'موقعك الحالي' : 'Your location'

                    try {
                        const cityResponse = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${language}`,
                            {
                                headers: {
                                    'User-Agent': 'ZElectronics-ERP/1.0 (contact@zelectronic.com)'
                                }
                            }
                        )

                        if (cityResponse.ok) {
                            const cityData = await cityResponse.json()
                            cityName = cityData.address?.city ||
                                cityData.address?.town ||
                                cityData.address?.village ||
                                cityData.address?.county ||
                                cityName
                        }
                    } catch (cityError) {
                        console.log('City fetch failed, using default location')
                    }

                    // تحويل كود الطقس
                    const weatherCode = weatherData.current_weather.weathercode
                    const condition = getWeatherCondition(weatherCode, language)

                    resolve({
                        error: false,
                        temp: Math.round(weatherData.current_weather.temperature),
                        condition: condition,
                        windSpeed: weatherData.current_weather.windspeed,
                        location: cityName
                    })

                } catch (error) {
                    console.error('Weather fetch error:', error)
                    reject({
                        error: true,
                        message: language === 'ar'
                            ? 'حدث خطأ في الاتصال، الرجاء المحاولة مرة أخرى'
                            : 'Connection error, please try again'
                    })
                }
            },
            (error) => {
                console.error('Geolocation error:', error)
                reject({
                    error: true,
                    message: language === 'ar'
                        ? 'فشل تحديد الموقع، الرجاء التحقق من صلاحيات الموقع'
                        : 'Failed to get location, please check location permissions'
                })
            }
        )
    })
}