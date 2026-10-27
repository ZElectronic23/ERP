'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  DOC_TYPES, DOC_TYPE_LIST, DocType, DocumentData, LineItem,
  createEmptyDocument, calculateLineItem, calculateDocumentTotals,
  formatCurrency, getDocTypeLabel,
  OFFER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS, DOC_STATUSES,
  EQUIPMENT_STATUSES, COMPANY,
} from '@/lib/documents';
import CustomerSelector from './CustomerSelector';
import ItemSelector from './ItemSelector';

interface Props {
  initialData?: DocumentData;
  documentId?: string;
}

export default function DocumentEditor({ initialData, documentId }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const isRTL = locale === 'ar';

  // ─── Document State ───────────────────────────────────────
  const [docType, setDocType] = useState<DocType>(initialData?.doc_type || 'OF');
  const [doc, setDoc] = useState<DocumentData>(initialData || createEmptyDocument('OF'));
  const [items, setItems] = useState<LineItem[]>(initialData?.items || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── Lookups ──────────────────────────────────────────────
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const config = DOC_TYPES[docType];

  // Load employees
  useEffect(() => {
    fetch('/api/documents/employees')
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees || []))
      .catch(() => {});
  }, []);

  // Recalculate totals when items change
  const totals = useMemo(() => {
    return calculateDocumentTotals(items, doc.vat_enabled, doc.vat_pct);
  }, [items, doc.vat_enabled, doc.vat_pct]);

  useEffect(() => {
    setDoc((prev) => ({
      ...prev,
      subtotal: totals.subtotal,
      discount_amount: totals.totalDiscount,
      vat_amount: totals.vatAmount,
      total: totals.total,
    }));
  }, [totals]);

  // ─── Doc Type Change ──────────────────────────────────────
  const handleDocTypeChange = (newType: DocType) => {
    if (documentId) return; // Can't change type on existing doc
    setDocType(newType);
    setDoc(createEmptyDocument(newType));
    setItems([]);
  };

  // ─── Item Management ──────────────────────────────────────
  const handleAddItem = useCallback((item: LineItem) => {
    const calc = calculateLineItem(item);
    const newItem = { ...item, ...calc, sortOrder: items.length + 1 };
    setItems((prev) => [...prev, newItem]);
  }, [items.length]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, sortOrder: idx + 1 })));
  }, []);

  const handleUpdateItem = useCallback((itemId: string, updates: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const updated = { ...item, ...updates };
        const calc = calculateLineItem(updated);
        return { ...updated, ...calc };
      })
    );
  }, []);

  // ─── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Validate discount guard on all items
    for (const item of items) {
      if (!item.discountAllowed) {
        setError(
          isRTL
            ? `الخصم على "${item.itemName}" يتجاوز الحد الأقصى المسموح به`
            : `Discount on "${item.itemName}" exceeds maximum allowed`
        );
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        ...doc,
        items: items.map((i) => ({
          item_type: i.itemType,
          item_id: i.itemId,
          item_name: i.itemName,
          item_unit: i.itemUnit,
          category: i.category,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          floor_price: i.floorPrice,
          target_price: i.targetPrice,
          discount_pct: i.discountPct,
          discount_amount: i.discountAmount,
          line_total: i.lineTotal,
          condition: i.condition,
          action_taken: i.actionTaken,
          notes: i.notes,
        })),
      };

      const url = documentId ? `/api/documents/${documentId}` : '/api/documents';
      const method = documentId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setSuccess(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
      if (!documentId && result.document?.id) {
        router.push(`/${locale}/documents/${result.document.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Field Update Helper ──────────────────────────────────
  const updateField = (field: keyof DocumentData, value: any) => {
    setDoc((prev) => ({ ...prev, [field]: value }));
  };

  // Warranty end auto-calc
  useEffect(() => {
    if (doc.warranty_start && doc.warranty_months) {
      const start = new Date(doc.warranty_start);
      start.setMonth(start.getMonth() + doc.warranty_months);
      updateField('warranty_end', start.toISOString().slice(0, 10));
    }
  }, [doc.warranty_start, doc.warranty_months]);

  // ─── RENDER ───────────────────────────────────────────────
  const label = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6">
      {/* ── Messages ── */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      {/* ── Doc Type Selector ── */}
      {!documentId && (
        <div className="flex flex-wrap gap-2">
          {DOC_TYPE_LIST.map((dt) => (
            <button
              key={dt}
              onClick={() => handleDocTypeChange(dt)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                docType === dt
                  ? 'bg-[#DBA935] text-[#3E3B3F] shadow-lg'
                  : 'bg-black/20 text-[#C0C0C0] border border-[#DBA935]/20 hover:border-[#DBA935]/50'
              }`}
            >
              {getDocTypeLabel(dt, locale)}
            </button>
          ))}
        </div>
      )}

      {/* ── Document Number & Date ── */}
      <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
        <h2 className="text-[#DBA935] font-bold text-lg mb-4">
          {documentId ? (doc.doc_number || '') : label('مستند جديد', 'New Document')}
          {' — '}
          {getDocTypeLabel(docType, locale)}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[#C0C0C0] text-sm mb-1">{label('التاريخ', 'Date')}</label>
            <input
              type="date"
              value={doc.doc_date}
              onChange={(e) => updateField('doc_date', e.target.value)}
              className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[#C0C0C0] text-sm mb-1">{label('الحالة', 'Status')}</label>
            <select
              value={doc.status}
              onChange={(e) => updateField('status', e.target.value)}
              className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
            >
              {DOC_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {isRTL ? s.labelAr : s.labelEn}
                </option>
              ))}
            </select>
          </div>
          {config.key === 'OF' && (
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('صالح حتى', 'Valid Until')}</label>
              <input
                type="date"
                value={doc.valid_until || ''}
                onChange={(e) => updateField('valid_until', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Client Selection ── */}
      <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
        <h3 className="text-[#DBA935] font-bold mb-3">{label('العميل', 'Client')}</h3>
        <CustomerSelector
          selectedClient={selectedClient}
          onSelect={(client) => {
            setSelectedClient(client);
            updateField('client_id', client.id);
          }}
          locale={locale}
        />
      </div>

      {/* ── Employee Assignment ── */}
      <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
        <h3 className="text-[#DBA935] font-bold mb-3">{label('الموظف المسؤول', 'Assigned Employee')}</h3>
        <select
          value={doc.assigned_employee || ''}
          onChange={(e) => updateField('assigned_employee', e.target.value || null)}
          className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
        >
          <option value="">{label('اختر موظف...', 'Select employee...')}</option>
          {employees
            .filter((emp) => {
              if (config.employeeRole === 'any') return true;
              return emp.role === config.employeeRole || emp.department === config.employeeRole;
            })
            .map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} — {emp.role || emp.department || ''}
              </option>
            ))}
        </select>
      </div>

      {/* ── Visit Fields (VR, REP) ── */}
      {config.hasVisitFields && (
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
          <h3 className="text-[#DBA935] font-bold mb-3">{label('بيانات الزيارة', 'Visit Details')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('تاريخ الزيارة', 'Visit Date')}</label>
              <input
                type="date"
                value={doc.visit_date || ''}
                onChange={(e) => updateField('visit_date', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('موقع الزيارة', 'Visit Location')}</label>
              <input
                type="text"
                value={doc.visit_location || ''}
                onChange={(e) => updateField('visit_location', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
                placeholder={label('العنوان أو الموقع', 'Address or location')}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[#C0C0C0] text-sm mb-1">{label('الملاحظات والنتائج', 'Findings')}</label>
            <textarea
              value={doc.findings || ''}
              onChange={(e) => updateField('findings', e.target.value)}
              rows={3}
              className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              placeholder={label('نتائج الفحص والملاحظات...', 'Inspection results and findings...')}
            />
          </div>
          <div className="mt-4">
            <label className="block text-[#C0C0C0] text-sm mb-1">{label('التوصيات', 'Recommendations')}</label>
            <textarea
              value={doc.recommendations || ''}
              onChange={(e) => updateField('recommendations', e.target.value)}
              rows={3}
              className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              placeholder={label('التوصيات والإجراءات المطلوبة...', 'Recommendations and required actions...')}
            />
          </div>
        </div>
      )}

      {/* ── Equipment Status (REP, HO) ── */}
      {config.hasEquipmentFields && (
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
          <h3 className="text-[#DBA935] font-bold mb-3">{label('حالة المعدات', 'Equipment Status')}</h3>
          <select
            value={doc.equipment_status || 'working'}
            onChange={(e) => updateField('equipment_status', e.target.value)}
            className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
          >
            {EQUIPMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {isRTL ? s.labelAr : s.labelEn}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Handover Fields (HO) ── */}
      {config.hasHandoverFields && (
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
          <h3 className="text-[#DBA935] font-bold mb-3">{label('بيانات التسليم والاستلام', 'Handover Details')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('المسلِّم', 'Handover From')}</label>
              <input
                type="text"
                value={doc.handover_from || ''}
                onChange={(e) => updateField('handover_from', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('المستلِم', 'Handover To')}</label>
              <input
                type="text"
                value={doc.handover_to || ''}
                onChange={(e) => updateField('handover_to', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Items Table (OF, IN, REP, HO) ── */}
      {config.hasItems && (
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
          <h3 className="text-[#DBA935] font-bold mb-3">{label('البنود', 'Items')}</h3>

          <ItemSelector onAddItem={handleAddItem} locale={locale} />

          {items.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#DBA935]/30 text-[#C0C0C0]">
                    <th className="py-2 px-2 text-start">#</th>
                    <th className="py-2 px-2 text-start">{label('البند', 'Item')}</th>
                    <th className="py-2 px-2 text-center">{label('الوحدة', 'Unit')}</th>
                    <th className="py-2 px-2 text-center">{label('الكمية', 'Qty')}</th>
                    <th className="py-2 px-2 text-center">{label('السعر', 'Price')}</th>
                    <th className="py-2 px-2 text-center">{label('خصم %', 'Disc %')}</th>
                    <th className="py-2 px-2 text-center">{label('الإجمالي', 'Total')}</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`border-b border-white/5 ${!item.discountAllowed ? 'bg-red-500/10' : ''}`}
                    >
                      <td className="py-2 px-2 text-[#C0C0C0]">{idx + 1}</td>
                      <td className="py-2 px-2 text-white">
                        <div className="font-medium">{item.itemName}</div>
                        <div className="text-xs text-[#C0C0C0]">{item.category}</div>
                      </td>
                      <td className="py-2 px-2 text-center text-[#C0C0C0]">{item.itemUnit}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 1 })
                          }
                          className="w-16 bg-black/30 border border-[#DBA935]/20 rounded px-2 py-1 text-white text-center focus:border-[#DBA935] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                          }
                          className="w-24 bg-black/30 border border-[#DBA935]/20 rounded px-2 py-1 text-white text-center focus:border-[#DBA935] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={(item.discountPct * 100).toFixed(1)}
                          onChange={(e) => {
                            const pct = (parseFloat(e.target.value) || 0) / 100;
                            handleUpdateItem(item.id, { discountPct: pct });
                          }}
                          className={`w-16 bg-black/30 border rounded px-2 py-1 text-center focus:outline-none ${
                            !item.discountAllowed
                              ? 'border-red-500 text-red-400'
                              : 'border-[#DBA935]/20 text-white focus:border-[#DBA935]'
                          }`}
                        />
                        {!item.discountAllowed && (
                          <div className="text-[0.6rem] text-red-400 mt-0.5">
                            {label('تجاوز الحد', 'Over limit')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center text-[#DBA935] font-medium">
                        {formatCurrency(item.lineTotal, locale)}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-400 hover:text-red-300 transition p-1"
                          title={label('حذف', 'Remove')}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Totals ── */}
          <div className="mt-4 flex justify-end">
            <div className="w-full md:w-72 space-y-2">
              <div className="flex justify-between text-[#C0C0C0]">
                <span>{label('المجموع', 'Subtotal')}</span>
                <span>{formatCurrency(totals.subtotal, locale)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>{label('الخصم', 'Discount')}</span>
                  <span>-{formatCurrency(totals.totalDiscount, locale)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[#C0C0C0]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doc.vat_enabled}
                    onChange={(e) => updateField('vat_enabled', e.target.checked)}
                    className="accent-[#DBA935]"
                  />
                  <span>{label('ضريبة القيمة المضافة', 'VAT')} ({(doc.vat_pct * 100).toFixed(0)}%)</span>
                </label>
                <span>{doc.vat_enabled ? formatCurrency(totals.vatAmount, locale) : '—'}</span>
              </div>
              <div className="flex justify-between text-[#DBA935] font-bold text-lg border-t border-[#DBA935]/30 pt-2">
                <span>{label('الإجمالي', 'Total')}</span>
                <span>
                  {formatCurrency(totals.total, locale)} {label('ج.م', 'EGP')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment (OF, IN, REP) ── */}
      {config.hasPayment && (
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
          <h3 className="text-[#DBA935] font-bold mb-3">{label('بيانات الدفع', 'Payment Details')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {config.key === 'OF' && (
              <div>
                <label className="block text-[#C0C0C0] text-sm mb-1">{label('حالة العرض', 'Offer Status')}</label>
                <select
                  value={doc.offer_status || 'draft'}
                  onChange={(e) => updateField('offer_status', e.target.value)}
                  className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
                >
                  {OFFER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {isRTL ? s.labelAr : s.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('حالة الدفع', 'Payment Status')}</label>
              <select
                value={doc.payment_status || 'unpaid'}
                onChange={(e) => updateField('payment_status', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {isRTL ? s.labelAr : s.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('طريقة الدفع', 'Payment Method')}</label>
              <select
                value={doc.payment_method || ''}
                onChange={(e) => updateField('payment_method', e.target.value || null)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              >
                <option value="">{label('اختر...', 'Select...')}</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {isRTL ? m.labelAr : m.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('تاريخ الاستحقاق', 'Due Date')}</label>
              <input
                type="date"
                value={doc.due_date || ''}
                onChange={(e) => updateField('due_date', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('المبلغ المدفوع', 'Paid Amount')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={doc.paid_amount}
                onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Warranty (OF, IN, REP, HO) ── */}
      {config.hasWarranty && (
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
          <h3 className="text-[#DBA935] font-bold mb-3">{label('الضمان', 'Warranty')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('مدة الضمان (شهر)', 'Warranty (months)')}</label>
              <input
                type="number"
                min="0"
                value={doc.warranty_months}
                onChange={(e) => updateField('warranty_months', parseInt(e.target.value) || 0)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('بداية الضمان', 'Warranty Start')}</label>
              <input
                type="date"
                value={doc.warranty_start || ''}
                onChange={(e) => updateField('warranty_start', e.target.value)}
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#C0C0C0] text-sm mb-1">{label('نهاية الضمان', 'Warranty End')}</label>
              <input
                type="date"
                value={doc.warranty_end || ''}
                readOnly
                className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-[#C0C0C0] cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Notes & Terms ── */}
      <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
        <h3 className="text-[#DBA935] font-bold mb-3">{label('ملاحظات وشروط', 'Notes & Terms')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[#C0C0C0] text-sm mb-1">{label('ملاحظات للعميل', 'Client Notes')}</label>
            <textarea
              value={doc.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[#C0C0C0] text-sm mb-1">{label('ملاحظات داخلية', 'Internal Notes')}</label>
            <textarea
              value={doc.internal_notes || ''}
              onChange={(e) => updateField('internal_notes', e.target.value)}
              rows={3}
              className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
              placeholder={label('ملاحظات للفريق فقط...', 'Team only notes...')}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-[#C0C0C0] text-sm mb-1">{label('الشروط والأحكام', 'Terms & Conditions')}</label>
          <textarea
            value={doc.terms || ''}
            onChange={(e) => updateField('terms', e.target.value)}
            rows={4}
            className="w-full bg-black/30 border border-[#DBA935]/20 rounded-xl px-3 py-2 text-white focus:border-[#DBA935] focus:outline-none"
          />
        </div>
      </div>

      {/* ── Linked Documents ── */}
      <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-[#DBA935]/20 p-4 md:p-6">
        <h3 className="text-[#DBA935] font-bold mb-3">{label('ربط المستندات', 'Linked Documents')}</h3>
        <p className="text-[#C0C0C0] text-sm">
          {label(
            'يمكنك ربط هذا المستند بعرض سعر أو فاتورة سابقة لتتبع سير العمل',
            'Link this document to a previous offer or invoice for workflow tracking'
          )}
        </p>
        {doc.parent_doc_id && (
          <div className="mt-2 bg-[#DBA935]/10 rounded-lg px-3 py-2 text-sm text-[#DBA935]">
            {label('مرتبط بالمستند', 'Linked to document')}: {doc.parent_doc_id}
          </div>
        )}
      </div>

      {/* ── Save Button ── */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl border border-[#C0C0C0]/30 text-[#C0C0C0] hover:border-[#C0C0C0]/60 transition"
        >
          {label('إلغاء', 'Cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition disabled:opacity-50 shadow-lg"
        >
          {saving
            ? label('جاري الحفظ...', 'Saving...')
            : documentId
            ? label('تحديث المستند', 'Update Document')
            : label('إنشاء المستند', 'Create Document')}
        </button>
      </div>
    </div>
  );
}
