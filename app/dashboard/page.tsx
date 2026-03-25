import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = locale as 'ar' | 'en';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  let userName = user.email?.split('@')[0] || '';
  const { data: userData } = await supabase
    .from('users')
    .select('full_name')
    .eq('email', user.email)
    .single();
  if (userData?.full_name) userName = userData.full_name;

  const t = {
    ar: {
      dashboard: 'لوحة التحكم',
      welcome: 'مرحباً',
      stats: 'المؤشرات',
      totalProjects: 'إجمالي المشاريع',
      totalRevenue: 'إجمالي الإيرادات',
      totalProfit: 'إجمالي الأرباح',
      activeClients: 'العملاء النشطاء',
      modules: 'الوحدات',
      clients: 'العملاء',
      projects: 'المشاريع',
      products: 'المنتجات',
      employees: 'الموظفين',
      partners: 'الشركاء',
      invoices: 'الفواتير',
      accounting: 'المحاسبة',
      legal: 'الشؤون القانونية',
      maintenance: 'الصيانة',
    },
    en: {
      dashboard: 'Dashboard',
      welcome: 'Welcome',
      stats: 'Statistics',
      totalProjects: 'Total Projects',
      totalRevenue: 'Total Revenue',
      totalProfit: 'Total Profit',
      activeClients: 'Active Clients',
      modules: 'Modules',
      clients: 'Clients',
      projects: 'Projects',
      products: 'Products',
      employees: 'Employees',
      partners: 'Partners',
      invoices: 'Invoices',
      accounting: 'Accounting',
      legal: 'Legal',
      maintenance: 'Maintenance',
    },
  };
  const dict = t[lang];

  const kpis = {
    totalProjects: 24,
    totalRevenue: '1,250,000',
    totalProfit: '375,000',
    activeClients: 18,
  };

  const modules = [
    { name: dict.clients, href: `/${locale}/clients`, icon: '/assets/icons/clients.svg' },
    { name: dict.projects, href: `/${locale}/projects`, icon: '/assets/icons/projects.svg' },
    { name: dict.products, href: `/${locale}/products`, icon: '/assets/icons/products.svg' },
    { name: dict.employees, href: `/${locale}/employees`, icon: '/assets/icons/employees.svg' },
    { name: dict.partners, href: `/${locale}/partners`, icon: '/assets/icons/partners.svg' },
    { name: dict.invoices, href: `/${locale}/invoices`, icon: '/assets/icons/invoices.svg' },
    { name: dict.accounting, href: `/${locale}/accounting`, icon: '/assets/icons/accounting.svg' },
    { name: dict.legal, href: `/${locale}/legal`, icon: '/assets/icons/legal.svg' },
    { name: dict.maintenance, href: `/${locale}/maintenance`, icon: '/assets/icons/maintenance.svg' },
  ];

  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundImage: "url('/assets/images/BG.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="bg-darkwhite/70 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-white/10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-alata text-gold">
            {dict.welcome}, {userName}!
          </h1>
          <p className="text-silver text-sm mt-1">
            {lang === 'ar' ? 'هذه هي لوحة التحكم الخاصة بك. يمكنك مراقبة النشاطات والوصول السريع إلى الوحدات.' : 'This is your dashboard. Monitor activity and quick access to modules.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm hover:border-gold/40 transition">
            <h3 className="text-silver text-sm mb-1">{dict.totalProjects}</h3>
            <p className="text-2xl font-bold text-gold">{kpis.totalProjects}</p>
          </div>
          <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm">
            <h3 className="text-silver text-sm mb-1">{dict.totalRevenue}</h3>
            <p className="text-2xl font-bold text-gold">{kpis.totalRevenue} {lang === 'ar' ? 'ج.م' : 'EGP'}</p>
          </div>
          <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm">
            <h3 className="text-silver text-sm mb-1">{dict.totalProfit}</h3>
            <p className="text-2xl font-bold text-gold">{kpis.totalProfit} {lang === 'ar' ? 'ج.م' : 'EGP'}</p>
          </div>
          <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm">
            <h3 className="text-silver text-sm mb-1">{dict.activeClients}</h3>
            <p className="text-2xl font-bold text-gold">{kpis.activeClients}</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-alata text-gold mb-3">{dict.stats}</h2>
          <div className="bg-darkwhite/30 rounded-xl border border-gold/20 p-4 h-64 flex items-center justify-center">
            <p className="text-silver text-sm">
              {lang === 'ar' ? 'سيتم إضافة الرسوم البيانية قريباً' : 'Charts will be added soon'}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-alata text-gold mb-3">{dict.modules}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {modules.map((module) => (
              <Link
                key={module.name}
                href={module.href}
                className="group bg-darkwhite/40 backdrop-blur-sm rounded-xl border border-gold/20 p-4 text-center hover:border-gold/60 transition-all hover:-translate-y-1"
              >
                <div className="w-12 h-12 mx-auto mb-2 relative">
                  <Image
                    src={module.icon}
                    alt={module.name}
                    width={48}
                    height={48}
                    className="object-contain brightness-0 invert opacity-80 group-hover:opacity-100 transition"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <span className="text-white text-sm font-medium group-hover:text-gold transition">
                  {module.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}