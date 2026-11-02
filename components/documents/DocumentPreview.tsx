'use client';

import { useRef, useState } from 'react';
import { DocumentData, DOC_TYPES, COMPANY, BRAND } from '@/lib/documents';

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

const label = (locale: string, ar: string, en: string) => (locale === 'ar' ? ar : en);

// The official template always uses Western digits + DD/MM/YYYY (as in the reference designs).
const fmtDate = (d: string | null, _locale?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return d;
  }
};

export default function DocumentPreview({ document: doc, client, employee, locale = 'ar' }: DocumentPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isRTL = locale === 'ar';
  const t = (ar: string, en: string) => label(locale, ar, en);
  const config = DOC_TYPES[doc.doc_type];
  const [pdfBusy, setPdfBusy] = useState(false);

  const isInvoice = doc.doc_type === 'IN';
  // The official template uses English labels in a LTR layout (only item descriptions are Arabic),
  // matching the attached reference designs exactly.
  const title = isInvoice ? 'Invoice' : (doc.doc_type === 'OF' ? 'OFFER' : config.labelEn);
  const docNoLabel = isInvoice ? 'Invoice No :' : 'Offer No :';
  const discPct = doc.subtotal > 0 ? Math.round((doc.discount_amount / doc.subtotal) * 100) : 0;
  const phone = COMPANY.phone.replace('+20-', '0');
  const email = COMPANY.email.toLowerCase();
  // Western numerals, matching the reference invoices exactly.
  const money = (n: number) => `EGP ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
  const totalPlain = (n: number) => new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 3 }).format(n || 0);

  const handleDownloadPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    setPdfBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = 210, ph = 297, imgH = canvas.height * pw / canvas.width;
      let left = imgH, pos = 0;
      pdf.addImage(img, 'PNG', 0, pos, pw, imgH, undefined, 'FAST'); left -= ph;
      while (left > 0) { pos = left - imgH; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, pw, imgH, undefined, 'FAST'); left -= ph; }
      pdf.save(`${doc.doc_number || config.labelEn}.pdf`);
    } catch (e) {
      console.error(e);
      alert(t('تعذّر إنشاء PDF — استخدم الطباعة ثم «حفظ كـ PDF».', 'PDF export failed — use Print then "Save as PDF".'));
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html dir="ltr" lang="${locale}">
<head>
<meta charset="utf-8"/>
<title>${doc.doc_number || config.labelEn}</title>
<link href="https://fonts.googleapis.com/css2?family=Alata&family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'Cairo', sans-serif; background: #fff; color: #222; }
  @media print {
    @page { margin: 0; size: A4; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 450);
  };

  return (
    <div>
      {/* Print / Download buttons */}
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        <button
          onClick={handlePrint}
          className="px-5 py-2.5 rounded-xl bg-[#3E3B3F] text-white font-bold hover:bg-[#2a2729] transition shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          {t('معاينة وطباعة', 'Preview & Print')}
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfBusy}
          className="px-5 py-2.5 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition shadow-lg disabled:opacity-50 flex items-center gap-2"
        >
          ⬇ {pdfBusy ? t('جارٍ التجهيز...', 'Preparing...') : t('تحميل PDF', 'Download PDF')}
        </button>
        <span className="self-center text-[#C0C0C0] text-xs">{t('هذه معاينة مطابقة تماماً للملف الذي سيُطبع/يُحمَّل.', 'This preview matches the printed/PDF file exactly.')}</span>
      </div>

      {/* ═══ PRINTABLE TEMPLATE (matches the official Z.Electronic Offer/Invoice design) ═══ */}
      <div
        ref={printRef}
        className="bg-white"
        style={{ fontFamily: "'Cairo', sans-serif", direction: 'ltr', width: '210mm', minHeight: '297mm', color: '#222', position: 'relative', overflow: 'hidden', margin: '0 auto' }}
      >
        {/* ── HEADER (flag left, QR right — as per the reference) ── */}
        <div style={{ position: 'relative', height: '190px' }}>
          {/* gold accent bar top-right */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: '46%', height: '14px', background: BRAND.gold }} />
          {/* dark pennant flag with the gold company emblem (left) */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '220px', background: BRAND.charcoal, clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)', padding: '18px 20px 40px', textAlign: 'center' }}>
            <img src="/assets/images/logo-emblem.png" alt="Z.Electronic" style={{ width: '150px', height: 'auto', margin: '0 auto', display: 'block' }} />
          </div>
          {/* big title */}
          <div style={{ textAlign: 'center', paddingTop: '48px' }}>
            <h1 style={{ fontFamily: "'Alata', sans-serif", color: BRAND.charcoal, fontSize: '52px', lineHeight: 1, margin: 0 }}>{title}</h1>
            {isInvoice && !doc.vat_enabled && (
              <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '2px' }}>Prices are exclusive of tax</div>
            )}
            <div style={{ marginTop: '12px', fontSize: '15px' }}><span style={{ color: '#666' }}>Date : </span><b>{fmtDate(doc.doc_date, locale)}</b></div>
          </div>
          {/* QR top-right */}
          <img src="/qr-links.png" alt="QR" style={{ position: 'absolute', top: '26px', right: '30px', width: '94px', height: '94px' }} />
        </div>

        {/* ── OFFER TO (left) / TOTAL DUE (right) ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 40px 0' }}>
          <div>
            <div style={{ color: BRAND.charcoal, fontWeight: 700, fontSize: '15px' }}>OFFER TO :</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', direction: isRTL ? 'rtl' : 'ltr' }}>{client?.name || '—'}</div>
            <div style={{ width: '200px', height: '4px', background: BRAND.gold, marginTop: '8px' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: BRAND.charcoal, fontWeight: 700, fontSize: '15px' }}>TOTAL DUE :</div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '12px' }}>{money(doc.total)}</div>
          </div>
        </div>

        {/* ── Doc number ── */}
        <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '15px' }}>
          <span style={{ color: '#666' }}>{docNoLabel} </span><b>{doc.doc_number || '—'}</b>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div style={{ padding: '10px 32px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: BRAND.charcoal, color: BRAND.gold }}>
                <th style={{ ...thStyle, textAlign: 'center', width: '52%', fontSize: '15px' }}>Description</th>
                <th style={{ ...thStyle, fontSize: '15px' }}>Qty</th>
                <th style={{ ...thStyle, fontSize: '15px' }}>Price</th>
                <th style={{ ...thStyle, fontSize: '15px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 ? '#ececec' : '#f6f6f6' }}>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, direction: 'rtl' }}>{item.itemName}</td>
                  <td style={tdStyle}>{item.quantity}</td>
                  <td style={tdStyle}>{money(item.unitPrice)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {config.hasItems && (
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#666', marginTop: '5px', direction: 'rtl' }}>
              عدد مرات تقديم الخدمة / عدد وحدات من المنتج = QTY
            </div>
          )}
        </div>

        {/* ── BOTTOM: payment (left) + totals (right) ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 32px 70px', gap: '24px' }}>
          {/* Payment method */}
          <div style={{ fontSize: '11px', maxWidth: '330px', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Payment Method</div>
            <div><i>Instapay :</i> {COMPANY.instapay}</div>
            <div><i>Cash</i></div>
            <div><b>Bank Name:</b> {COMPANY.bank}</div>
            <div><b>Account Number:</b> {COMPANY.bankAccount}</div>
            <div><b>Beneficiary Name:</b> {COMPANY.instapay}</div>
            <img src="/qr-instapay.png" alt="Instapay" style={{ width: '82px', height: '82px', marginTop: '6px' }} />
            {config.hasWarranty && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>Warranty Terms</div>
                <div style={{ color: '#555', whiteSpace: 'pre-wrap' }}>{doc.terms || '-One-year warranty from invoice date on software and hardware.\n-Three months free maintenance (excluding spare parts /visit).'}</div>
              </div>
            )}
            <div style={{ marginTop: '8px', fontWeight: 700, fontSize: '13px' }}>Policies Center</div>
            <div style={{ color: '#555' }}>Please review all company policies before the transfer.</div>
          </div>

          {/* Totals */}
          <div style={{ textAlign: 'right', minWidth: '250px' }}>
            <div style={{ fontSize: '13px', marginBottom: '4px' }}><span style={{ color: '#666' }}>Sub-total : </span>{money(doc.subtotal)}</div>
            {doc.discount_amount > 0 && doc.notes && (
              <div style={{ fontSize: '13px', marginBottom: '4px', direction: isRTL ? 'rtl' : 'ltr' }}><span style={{ color: '#666' }}>Dis-Reason : </span>{(doc.notes || '').split('\n')[0]}</div>
            )}
            {doc.discount_amount > 0 && (
              <div style={{ fontSize: '13px', marginBottom: '6px' }}><span style={{ color: '#666' }}>Dis : </span>{discPct}%</div>
            )}
            {doc.vat_enabled && (
              <div style={{ fontSize: '13px', marginBottom: '6px' }}><span style={{ color: '#666' }}>VAT ({(doc.vat_pct * 100).toFixed(0)}%) : </span>{money(doc.vat_amount)}</div>
            )}
            <div style={{ background: BRAND.charcoal, color: BRAND.gold, fontWeight: 700, fontSize: '18px', padding: '8px 18px', borderRadius: '4px', display: 'inline-block' }}>
              Total : {totalPlain(doc.total)}
            </div>
            {/* Official company stamp (C.R: 257524) */}
            <div style={{ marginTop: '14px' }}>
              <img src="/assets/images/seal.svg" alt="Z.Electronic Official Stamp" style={{ height: '96px', width: '96px', display: 'inline-block' }} />
              <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>CEO</div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%' }}>
          <div style={{ height: '12px', background: BRAND.gold, clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 100%)' }} />
          <div style={{ background: BRAND.charcoal, display: 'flex', justifyContent: 'center', gap: '48px', padding: '10px', fontSize: '13px', color: '#fff', fontWeight: 600 }}>
            <span>📞 {phone}</span>
            <span>✉ {email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Table cell styles ───
const thStyle: React.CSSProperties = {
  padding: '9px 10px',
  textAlign: 'center',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'center',
  fontSize: '12px',
};
