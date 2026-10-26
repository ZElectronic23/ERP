'use client';

import { useRef } from 'react';
import {
  DocumentData, LineItem, DOC_TYPES, DocType,
  COMPANY, BRAND, formatCurrency,
  OFFER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS,
  DOC_STATUSES, EQUIPMENT_STATUSES,
} from '@/lib/documents';

interface ClientInfo {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface EmployeeInfo {
  name: string;
  role?: string;
  phone?: string;
}

interface DocumentPreviewProps {
  document: DocumentData;
  client?: ClientInfo | null;
  employee?: EmployeeInfo | null;
  locale?: string;
}

const label = (locale: string, ar: string, en: string) =>
  locale === 'ar' ? ar : en;

const fmtDate = (d: string | null, locale: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return d;
  }
};

const statusLabel = (value: string | null, lists: readonly { value: string; labelAr: string; labelEn: string }[], locale: string) => {
  if (!value) return '—';
  const found = lists.find(s => s.value === value);
  return found ? (locale === 'ar' ? found.labelAr : found.labelEn) : value;
};

export default function DocumentPreview({ document: doc, client, employee, locale = 'ar' }: DocumentPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isRTL = locale === 'ar';
  const t = (ar: string, en: string) => label(locale, ar, en);
  const config = DOC_TYPES[doc.doc_type];

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${locale}">
<head>
<meta charset="utf-8"/>
<title>${doc.doc_number || config.labelEn}</title>
<link href="https://fonts.googleapis.com/css2?family=Alata&family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'Cairo', sans-serif; background: #fff; color: #222; }
  @media print {
    @page { margin: 10mm; size: A4; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div>
      {/* Print/Download Button */}
      <div className="flex gap-3 mb-4 no-print">
        <button
          onClick={handlePrint}
          className="px-6 py-2.5 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          {t('طباعة / تحميل PDF', 'Print / Download PDF')}
        </button>
      </div>

      {/* Print Preview Content */}
      <div
        ref={printRef}
        className="bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Cairo', sans-serif", direction: isRTL ? 'rtl' : 'ltr', maxWidth: '210mm' }}
      >
        {/* ═══ HEADER ═══ */}
        <div style={{ background: `linear-gradient(135deg, ${BRAND.charcoal} 0%, #2a2729 100%)`, padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Logo + Company Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/logo.png" alt="Z.Electronic" style={{ height: '56px', width: 'auto' }} />
              <div>
                <h1 style={{ fontFamily: "'Alata', sans-serif", color: BRAND.gold, fontSize: '22px', fontWeight: 700, margin: 0 }}>
                  Z.Electronic
                </h1>
                <p style={{ color: BRAND.silver, fontSize: '11px', margin: '2px 0 0 0' }}>
                  Technology Services & Solutions
                </p>
              </div>
            </div>
            {/* Doc Type Badge */}
            <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
              <div style={{
                background: BRAND.gold, color: BRAND.charcoal,
                padding: '8px 20px', borderRadius: '12px',
                fontWeight: 700, fontSize: '16px',
                fontFamily: "'Cairo', sans-serif",
              }}>
                {isRTL ? config.labelAr : config.labelEn}
              </div>
              {doc.doc_number && (
                <p style={{ color: BRAND.gold, fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
                  {doc.doc_number}
                </p>
              )}
            </div>
          </div>
          {/* Company Info Bar */}
          <div style={{
            marginTop: '12px', paddingTop: '12px',
            borderTop: `1px solid ${BRAND.gold}33`,
            display: 'flex', flexWrap: 'wrap', gap: '16px',
            color: BRAND.silver, fontSize: '10px',
          }}>
            <span>📍 {isRTL ? COMPANY.addressAr : COMPANY.address}</span>
            <span>📞 {COMPANY.phone}</span>
            <span>✉ {COMPANY.email}</span>
            <span>C.R: {COMPANY.cr}</span>
          </div>
        </div>

        {/* Gold separator */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${BRAND.gold}, ${BRAND.gold}44, ${BRAND.gold})` }} />

        {/* ═══ DOCUMENT INFO GRID ═══ */}
        <div style={{ padding: '20px 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Client Info */}
            <div style={{
              background: '#f8f7f5', borderRadius: '12px', padding: '16px',
              border: `1px solid ${BRAND.gold}22`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                {t('بيانات العميل', 'Client Information')}
              </h3>
              {client ? (
                <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                  <p style={{ fontWeight: 600 }}>{client.name}</p>
                  {client.company && <p>{client.company}</p>}
                  {client.phone && <p>📞 {client.phone}</p>}
                  {client.email && <p>✉ {client.email}</p>}
                  {client.address && <p>📍 {client.address}</p>}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: '#999' }}>{t('لم يتم تحديد عميل', 'No client assigned')}</p>
              )}
            </div>

            {/* Document Details */}
            <div style={{
              background: '#f8f7f5', borderRadius: '12px', padding: '16px',
              border: `1px solid ${BRAND.gold}22`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                {t('تفاصيل المستند', 'Document Details')}
              </h3>
              <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                <p><strong>{t('التاريخ:', 'Date:')}</strong> {fmtDate(doc.doc_date, locale)}</p>
                {doc.valid_until && (
                  <p><strong>{t('صالح حتى:', 'Valid Until:')}</strong> {fmtDate(doc.valid_until, locale)}</p>
                )}
                {doc.offer_status && (
                  <p><strong>{t('الحالة:', 'Status:')}</strong> {statusLabel(doc.offer_status, OFFER_STATUSES, locale)}</p>
                )}
                {employee && (
                  <p><strong>{t('المسؤول:', 'Assigned:')}</strong> {employee.name}{employee.role ? ` (${employee.role})` : ''}</p>
                )}
                <p><strong>{t('العملة:', 'Currency:')}</strong> {doc.currency} {doc.currency !== 'EGP' ? `(${t('سعر الصرف:', 'Rate:')} ${doc.exchange_rate})` : ''}</p>
              </div>
            </div>
          </div>

          {/* ═══ VISIT FIELDS (VR, REP) ═══ */}
          {config.hasVisitFields && (
            <div style={{
              background: '#f8f7f5', borderRadius: '12px', padding: '16px', marginBottom: '20px',
              border: `1px solid ${BRAND.gold}22`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                {t('بيانات الزيارة', 'Visit Details')}
              </h3>
              <div style={{ fontSize: '12px', lineHeight: '1.8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {doc.visit_date && <p><strong>{t('تاريخ الزيارة:', 'Visit Date:')}</strong> {fmtDate(doc.visit_date, locale)}</p>}
                {doc.visit_location && <p><strong>{t('الموقع:', 'Location:')}</strong> {doc.visit_location}</p>}
              </div>
              {doc.findings && (
                <div style={{ marginTop: '8px' }}>
                  <p style={{ fontWeight: 600, fontSize: '12px' }}>{t('النتائج والملاحظات:', 'Findings:')}</p>
                  <p style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{doc.findings}</p>
                </div>
              )}
              {doc.recommendations && (
                <div style={{ marginTop: '8px' }}>
                  <p style={{ fontWeight: 600, fontSize: '12px' }}>{t('التوصيات:', 'Recommendations:')}</p>
                  <p style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{doc.recommendations}</p>
                </div>
              )}
              {config.hasEquipmentFields && doc.equipment_status && (
                <p style={{ marginTop: '8px', fontSize: '12px' }}>
                  <strong>{t('حالة الجهاز:', 'Equipment Status:')}</strong>{' '}
                  {statusLabel(doc.equipment_status, EQUIPMENT_STATUSES, locale)}
                </p>
              )}
            </div>
          )}

          {/* ═══ HANDOVER FIELDS (HO) ═══ */}
          {config.hasHandoverFields && (
            <div style={{
              background: '#f8f7f5', borderRadius: '12px', padding: '16px', marginBottom: '20px',
              border: `1px solid ${BRAND.gold}22`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                {t('بيانات التسليم', 'Handover Details')}
              </h3>
              <div style={{ fontSize: '12px', lineHeight: '1.8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {doc.handover_from && <p><strong>{t('تسليم من:', 'From:')}</strong> {doc.handover_from}</p>}
                {doc.handover_to && <p><strong>{t('تسليم إلى:', 'To:')}</strong> {doc.handover_to}</p>}
              </div>
            </div>
          )}

          {/* ═══ ITEMS TABLE ═══ */}
          {config.hasItems && doc.items.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: BRAND.charcoal, fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                {t('البنود والأصناف', 'Items & Services')}
              </h3>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: '11px',
                border: `1px solid ${BRAND.gold}33`,
              }}>
                <thead>
                  <tr style={{ background: BRAND.charcoal, color: '#fff' }}>
                    <th style={thStyle}>#</th>
                    <th style={{ ...thStyle, textAlign: isRTL ? 'right' : 'left', minWidth: '160px' }}>{t('الصنف', 'Item')}</th>
                    <th style={thStyle}>{t('الوحدة', 'Unit')}</th>
                    <th style={thStyle}>{t('الكمية', 'Qty')}</th>
                    <th style={thStyle}>{t('سعر الوحدة', 'Unit Price')}</th>
                    {doc.items.some(i => i.discountPct > 0) && (
                      <th style={thStyle}>{t('الخصم %', 'Disc %')}</th>
                    )}
                    <th style={thStyle}>{t('الإجمالي', 'Total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9f8f6' }}>
                      <td style={tdStyle}>{idx + 1}</td>
                      <td style={{ ...tdStyle, textAlign: isRTL ? 'right' : 'left' }}>
                        <span style={{ fontWeight: 600 }}>{item.itemName}</span>
                        {item.category && (
                          <span style={{ display: 'block', fontSize: '10px', color: '#888' }}>{item.category}</span>
                        )}
                      </td>
                      <td style={tdStyle}>{item.itemUnit}</td>
                      <td style={tdStyle}>{item.quantity}</td>
                      <td style={tdStyle}>{formatCurrency(item.unitPrice, locale)}</td>
                      {doc.items.some(i => i.discountPct > 0) && (
                        <td style={{ ...tdStyle, color: item.discountPct > 0 ? '#c0392b' : 'inherit' }}>
                          {item.discountPct > 0 ? `${(item.discountPct * 100).toFixed(1)}%` : '—'}
                        </td>
                      )}
                      <td style={{ ...tdStyle, fontWeight: 600, color: BRAND.charcoal }}>
                        {formatCurrency(item.lineTotal, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ═══ TOTALS ═══ */}
              <div style={{
                marginTop: '0', display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end',
              }}>
                <div style={{
                  width: '280px', background: '#f8f7f5',
                  border: `1px solid ${BRAND.gold}33`,
                  borderTop: 'none', borderRadius: '0 0 12px 12px',
                  padding: '12px 16px', fontSize: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>{t('المجموع الفرعي:', 'Subtotal:')}</span>
                    <span>{formatCurrency(doc.subtotal, locale)} {t('ج.م', 'EGP')}</span>
                  </div>
                  {doc.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#c0392b' }}>
                      <span>{t('الخصم:', 'Discount:')}</span>
                      <span>-{formatCurrency(doc.discount_amount, locale)} {t('ج.م', 'EGP')}</span>
                    </div>
                  )}
                  {doc.vat_enabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>{t(`ضريبة القيمة المضافة (${(doc.vat_pct * 100).toFixed(0)}%):`, `VAT (${(doc.vat_pct * 100).toFixed(0)}%):`)}</span>
                      <span>{formatCurrency(doc.vat_amount, locale)} {t('ج.م', 'EGP')}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderTop: `2px solid ${BRAND.gold}`,
                    paddingTop: '8px', marginTop: '4px',
                    fontWeight: 700, fontSize: '14px', color: BRAND.charcoal,
                  }}>
                    <span>{t('الإجمالي الكلي:', 'Grand Total:')}</span>
                    <span style={{ color: BRAND.gold }}>{formatCurrency(doc.total, locale)} {t('ج.م', 'EGP')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ PAYMENT INFO ═══ */}
          {config.hasPayment && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px',
            }}>
              {/* Payment Status */}
              <div style={{
                background: '#f8f7f5', borderRadius: '12px', padding: '16px',
                border: `1px solid ${BRAND.gold}22`,
              }}>
                <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  {t('بيانات الدفع', 'Payment Information')}
                </h3>
                <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                  {doc.payment_status && (
                    <p><strong>{t('حالة الدفع:', 'Payment Status:')}</strong> {statusLabel(doc.payment_status, PAYMENT_STATUSES, locale)}</p>
                  )}
                  {doc.payment_method && (
                    <p><strong>{t('طريقة الدفع:', 'Payment Method:')}</strong> {statusLabel(doc.payment_method, PAYMENT_METHODS, locale)}</p>
                  )}
                  {doc.due_date && (
                    <p><strong>{t('تاريخ الاستحقاق:', 'Due Date:')}</strong> {fmtDate(doc.due_date, locale)}</p>
                  )}
                  {doc.paid_amount > 0 && (
                    <p><strong>{t('المبلغ المدفوع:', 'Paid Amount:')}</strong> {formatCurrency(doc.paid_amount, locale)} {t('ج.م', 'EGP')}</p>
                  )}
                  {doc.total > 0 && doc.paid_amount > 0 && doc.paid_amount < doc.total && (
                    <p style={{ color: '#c0392b' }}>
                      <strong>{t('المتبقي:', 'Remaining:')}</strong> {formatCurrency(doc.total - doc.paid_amount, locale)} {t('ج.م', 'EGP')}
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Methods Box */}
              <div style={{
                background: '#f8f7f5', borderRadius: '12px', padding: '16px',
                border: `1px solid ${BRAND.gold}22`,
              }}>
                <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  {t('طرق الدفع المتاحة', 'Available Payment Methods')}
                </h3>
                <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
                  <p>💳 <strong>Instapay:</strong> {COMPANY.instapay}</p>
                  <p>🏦 <strong>{t('تحويل بنكي:', 'Bank Transfer:')}</strong> {COMPANY.bank}</p>
                  <p style={{ paddingInlineStart: '20px' }}>{t('رقم الحساب:', 'Account:')} {COMPANY.bankAccount}</p>
                </div>
                {/* Instapay QR */}
                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                  <img src="/qr-instapay.png" alt="Instapay QR" style={{ height: '80px', width: '80px', display: 'inline-block' }} />
                  <p style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>Instapay QR</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ WARRANTY ═══ */}
          {config.hasWarranty && doc.warranty_start && (
            <div style={{
              background: `linear-gradient(135deg, ${BRAND.charcoal}11, ${BRAND.gold}11)`,
              borderRadius: '12px', padding: '16px', marginBottom: '20px',
              border: `1px solid ${BRAND.gold}33`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                🛡️ {t('شهادة الضمان', 'Warranty Certificate')}
              </h3>
              <div style={{ fontSize: '12px', lineHeight: '1.8', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <p><strong>{t('مدة الضمان:', 'Duration:')}</strong> {doc.warranty_months} {t('شهر', 'months')}</p>
                <p><strong>{t('بداية الضمان:', 'Start:')}</strong> {fmtDate(doc.warranty_start, locale)}</p>
                <p><strong>{t('نهاية الضمان:', 'End:')}</strong> {fmtDate(doc.warranty_end, locale)}</p>
              </div>
            </div>
          )}

          {/* ═══ TERMS & NOTES ═══ */}
          {doc.terms && (
            <div style={{
              background: '#f8f7f5', borderRadius: '12px', padding: '16px', marginBottom: '20px',
              border: `1px solid ${BRAND.gold}22`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                {t('الشروط والأحكام', 'Terms & Conditions')}
              </h3>
              <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#555' }}>
                {doc.terms}
              </div>
            </div>
          )}

          {doc.notes && (
            <div style={{
              background: '#f8f7f5', borderRadius: '12px', padding: '16px', marginBottom: '20px',
              border: `1px solid ${BRAND.gold}22`,
            }}>
              <h3 style={{ color: BRAND.gold, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                {t('ملاحظات', 'Notes')}
              </h3>
              <p style={{ fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#555' }}>
                {doc.notes}
              </p>
            </div>
          )}

          {/* ═══ SIGNATURES ═══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px',
            marginBottom: '24px', marginTop: '24px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: `1px solid ${BRAND.charcoal}`, marginBottom: '8px', height: '40px' }} />
              <p style={{ fontSize: '12px', fontWeight: 600 }}>
                {t('توقيع العميل', 'Client Signature')}
              </p>
              <p style={{ fontSize: '10px', color: '#888' }}>{client?.name || ''}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: `1px solid ${BRAND.charcoal}`, marginBottom: '8px', height: '40px' }} />
              <p style={{ fontSize: '12px', fontWeight: 600 }}>
                {t('توقيع Z.Electronic', 'Z.Electronic Signature')}
              </p>
              <p style={{ fontSize: '10px', color: '#888' }}>{employee?.name || ''}</p>
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          background: BRAND.charcoal, padding: '20px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '16px',
        }}>
          {/* Policy Link */}
          <div style={{ fontSize: '10px', color: BRAND.silver, maxWidth: '300px' }}>
            <p style={{ fontWeight: 600, color: BRAND.gold, marginBottom: '4px' }}>
              {t('سياسة العملاء', 'Client Policies')}
            </p>
            <p>{COMPANY.policyUrl}</p>
            <p style={{ marginTop: '8px' }}>{t('شكراً لتعاملكم معنا', 'Thank you for choosing Z.Electronic')}</p>
          </div>

          {/* QR Codes */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <img src="/qr-links.png" alt="Z.Electronic Links" style={{ height: '64px', width: '64px' }} />
              <p style={{ fontSize: '8px', color: BRAND.silver, marginTop: '2px' }}>
                {t('روابطنا', 'Our Links')}
              </p>
            </div>
            {config.hasPayment && (
              <div style={{ textAlign: 'center' }}>
                <img src="/qr-instapay.png" alt="Instapay" style={{ height: '64px', width: '64px' }} />
                <p style={{ fontSize: '8px', color: BRAND.silver, marginTop: '2px' }}>Instapay</p>
              </div>
            )}
          </div>

          {/* Company Logo Small */}
          <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
            <img src="/logo.png" alt="Z.Electronic" style={{ height: '32px', opacity: 0.7 }} />
            <p style={{ fontSize: '9px', color: BRAND.silver, marginTop: '4px' }}>
              © {new Date().getFullYear()} Z.Electronic
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Table Styles ───
const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: '11px',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'center',
  borderBottom: '1px solid #eee',
  fontSize: '11px',
};
