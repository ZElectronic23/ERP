import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
    // التأكد من وجود locale، وإلا استخدم 'ar' كلغة افتراضية
    const resolvedLocale = locale ?? 'ar';

    return {
        locale: resolvedLocale,
        messages: (await import(`../../messages/${resolvedLocale}.json`)).default
    };
});