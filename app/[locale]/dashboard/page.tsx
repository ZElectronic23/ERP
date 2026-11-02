import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import { buildAccess } from '@/lib/auth/access';
import FingerprintPunch from '@/components/attendance/FingerprintPunch';

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
    .select('entity_id, full_name, role_key, is_admin, entity_type')
    .eq('email', user.email)
    .single();
  if (userData?.full_name) userName = userData.full_name;

  // Clients must never see the company dashboard — send them to their own portal.
  const rkLower = (userData?.role_key || '').toLowerCase();
  if (rkLower === 'client' || rkLower === 'regular_client' || userData?.entity_type === 'client') {
    redirect(`/${locale}/portal/client`);
  }

  // Build this user's access from explicit permissions (if any) or role defaults.
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { data: permRows } = userData?.entity_id
    ? await supabaseAdmin.from('user_permissions').select('module, can_view').eq('user_id', userData.entity_id)
    : { data: [] as any[] };
  const access = buildAccess(userData, permRows);
  // Revenue / profit / company-wide analytics are sensitive — owner/finance only.
  const canSeeFinancials = access.canFinancials;
  const canSeeAnalytics = access.canFinancials;

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
      documents: 'المستندات',
      evaluations: 'التقييمات',
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
      documents: 'Documents',
      evaluations: 'Evaluations',
    },
  };
  const dict = t[lang];

  // ── real KPIs from the database (financials computed only when the viewer may see them) ──
  const [projCount, clientCount, invRows, expRows] = await Promise.all([
    supabaseAdmin.from('projects').select('ProjectCode', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseAdmin.from('clients').select('ClientId', { count: 'exact', head: true }).is('deleted_at', null).eq('client_kind', 'actual'),
    canSeeFinancials ? supabaseAdmin.from('documents').select('total, payment_status').eq('doc_type', 'IN').is('deleted_at', null) : Promise.resolve({ data: [] as any[] }),
    canSeeFinancials ? supabaseAdmin.from('expenses').select('Amount').eq('Status', 'paid').is('deleted_at', null) : Promise.resolve({ data: [] as any[] }),
  ]);
  // Revenue = total of invoices marked paid (documents has no paid_amount column).
  const collected = (invRows.data || []).reduce((s: number, d: any) => s + (d.payment_status === 'paid' ? (Number(d.total) || 0) : 0), 0);
  const expensesPaid = (expRows.data || []).reduce((s: number, d: any) => s + (Number(d.Amount) || 0), 0);
  const nf = (n: number) => Number(n || 0).toLocaleString();
  const kpis = {
    totalProjects: projCount.count || 0,
    totalRevenue: nf(collected),
    totalProfit: nf(collected - expensesPaid),
    activeClients: clientCount.count || 0,
  };

  // Sections grouped by DEPARTMENT. Each section is hidden unless the user may access its module,
  // and a department disappears when it has no visible section.
  type Sec = { key: string; href: string; icon: string; ar: string; en: string };
  const DEPARTMENTS: { ar: string; en: string; icon: string; sections: Sec[] }[] = [
    {
      ar: 'المشاريع والعمليات', en: 'Projects & Operations', icon: '🏗️', sections: [
        { key: 'projects', href: 'projects', icon: '📁', ar: 'المشاريع', en: 'Projects' },
        { key: 'surveys', href: 'surveys', icon: '📋', ar: 'المسح الفني', en: 'Technical survey' },
        { key: 'maintenance', href: 'maintenance', icon: '🔧', ar: 'الصيانة', en: 'Maintenance' },
        { key: 'approvals', href: 'approvals', icon: '✅', ar: 'الاعتمادات', en: 'Approvals' },
        { key: 'products', href: 'products', icon: '📦', ar: 'المنتجات والخدمات', en: 'Products & services' },
        { key: 'knowledge', href: 'knowledge', icon: '📚', ar: 'مكتبة المعرفة', en: 'Knowledge' },
      ],
    },
    {
      ar: 'المبيعات وخدمة العملاء', en: 'Sales & Customer Service', icon: '🤝', sections: [
        { key: 'clients', href: 'clients', icon: '👥', ar: 'العملاء', en: 'Clients' },
        { key: 'support', href: 'support', icon: '🛟', ar: 'الدعم وعلاقات العملاء', en: 'Support & CRM' },
        { key: 'documents', href: 'documents', icon: '📄', ar: 'المستندات', en: 'Documents' },
        { key: 'legal', href: 'legal', icon: '⚖️', ar: 'القانونية', en: 'Legal' },
      ],
    },
    {
      ar: 'المالية', en: 'Finance', icon: '💰', sections: [
        { key: 'accounting', href: 'accounting', icon: '🧮', ar: 'الحسابات', en: 'Accounting' },
        { key: 'invoices', href: 'invoices', icon: '🧾', ar: 'الفواتير', en: 'Invoices' },
        { key: 'market', href: 'market', icon: '📈', ar: 'بيانات السوق', en: 'Market data' },
        { key: 'marketing', href: 'marketing', icon: '📣', ar: 'التسويق والدعاية', en: 'Marketing' },
      ],
    },
    {
      ar: 'الموارد البشرية', en: 'Human Resources', icon: '👔', sections: [
        { key: 'employees', href: 'employees', icon: '🧑‍💼', ar: 'الموظفون', en: 'Employees' },
        { key: 'hr', href: 'hr', icon: '🕒', ar: 'الحضور والإجازات', en: 'Attendance & leaves' },
        { key: 'payroll', href: 'payroll', icon: '💵', ar: 'الرواتب', en: 'Payroll' },
        { key: 'evaluations', href: 'evaluations', icon: '⭐', ar: 'التقييمات', en: 'Evaluations' },
      ],
    },
    {
      ar: 'الشركاء', en: 'Partners', icon: '🤝', sections: [
        { key: 'partners', href: 'partners', icon: '🫱🏻‍🫲🏼', ar: 'الشركاء', en: 'Partners' },
      ],
    },
  ];
  const visibleDepts = DEPARTMENTS
    .map(d => ({ ...d, sections: d.sections.filter(s => access.has(s.key)) }))
    .filter(d => d.sections.length > 0);

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

        <div className="mb-6">
          <FingerprintPunch />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm hover:border-gold/40 transition">
            <h3 className="text-silver text-sm mb-1">{dict.totalProjects}</h3>
            <p className="text-2xl font-bold text-gold">{kpis.totalProjects}</p>
          </div>
          {canSeeFinancials && (
            <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm">
              <h3 className="text-silver text-sm mb-1">{dict.totalRevenue}</h3>
              <p className="text-2xl font-bold text-gold">{kpis.totalRevenue} {lang === 'ar' ? 'ج.م' : 'EGP'}</p>
            </div>
          )}
          {canSeeFinancials && (
            <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm">
              <h3 className="text-silver text-sm mb-1">{dict.totalProfit}</h3>
              <p className="text-2xl font-bold text-gold">{kpis.totalProfit} {lang === 'ar' ? 'ج.م' : 'EGP'}</p>
            </div>
          )}
          <div className="bg-darkwhite/40 rounded-xl border border-gold/20 p-4 backdrop-blur-sm">
            <h3 className="text-silver text-sm mb-1">{dict.activeClients}</h3>
            <p className="text-2xl font-bold text-gold">{kpis.activeClients}</p>
          </div>
        </div>

        {canSeeAnalytics && (
          <div className="mb-8">
            <h2 className="text-xl font-alata text-gold mb-3">{dict.stats}</h2>
            <DashboardAnalytics locale={locale} />
          </div>
        )}

        <div className="space-y-6">
          <h2 className="text-xl font-alata text-gold">{lang === 'ar' ? 'الإدارات' : 'Departments'}</h2>
          {visibleDepts.map((dep) => (
            <div key={dep.en}>
              <h3 className="text-silver font-alata text-base mb-2 flex items-center gap-2">
                <span className="text-lg">{dep.icon}</span>{lang === 'ar' ? dep.ar : dep.en}
                <span className="flex-1 h-px bg-gold/15 ms-2" />
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {dep.sections.map((s) => (
                  <Link
                    key={s.key}
                    href={`/${locale}/${s.href}`}
                    className="group bg-darkwhite/40 backdrop-blur-sm rounded-xl border border-gold/20 p-4 text-center hover:border-gold/60 transition-all hover:-translate-y-1"
                  >
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <span className="text-white text-sm font-medium group-hover:text-gold transition">
                      {lang === 'ar' ? s.ar : s.en}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
