// Price list / inventory reports. Three outputs, all from the currently filtered rows:
//   1) reportModel()      — plain data model the page renders as an in-app preview.
//   2) downloadReportXls() — a FORMATTED .xls (styled header, borders) that opens in Excel.
//   3) printReport()       — print / Save-as-PDF of a formatted A4 page, rendered in-app
//                            (an off-screen node + window.print), so there is a preview and
//                            no popup to be blocked. No external libraries.

export type ReportMode = 'price' | 'inventory';

export interface ReportModel {
    title: string;
    subtitle: string;
    headers: { label: string; align: 'start' | 'end' | 'center' }[];
    rows: (string | number)[][];
    count: number;
}

const money = (n: any, isAr: boolean) => `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isAr ? 'ج.م' : 'EGP'}`;

// Build the report model for the given rows.
export function reportModel(rows: any[], mode: ReportMode, kind: 'products' | 'services', language: 'ar' | 'en'): ReportModel {
    const isAr = language === 'ar';
    const idCol = kind === 'products' ? 'product_id' : 'service_id';
    if (mode === 'inventory') {
        return {
            title: isAr ? 'تقرير المخزون' : 'Inventory report',
            subtitle: new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB'),
            headers: [
                { label: isAr ? 'م' : '#', align: 'center' },
                { label: isAr ? 'الكود' : 'Code', align: 'start' },
                { label: isAr ? 'الاسم' : 'Name', align: 'start' },
                { label: isAr ? 'الفئة' : 'Category', align: 'start' },
                { label: isAr ? 'السعر' : 'Price', align: 'end' },
                { label: isAr ? 'الكمية' : 'Qty', align: 'center' },
                { label: isAr ? 'الوحدة' : 'Unit', align: 'center' },
            ],
            rows: rows.map((r, i) => [i + 1, r.product_id || '—', r.name || '—', r.category || '—', money(r.sell_price, isAr), Number(r.stock_quantity || 0).toLocaleString(), r.unit || '—']),
            count: rows.length,
        };
    }
    return {
        title: isAr ? `قائمة أسعار ${kind === 'products' ? 'المنتجات' : 'الخدمات'}` : `${kind === 'products' ? 'Products' : 'Services'} price list`,
        subtitle: new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB'),
        headers: [
            { label: isAr ? 'م' : '#', align: 'center' },
            { label: isAr ? 'الكود' : 'Code', align: 'start' },
            { label: isAr ? 'الاسم' : 'Name', align: 'start' },
            { label: isAr ? 'السعر' : 'Price', align: 'end' },
        ],
        rows: rows.map((r, i) => [i + 1, r[idCol] || '—', r.name || '—', money(r.sell_price, isAr)]),
        count: rows.length,
    };
}

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const stamp = () => new Date().toISOString().slice(0, 10);

const ROWS_PER_PAGE = 28; // rows per A4 page (header repeats on each page)

// Styled report HTML split into A4 PAGES — one <section class="page"> each, with the header
// repeated and an auto page number "Page i / n" in the footer. The SAME markup is used by the
// in-app preview and the print/PDF view, so they look identical. Excel ignores the page CSS.
function reportHtml(m: ReportModel, isAr: boolean): string {
    const align = (a: string) => a === 'center' ? 'center' : a === 'end' ? (isAr ? 'left' : 'right') : (isAr ? 'right' : 'left');
    const thead = `<tr>${m.headers.map(h => `<th style="text-align:${align(h.align)}">${esc(h.label)}</th>`).join('')}</tr>`;
    const pageCount = Math.max(1, Math.ceil(m.rows.length / ROWS_PER_PAGE));
    let pages = '';
    for (let p = 0; p < pageCount; p++) {
        const slice = m.rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
        const tbody = slice.map(r => `<tr>${r.map((c, ci) => `<td style="text-align:${align(m.headers[ci]?.align || 'start')}">${esc(c)}</td>`).join('')}</tr>`).join('');
        const pageLabel = isAr ? `صفحة ${p + 1} / ${pageCount}` : `Page ${p + 1} / ${pageCount}`;
        const totalLine = p === pageCount - 1 ? `<span class="tot">${isAr ? 'عدد العناصر' : 'Items'}: ${m.count}</span>` : '';
        pages += `<section class="page">
<div class="hd"><div><div class="brand">Z.Electronic</div><div class="ttl">${esc(m.title)}</div></div><div class="date">${esc(m.subtitle)}</div></div>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
<div class="ft">${totalLine}<span class="pg">${pageLabel}</span></div>
</section>`;
    }
    return `<div class="rep">${pages}</div>`;
}

