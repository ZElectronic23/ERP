'use client';

import { useRef, useState, useEffect } from 'react';
import { COMPANY, BRAND } from '@/lib/documents';

interface CertItem { name: string; qty?: number; unit?: string; type?: string; }

interface Props {
    invoiceNo: string;
    customerName: string;
    issueDate: string;
    items?: CertItem[];
    locale?: string;
}

function certNumber(invoiceNo: string, issueDate: string): string {
    const year = (issueDate ? new Date(issueDate) : new Date()).getFullYear();
    const seq = invoiceNo.match(/(\d+)\s*\//)?.[1] || invoiceNo.match(/(\d+)\s*$/)?.[1] || '0000';
    return `W-${year}-${seq.padStart(4, '0')}`;
}

export default function WarrantyCertificate({ invoiceNo, customerName, issueDate, items = [], locale = 'ar' }: Props) {
    const certRef = useRef<HTMLDivElement>(null);
    const isAr = locale === 'ar';
    const t = (ar: string, en: string) => (isAr ? ar : en);
    const certNo = certNumber(invoiceNo, issueDate);
    const issued = issueDate ? new Date(issueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
    const [qr, setQr] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const QR: any = await import('qrcode');
                setQr(await QR.toDataURL(COMPANY.policyUrl, { margin: 1, width: 240, color: { dark: BRAND.charcoal, light: '#ffffff' } }));
            } catch { }
        })();
    }, []);

    // per-item warranty: new device/owned software = 12mo; used/imported/third-party = 6mo (heuristic from name/category)
    const isUsed = (s: string) => /مستعمل|استيراد|used|import|طرف ثالث|third/i.test(s || '');
    const itemRows = (items.length ? items : [{ name: t('كامل بنود الفاتورة', 'All invoice items'), qty: 1 }]).map(it => ({
        name: it.name, qty: it.qty ?? 1, unit: it.unit || '',
        isUsed: isUsed(it.name) || isUsed(it.type || ''),
    }));

    const printCert = () => {
        const el = certRef.current; if (!el) return;
        const w = window.open('', '_blank', 'width=1200,height=850'); if (!w) return;
        w.document.write(`<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${locale}"><head><meta charset="utf-8"/><title>${certNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}html,body{background:#fff}@media print{@page{size:A4 landscape;margin:6mm}}</style>
</head><body>${el.outerHTML}</body></html>`);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 500);
    };

    const downloadPdf = async () => {
        const el = certRef.current; if (!el) return;
        setBusy(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
            const img = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pw = 297, ph = 210, imgH = canvas.height * pw / canvas.width;
            let left = imgH, pos = 0;
            pdf.addImage(img, 'PNG', 0, pos, pw, imgH, undefined, 'FAST'); left -= ph;
            while (left > 0) { pos = left - imgH; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, pw, imgH, undefined, 'FAST'); left -= ph; }
            pdf.save(`${certNo}.pdf`);
        } catch (e) {
            console.error(e);
            alert(t('تعذّر إنشاء PDF — استخدم زر الطباعة ثم «حفظ كـ PDF».', 'PDF export failed — use Print then "Save as PDF".'));
        } finally { setBusy(false); }
    };

    const th: React.CSSProperties = { padding: '8px 10px', color: '#fff', fontWeight: 700, fontSize: '12px', background: BRAND.charcoal };
    const td: React.CSSProperties = { padding: '7px 10px', fontSize: '11.5px', borderBottom: '1px solid #ece4d2', color: '#2a2729', verticalAlign: 'middle' };

    return (
        <div>
            <div className="flex flex-wrap gap-3 mb-4">
                <button onClick={printCert} className="px-5 py-2.5 rounded-xl bg-[#3E3B3F] text-white font-bold hover:bg-[#2a2729] transition shadow-lg">🖨 {t('طباعة', 'Print')}</button>
                <button onClick={downloadPdf} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition shadow-lg disabled:opacity-50">⬇ {busy ? t('جارٍ التجهيز...', 'Preparing...') : t('تحميل PDF', 'Download PDF')}</button>
                <span className="self-center text-[#C0C0C0] text-xs">{t('هذه معاينة مطابقة للملف الذي سيُطبع/يُحمَّل.', 'This preview matches the printed/downloaded file.')}</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {/* Certificate — landscape A4 ratio, grows with items; content stays inside the frame */}
                <div ref={certRef} style={{ position: 'relative', width: '100%', maxWidth: '1040px', minHeight: '735px', background: '#fff', color: BRAND.charcoal, margin: '0 auto', fontFamily: "'Cairo', sans-serif", direction: isAr ? 'rtl' : 'ltr', padding: '16px' }}>
                    {/* frame */}
                    <div style={{ position: 'absolute', inset: '16px', border: `3px solid ${BRAND.gold}`, boxShadow: `inset 0 0 0 3px #fff, inset 0 0 0 5px ${BRAND.charcoal}`, pointerEvents: 'none' }} />
                    {/* dark corners */}
                    <div style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: 0, height: 0, borderTop: `84px solid ${BRAND.charcoal}`, borderInlineStart: '84px solid transparent' }} />
                    <div style={{ position: 'absolute', bottom: '16px', insetInlineStart: '16px', width: 0, height: 0, borderBottom: `84px solid ${BRAND.charcoal}`, borderInlineEnd: '84px solid transparent' }} />
                    {/* guarantee badge */}
                    <div style={{ position: 'absolute', top: '34px', insetInlineStart: '38px', width: '74px', height: '74px', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #f6dd94, ${BRAND.gold})`, border: `3px solid ${BRAND.charcoal}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: BRAND.charcoal, fontWeight: 800, lineHeight: 1, zIndex: 3 }}>
                        <span style={{ fontSize: '16px' }}>100%</span><span style={{ fontSize: '9px', marginTop: '2px' }}>{t('ضمان', 'GUARANTEE')}</span>
                    </div>
                    {/* watermark (centered) */}
                    <img src="/assets/images/logo-silver.webp" alt="" style={{ position: 'absolute', top: '50%', insetInlineStart: '50%', transform: 'translate(-50%,-50%)', width: '42%', opacity: 0.1, pointerEvents: 'none', zIndex: 0 }} />

                    {/* content (inside the frame) */}
                    <div style={{ position: 'relative', zIndex: 2, padding: '26px 44px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <img src="/logo.png" alt="" style={{ height: '32px' }} />
                                <span style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '1px' }}>Z.ELECTRONIC</span>
                            </div>
                            <div style={{ width: '110px', height: '3px', background: BRAND.gold, margin: '7px auto 0', borderRadius: '2px' }} />
                            <h1 style={{ fontSize: '27px', fontWeight: 800, marginTop: '9px' }}>{t('شهادة ضمان', 'WARRANTY CERTIFICATE')}</h1>
                            <p style={{ fontSize: '13px', color: '#7a6f58' }}>({t('مرتبطة بالفاتورة', 'LINKED TO INVOICE')})</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                            {[[t('رقم الشهادة', 'Certificate No.'), certNo], [t('تاريخ الإصدار', 'Issue Date'), issued], [t('رقم الفاتورة', 'Invoice No.'), invoiceNo]].map(([k, v], i) => (
                                <div key={i} style={{ background: '#faf6ec', border: `1px solid ${BRAND.gold}55`, borderRadius: '9px', padding: '5px 12px', fontSize: '11.5px' }}>
                                    <span style={{ color: '#9a8a66', marginInlineEnd: '5px' }}>{k}:</span><strong>{v}</strong>
                                </div>
                            ))}
                        </div>
                        <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px' }}>
                            <span style={{ color: '#7a6f58' }}>{t('اسم العميل:', 'Customer:')} </span><strong style={{ fontSize: '16px' }}>{customerName || '____________________'}</strong>
                        </p>

                        {/* ── per-item warranty table (each item = its own case) ── */}
                        <h3 style={{ fontSize: '15px', marginTop: '14px', marginBottom: '6px', textAlign: 'center' }}>{t('البنود المشمولة بالضمان (كل بند بحالته)', 'Covered items (each item separately)')}</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BRAND.gold}55`, textAlign: isAr ? 'right' : 'left' }}>
                            <thead><tr>
                                <th style={{ ...th, width: '34px' }}>#</th>
                                <th style={th}>{t('البند', 'Item')}</th>
                                <th style={{ ...th, width: '60px' }}>{t('الكمية', 'Qty')}</th>
                                <th style={{ ...th, width: '150px' }}>{t('مدة الضمان', 'Warranty')}</th>
                                <th style={{ ...th, width: '160px' }}>{t('النوع', 'Type')}</th>
                            </tr></thead>
                            <tbody>
                                {itemRows.map((it, i) => (
                                    <tr key={i} style={{ background: i % 2 ? '#fcf9f1' : '#fff' }}>
                                        <td style={td}>{i + 1}</td>
                                        <td style={{ ...td, fontWeight: 600 }}>{it.name}</td>
                                        <td style={td}>{it.qty} {it.unit}</td>
                                        <td style={{ ...td, fontWeight: 700, color: BRAND.gold }}>{it.isUsed ? t('3 إلى 6 شهور', '3–6 months') : t('12 شهر', '12 months')}</td>
                                        <td style={td}>{it.isUsed ? t('مستعمل / استيراد / طرف ثالث', 'Used / Imported / 3rd-party') : t('جديد / مملوك بالكامل', 'New / Fully-owned')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* conditions legend (compact) */}
                        <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#5a5048', background: '#faf6ec', border: `1px solid ${BRAND.gold}33`, borderRadius: '8px', padding: '8px 12px', lineHeight: 1.6 }}>
                            <strong style={{ color: BRAND.charcoal }}>{t('الشروط:', 'Conditions:')}</strong>{' '}
                            {t('إصلاح مجاني ودعم عن بُعد لكل البنود. الجديد/المملوك: العميل يتحمل قطع الغيار ورسوم الزيارة الميدانية (للهاردوير). المستعمل/المستورد/طرف ثالث: يتحمل كذلك أي رسوم أطراف ثالثة. يشمل الضمان السوفت وير والهاردوير — الجديد والمستورد.',
                                'Free repair & remote support for all items. New/owned: customer bears spare parts & on-site fees (hardware). Used/imported/3rd-party: also bears any third-party charges. Covers software & hardware — new and imported.')}
                        </div>

                        {/* footer: QR • seal • signature */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px' }}>
                            <a href={COMPANY.policyUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>
                                {qr && <img src={qr} alt="QR" style={{ width: '70px', height: '70px', border: `2px solid ${BRAND.gold}55`, borderRadius: '8px', padding: '3px', background: '#fff' }} />}
                                <div style={{ fontSize: '10px', fontWeight: 700, color: BRAND.gold, marginTop: '3px' }}>▸ {t('انقر للاطلاع على سياسة الضمان', 'Tap for warranty policy')}</div>
                            </a>
                            <img src="/assets/images/seal.webp" alt={t('ختم الشركة', 'Seal')} style={{ width: '96px', height: '96px', objectFit: 'contain', transform: 'rotate(-8deg)' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: 'cursive', fontSize: '24px', lineHeight: 1 }}>Zidan</div>
                                <div style={{ borderTop: `1.5px solid ${BRAND.gold}`, width: '150px', marginTop: '4px', paddingTop: '4px', fontSize: '12px', fontWeight: 700 }}>{t('المدير التنفيذي', 'CEO')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
