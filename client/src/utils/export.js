// CSV + filename helpers. No external deps.

const escapeCell = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function toCSV(rows, headers) {
  const head = headers.map(h => h.label);
  const body = rows.map(row => headers.map(h => escapeCell(typeof h.accessor === 'function' ? h.accessor(row) : row[h.accessor])));
  return [head.join(','), ...body.map(r => r.join(','))].join('\n');
}

export function downloadCSV(filename, rows, headers) {
  const csv = toCSV(rows, headers);
  // BOM so Excel renders unicode correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function dateStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
