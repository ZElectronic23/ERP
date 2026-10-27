'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import DocumentEditor from '@/components/documents/DocumentEditor';
import DocumentPreview from '@/components/documents/DocumentPreview';
import { DocumentData, LineItem } from '@/lib/documents';

export default function ViewDocumentPage() {
  const params = useParams();
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const documentId = params?.id as string;

  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [client, setClient] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (!documentId) return;
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const d = data.document;
        // Map DB fields to DocumentData
        const mapped: DocumentData = {
          id: d.id,
          doc_number: d.doc_number,
          doc_type: d.doc_type,
          doc_date: d.doc_date,
          client_id: d.client_id,
          project_id: d.project_id,
          created_by: d.created_by,
          assigned_employee: d.assigned_employee,
          subtotal: d.subtotal || 0,
          discount_pct: d.discount_pct || 0,
          discount_amount: d.discount_amount || 0,
          vat_enabled: d.vat_enabled || false,
          vat_pct: d.vat_pct || 0.14,
          vat_amount: d.vat_amount || 0,
          total: d.total || 0,
          currency: d.currency || 'EGP',
          exchange_rate: d.exchange_rate || 53.9474,
          valid_until: d.valid_until,
          offer_status: d.offer_status,
          payment_status: d.payment_status,
          payment_method: d.payment_method,
          due_date: d.due_date,
          paid_amount: d.paid_amount || 0,
          visit_date: d.visit_date,
          visit_location: d.visit_location,
          findings: d.findings,
          recommendations: d.recommendations,
          equipment_status: d.equipment_status,
          handover_from: d.handover_from,
          handover_to: d.handover_to,
          warranty_months: d.warranty_months || 12,
          warranty_start: d.warranty_start,
          warranty_end: d.warranty_end,
          parent_doc_id: d.parent_doc_id,
          linked_doc_ids: d.linked_doc_ids || [],
          notes: d.notes,
          internal_notes: d.internal_notes,
          terms: d.terms,
          status: d.status || 'draft',
          items: (d.items || []).map((item: any, idx: number): LineItem => ({
            id: item.id || crypto.randomUUID(),
            sortOrder: item.sort_order || idx + 1,
            itemType: item.item_type || 'custom',
            itemId: item.item_id,
            itemName: item.item_name || '',
            itemUnit: item.item_unit || '',
            category: item.category || '',
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || 0,
            floorPrice: item.floor_price || 0,
            targetPrice: item.target_price || 0,
            discountPct: item.discount_pct || 0,
            discountAmount: item.discount_amount || 0,
            lineTotal: item.line_total || 0,
            condition: item.condition,
            actionTaken: item.action_taken,
            notes: item.notes,
          })),
        };
        setDoc(mapped);
        // Load client info
        if (d.clients) {
          setClient({
            name: d.clients.name,
            company: d.clients.company_name,
            phone: d.clients.phone,
            email: d.clients.email,
            address: d.clients.address,
          });
        }
        // Load employee info
        if (d.employees) {
          setEmployee({
            name: d.employees.name,
            role: d.employees.role,
            phone: d.employees.phone,
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#DBA935] text-lg">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-lg">{error || (isRTL ? 'مستند غير موجود' : 'Document not found')}</div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#DBA935]">
            {doc.doc_number || (isRTL ? 'تعديل مستند' : 'Edit Document')}
          </h1>
          {/* Tab Switcher */}
          <div className="flex gap-1 bg-black/30 rounded-xl p-1 border border-[#DBA935]/20">
            <button
              onClick={() => setTab('edit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === 'edit'
                  ? 'bg-[#DBA935] text-[#3E3B3F]'
                  : 'text-[#C0C0C0] hover:bg-[#DBA935]/10'
              }`}
            >
              {isRTL ? '✏️ تعديل' : '✏️ Edit'}
            </button>
            <button
              onClick={() => setTab('preview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === 'preview'
                  ? 'bg-[#DBA935] text-[#3E3B3F]'
                  : 'text-[#C0C0C0] hover:bg-[#DBA935]/10'
              }`}
            >
              {isRTL ? '👁️ معاينة' : '👁️ Preview'}
            </button>
          </div>
        </div>

        {tab === 'edit' ? (
          <DocumentEditor initialData={doc} documentId={documentId} />
        ) : (
          <DocumentPreview
            document={doc}
            client={client}
            employee={employee}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}
