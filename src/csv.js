// Pembaca CSV ringkas: sokong petikan "..", pemisah , ; atau tab, dan BOM dari Excel.
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '')
  const first = text.split(/\r?\n/, 1)[0]
  const sep = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0]
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += ch }
    else if (ch === '"') q = true
    else if (ch === sep) { row.push(f); f = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = '' }
    else f += ch
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}

export function muatTurunTemplat() {
  const csv = '\uFEFFnama,kelas\nAHMAD BIN ALI,1 GALAXY\nSITI AMINAH BINTI HASSAN,1 STELLAR\n'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = 'templat_murid.csv'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
