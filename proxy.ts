import createMiddleware from 'next-intl/middleware';
import { locales } from './config/locales';

export default createMiddleware({
  locales,
  defaultLocale: 'ar',
  localePrefix: 'as-needed'
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};