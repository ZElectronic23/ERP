// Professional, print-ready price list / inventory report. Exports ONLY the rows passed in
// (i.e. the currently filtered set). Opens a clean A4 window → the browser's print dialog
// (preview + printer/size + Save as PDF). Sequential index, code, name, price (+ qty/stock for
// inventory). No external libraries.

interface Col { label: string; value: (row: any, i: number) => string | number; align?: string; }

function run(title: string, subtitle: string, cols: Col[], rows: any[], isAr: boolean) {
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const w = window.open('', '_blank');
    if (!w) { alert(isAr ? 'المتصفح منع النافذة — اسمح بالنوافذ المنبثقة.' : 'Popup blocked — allow popups.'); return; }
    const thead = `<tr>${cols.map(c => `<th style="text-align:${c.align || (isAr ? 'right' : 'left')}">${esc(c.label)}</th>`).join('')}</tr>`;
    const tbody = rows.map((r, i) => `<tr>${cols.map(c => `<td style="text-align:${c.align || (isAr ? 'right' : 'left')}">${esc(c.value(r, i))}</td>`).join('')}</tr>`).join('');
    w.document.write(`<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { margin: 12mm; size: A4; }
*{box-sizing:border-box} body{font-family:'Cairo','Segoe UI',sans-serif;color:#1a1a1a;background:#fff;margin:0;font-size:12px}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #DBA935;padding-bottom:8px;margin-bottom:10px}
h1{color:#9a7a1e;font-size:20px;margin:0}.sub{color:#666;font-size:12px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 8px;font-size:11px}
th{background:#f3ead2;color:#5c4a12}tr:nth-child(even) td{background:#faf7ef}
.tot{margin-top:8px;font-size:12px;color:#555;text-align:${isAr ? 'left' : 'right'}}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hd"><div><h1>Z.Electronic</h1><div class="sub">${esc(title)}</div></div><div class="sub">${esc(subtitle)}</div></div>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
<div class="tot">${isAr ? 'عدد العناصر' : 'Items'}: ${rows.length}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
}

const money = (n: any, isAr: boolean) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${isAr ? 'ج.م' : 'EGP'}`;

// Price list: index, code, name, price — for the given (filtered) products or services.
export function exportPriceList(rows: any[], kind: 'products' | 'services', language: 'ar' | 'en') {
    const isAr = language === 'ar';
    const idCol = kind === 'products' ? 'product_id' : 'service_id';
    const cols: Col[] = [
        { label: isAr ? 'م' : '#', value: (_r, i) => i + 1, align: 'center' },
        { label: isAr ? 'الكود' : 'Code', value: r => r[idCol] || '—' },
        { label: isAr ? 'الاسم' : 'Name', value: r => r.name || '—' },
        { label: isAr ? 'السعر' : 'Price', value: r => money(r.sell_price, isAr), align: isAr ? 'left' : 'right' },
    ];
    const title = isAr ? `قائمة أسعار ${kind === 'products' ? 'المنتجات' : 'الخدمات'}` : `${kind === 'products' ? 'Products' : 'Services'} price list`;
    run(title, new Date().toLocaleDateString(), cols, rows, isAr);
}

// ---- Real file download (CSV, opens in Excel). More reliable than the print window:
// no popup to be blocked, produces a saved file. UTF-8 BOM + `sep=,` hint so Arabic text
// and columns render correctly in Excel on Arabic Windows. ----
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const cell = (v: any) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = ['sep=,', headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

// Price list as a downloadable CSV/Excel file (filtered set).
export function exportPriceListCsv(rows: any[], kind: 'products' | 'services', language: 'ar' | 'en') {
    const isAr = language === 'ar';
    const idCol = kind === 'products' ? 'product_id' : 'service_id';
    const headers = [isAr ? 'م' : '#', isAr ? 'الكود' : 'Code', isAr ? 'الاسم' : 'Name', isAr ? 'السعر (ج.م)' : 'Price (EGP)'];
    const body = rows.map((r, i) => [i + 1, r[idCol] || '', r.name || '', Number(r.sell_price || 0)]);
    downloadCsv(`${kind === 'products' ? 'products' : 'services'}-pricelist-${stamp()}.csv`, headers, body);
}

// Inventory as a downloadable CSV/Excel file (products, filtered set).
export function exportInventoryCsv(rows: any[], language: 'ar' | 'en') {
    const isAr = language === 'ar';
    const headers = [isAr ? 'م' : '#', isAr ? 'الكود' : 'Code', isAr ? 'الاسم' : 'Name', isAr ? 'الفئة' : 'Category',
        isAr ? 'السعر (ج.م)' : 'Price (EGP)', isAr ? 'الكمية' : 'Qty', isAr ? 'الوحدة' : 'Unit'];
    const body = rows.map((r, i) => [i + 1, r.product_id || '', r.name || '', r.category || '',
        Number(r.sell_price || 0), Number(r.stock_quantity || 0), r.unit || '']);
    downloadCsv(`inventory-${stamp()}.csv`, headers, body);
}

// Inventory report: price list + quantity & unit (products only).
export function exportInventory(rows: any[], language: 'ar' | 'en') {
    const isAr = language === 'ar';
    const cols: Col[] = [
        { label: isAr ? 'م' : '#', value: (_r, i) => i + 1, align: 'center' },
        { label: isAr ? 'الكود' : 'Code', value: r => r.product_id || '—' },
        { label: isAr ? 'الاسم' : 'Name', value: r => r.name || '—' },
        { label: isAr ? 'الفئة' : 'Category', value: r => r.category || '—' },
        { label: isAr ? 'السعر' : 'Price', value: r => money(r.sell_price, isAr), align: isAr ? 'left' : 'right' },
        { label: isAr ? 'الكمية' : 'Qty', value: r => Number(r.stock_quantity || 0).toLocaleString(), align: 'center' },
        { label: isAr ? 'الوحدة' : 'Unit', value: r => r.unit || '—', align: 'center' },
    ];
    run(isAr ? 'تقرير المخزون' : 'Inventory report', new Date().toLocaleDateString(), cols, rows, isAr);
}
