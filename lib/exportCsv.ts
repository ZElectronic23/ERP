// lib/exportCsv.ts — client-side CSV export that opens cleanly in Excel (UTF-8 BOM, Arabic-safe)

function esc(v: unknown): string {
    const s = v == null ? '' : String(v);
    // quote if it contains comma, quote, newline or a leading = (Excel formula-injection guard)
    if (/[",\n\r]/.test(s) || /^[=+\-@]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

/**
 * Download rows as a CSV file that Excel opens with correct Arabic.
 * @param filename without extension
 * @param headers column headers
 * @param rows array of row arrays (same order as headers)
 */
export function downloadCsv(filename: string, headers: (string | number)[], rows: (string | number | null | undefined)[][]) {
    const lines = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))];
    const csv = '﻿' + lines.join('\r\n'); // BOM so Excel detects UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
