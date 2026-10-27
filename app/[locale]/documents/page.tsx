'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DOC_TYPE_LIST, DocType, getDocTypeLabel, formatCurrency,
  DOC_STATUSES, OFFER_STATUSES, PAYMENT_STATUSES,
} from '@/lib/documents';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

interface DocRow {
  id: string;
  doc_number: string;
  doc_type: DocType;
  doc_date: string;
  status: string;
  offer_status: string | null;
  payment_status: string | null;
  total: number;
  clients: { name: string; phone?: string } | null;
  employees: { name: string } | null;
  created_at: string;
  deleted_at: string | null;
}

const daysLeft = (deletedAt: string): number => {
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
  return Math.max(0, 15 - elapsed);
};

export default function DocumentsListPage() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname?.split('/')[1] || 'ar';
  const isRTL = locale === 'ar';
  const label = (ar: string, en: string) => (isRTL ? ar : en);

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<DocType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isCEO, setIsCEO] = useState(false);

  // هل المستخدم الحالي مدير تنفيذي (CEO)؟ (صاحب صلاحية الحذف النهائي)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('users').select('role_key').eq('email', user.email).maybeSingle();
      setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
    })();
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (search) params.set('search', search);
      if (showDeleted) params.set('deleted', 'true');

      const res = await fetch(`/api/documents?${params}`);
      const data = await res.json();
      setDocs(data.documents || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [filterType, filterStatus, search, page, showDeleted]);

  const softDeleteDoc = async (id: string) => {
    if (!confirm(label('نقل المستند للمحذوفات؟', 'Move document to trash?'))) return;
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    fetchDocs();
  };

  const restoreDoc = async (id: string) => {
    await fetch(`/api/documents/${id}?action=restore`, { method: 'PATCH' });
    fetchDocs();
  };

  const permanentDeleteDoc = async (id: string) => {
    if (!confirm(label('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete cannot be undone. Sure?'))) return;
    const res = await fetch(`/api/documents/${id}?permanent=true`, { method: 'DELETE' });
    if (!res.ok) alert(label('فشل الحذف النهائي (للمدير التنفيذي فقط)', 'Permanent delete failed (CEO only)'));
    fetchDocs();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-300',
      active: 'bg-blue-500/20 text-blue-300',
      completed: 'bg-green-500/20 text-green-300',
      cancelled: 'bg-red-500/20 text-red-300',
      sent: 'bg-blue-500/20 text-blue-300',
      accepted: 'bg-green-500/20 text-green-300',
      rejected: 'bg-red-500/20 text-red-300',
      expired: 'bg-orange-500/20 text-orange-300',
      unpaid: 'bg-red-500/20 text-red-300',
      partial: 'bg-orange-500/20 text-orange-300',
      paid: 'bg-green-500/20 text-green-300',
      overdue: 'bg-red-500/30 text-red-200',
    };
    const allStatuses = [...DOC_STATUSES, ...OFFER_STATUSES, ...PAYMENT_STATUSES];
    const found = allStatuses.find((s) => s.value === status);
    const text = found ? (isRTL ? found.labelAr : found.labelEn) : status;
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${colors[status] || 'bg-gray-500/20 text-gray-300'}`}>
        {text}
      </span>
    );
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen p-4 md:p-6">
      <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#DBA935]">{label('المستندات', 'Documents')}</h1>
            <p className="text-[#C0C0C0] text-sm mt-1">
              {label(`إجمالي ${total} مستند`, `${total} documents total`)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowDeleted((v) => !v); setPage(1); }}
              className={`px-4 py-3 rounded-xl font-bold transition shadow-lg text-center text-sm ${showDeleted
                ? 'bg-red-500/80 text-white hover:bg-red-500'
                : 'bg-black/30 text-[#C0C0C0] border border-[#DBA935]/20 hover:bg-[#DBA935]/10'}`}
            >
              {showDeleted ? label('عرض النشطة', 'Show active') : label('المحذوفة', 'Deleted')}
            </button>
            {!showDeleted && (
              <Link
                href={`/${locale}/documents/new`}
                className="px-6 py-3 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition shadow-lg text-center"
              >
                {label('+ مستند جديد', '+ New Document')}
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => { setFilterType('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filterType === 'all' ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-black/20 text-[#C0C0C0] border border-[#DBA935]/20'
            }`}
          >
            {label('الكل', 'All')}
          </button>
          {DOC_TYPE_LIST.map((dt) => (
            <button
              key={dt}
              onClick={() => { setFilterType(dt); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                filterType === dt ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-black/20 text-[#C0C0C0] border border-[#DBA935]/20'
              }`}
            >
              {getDocTypeLabel(dt, locale)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={label('بحث برقم المستند...', 'Search by document number...')}
            className="w-full md:w-80 bg-black/30 border border-[#DBA935]/20 rounded-xl px-4 py-2 text-white placeholder-[#C0C0C0]/50 focus:border-[#DBA935] focus:outline-none"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-[#C0C0C0]">{label('جاري التحميل...', 'Loading...')}</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-[#C0C0C0]">{label('لا توجد مستندات', 'No documents found')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DBA935]/30 text-[#C0C0C0]">
                  <th className="py-3 px-3 text-start">{label('رقم المستند', 'Doc Number')}</th>
                  <th className="py-3 px-3 text-start">{label('النوع', 'Type')}</th>
                  <th className="py-3 px-3 text-start">{label('العميل', 'Client')}</th>
                  <th className="py-3 px-3 text-center">{label('التاريخ', 'Date')}</th>
                  <th className="py-3 px-3 text-center">{label('الإجمالي', 'Total')}</th>
                  <th className="py-3 px-3 text-center">{label('الحالة', 'Status')}</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-white/5 hover:bg-[#DBA935]/5 transition cursor-pointer"
                    onClick={() => router.push(`/${locale}/documents/${doc.id}`)}
                  >
                    <td className="py-3 px-3 text-[#DBA935] font-medium">{doc.doc_number}</td>
                    <td className="py-3 px-3 text-white">{getDocTypeLabel(doc.doc_type, locale)}</td>
                    <td className="py-3 px-3 text-white">{doc.clients?.name || '—'}</td>
                    <td className="py-3 px-3 text-center text-[#C0C0C0]">{formatDate(doc.doc_date, locale)}</td>
                    <td className="py-3 px-3 text-center text-[#DBA935]">
                      {doc.total > 0 ? `${formatCurrency(doc.total, locale)} ${label('ج.م', 'EGP')}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {statusBadge(doc.status)}
                      {doc.payment_status && doc.payment_status !== 'unpaid' && (
                        <span className="ms-1">{statusBadge(doc.payment_status)}</span>
                      )}
                    </td>
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {showDeleted ? (
                        <div className="flex items-center gap-2 justify-end">
                          {doc.deleted_at && (
                            <span className={`text-xs font-medium ${daysLeft(doc.deleted_at) <= 3 ? 'text-red-400' : daysLeft(doc.deleted_at) <= 7 ? 'text-yellow-400' : 'text-green-400'}`}>
                              {label(`باقي ${daysLeft(doc.deleted_at)} يوم`, `${daysLeft(doc.deleted_at)}d`)}
                            </span>
                          )}
                          <button onClick={() => restoreDoc(doc.id)} className="text-green-400 hover:underline text-xs">
                            {label('استعادة', 'Restore')}
                          </button>
                          {isCEO && (
                            <button onClick={() => permanentDeleteDoc(doc.id)} className="text-red-400 hover:underline text-xs font-semibold">
                              {label('حذف نهائي', 'Delete forever')}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 justify-end">
                          <Link
                            href={`/${locale}/documents/${doc.id}`}
                            className="text-[#DBA935] hover:underline text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {label('عرض', 'View')}
                          </Link>
                          <button onClick={() => softDeleteDoc(doc.id)} className="text-red-400 hover:underline text-xs">
                            {label('حذف', 'Delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg bg-black/30 text-[#C0C0C0] disabled:opacity-30 hover:bg-[#DBA935]/20 transition"
            >
              {label('السابق', 'Prev')}
            </button>
            <span className="text-[#C0C0C0] text-sm">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg bg-black/30 text-[#C0C0C0] disabled:opacity-30 hover:bg-[#DBA935]/20 transition"
            >
              {label('التالي', 'Next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