const REPORT_CSS = `
*{box-sizing:border-box}
.rep{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;color:#1a1a1a}
.rep .page{background:#fff;color:#1a1a1a}
.rep .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #DBA935;padding-bottom:10px;margin-bottom:14px}
.rep .brand{color:#9a7a1e;font-size:22px;font-weight:bold;letter-spacing:.5px}
.rep .ttl{color:#444;font-size:14px;margin-top:2px}
.rep .date{color:#777;font-size:12px}
.rep table{width:100%;border-collapse:collapse}
.rep th,.rep td{border:1px solid #d8d2c2;padding:7px 10px;font-size:12px}
.rep th{background:#DBA935;color:#2a2410;font-weight:bold}
.rep tbody tr:nth-child(even) td{background:#faf7ef}
.rep .ft{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11px;color:#777;border-top:1px solid #eee;padding-top:6px}
.rep .tot{font-weight:bold;color:#555;font-size:12px}
.rep .pg{margin-inline-start:auto}
@media screen{.rep .page{width:794px;max-width:100%;margin:0 auto 18px;padding:28px;box-shadow:0 2px 14px rgba(0,0,0,.28);border-radius:6px}}
@media print{.rep .page{margin:0;padding:0;page-break-after:always;break-after:page}.rep .page:last-child{page-break-after:auto;break-after:auto}}
`;

// Preview HTML (CSS + paginated pages) to render in-app via dangerouslySetInnerHTML, so the
// on-screen preview is pixel-identical to the printed/PDF output.
export function reportPreviewHtml(m: ReportModel, language: 'ar' | 'en'): string {
    return `<style>${REPORT_CSS}</style>${reportHtml(m, language === 'ar')}`;
}

// Excel file as UTF-8 CSV with a BOM. Excel honours the BOM for .csv, so Arabic is ALWAYS
// correct (the HTML-.xls route garbled Arabic on Arabic-Windows Excel). Clean headers — no
// `sep=` directive line. Values are quoted when they contain separators/quotes/newlines.
export function downloadReportCsv(m: ReportModel, language: 'ar' | 'en', filenameBase: string) {
    const cell = (v: any) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [m.headers.map(h => cell(h.label)).join(','), ...m.rows.map(r => r.map(cell).join(','))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${filenameBase}-${stamp()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Build a full, standalone A4 HTML document for the report.
function reportDocument(m: ReportModel, isAr: boolean): string {
    return `<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${esc(m.title)}</title>
<style>@page{size:A4;margin:12mm}html,body{margin:0;padding:16px;background:#fff}@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}${REPORT_CSS}</style></head>
<body>${reportHtml(m, isAr)}</body></html>`;
}

// Print / Save-as-PDF. Opens the formatted report in a NEW TAB and triggers the browser's own
// print dialog there — the normal web experience: choose printer, see the preview, Save as PDF.
// Called from a user click (button), so the tab is allowed. Falls back to an in-document print
// if the browser blocks the new tab.
export function printReport(m: ReportModel, language: 'ar' | 'en') {
    if (typeof window === 'undefined') return;
    const isAr = language === 'ar';
    const html = reportDocument(m, isAr);

    const w = window.open('', '_blank');
    if (w && w.document) {
        w.document.open(); w.document.write(html); w.document.close();
        const go = () => { try { w.focus(); w.print(); } catch { /* ignore */ } };
        // give the new tab a moment to lay out before printing
        if (w.document.readyState === 'complete') setTimeout(go, 300);
        else w.onload = () => setTimeout(go, 300);
        return;
    }

    // Fallback (new tab blocked): print within this document via a print-only node.
    document.getElementById('__report_print')?.remove();
    document.getElementById('__report_print_style')?.remove();
    const style = document.createElement('style');
    style.id = '__report_print_style';
    style.textContent = `#__report_print{display:none}
@media print{html,body{background:#fff !important}body > *{display:none !important}body > #__report_print{display:block !important}@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}}
${REPORT_CSS}`;
    const root = document.createElement('div');
    root.id = '__report_print'; root.dir = isAr ? 'rtl' : 'ltr';
    root.innerHTML = reportHtml(m, isAr);
    document.body.appendChild(style); document.body.appendChild(root);
    const cleanup = () => { root.remove(); style.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 150);
    setTimeout(cleanup, 60000);
}

// ---- Back-compat thin wrappers (older call sites) ----
export function exportPriceList(rows: any[], kind: 'products' | 'services', language: 'ar' | 'en') {
    printReport(reportModel(rows, 'price', kind, language), language);
}
export function exportInventory(rows: any[], language: 'ar' | 'en') {
    printReport(reportModel(rows, 'inventory', 'products', language), language);
}
export function exportPriceListCsv(rows: any[], kind: 'products' | 'services', language: 'ar' | 'en') {
    downloadReportCsv(reportModel(rows, 'price', kind, language), language, kind === 'products' ? 'products-pricelist' : 'services-pricelist');
}
export function exportInventoryCsv(rows: any[], language: 'ar' | 'en') {
    downloadReportCsv(reportModel(rows, 'inventory', 'products', language), language, 'inventory');
}
