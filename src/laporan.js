import { supabase } from './supabase'

const LBL = { gembira: 'Gembira', tenang: 'Baik / Tenang', biasa: 'Biasa', risau: 'Risau', sedih: 'Sedih', marah: 'Marah' }
const KEYS = Object.keys(LBL)
const ORD = ['Perlu Kaunseling', 'Baharu', 'Dalam Pemantauan', 'Tindakan Susulan', 'Selesai']
const sum = m => KEYS.reduce((a, k) => a + (m[k] || 0), 0)
const pct = (n, all) => (all ? ((n / all) * 100).toFixed(1) : '0.0') + '%'
const tarikh = d => d.split('-').reverse().join('/')

// Semua data diambil melalui fungsi agregat / RLS (hanya GBK boleh membaca amaran)
async function kumpul(from, to) {
  const [s, t, p, a] = await Promise.all([
    supabase.rpc('emotion_summary', { p_from: from, p_to: to }),
    supabase.rpc('emotion_trend', { p_from: from, p_to: to }),
    supabase.rpc('participation_summary', { p_date: to }),
    supabase.from('referral_alerts').select('alert_date,status,action_notes,students(name,class)').order('alert_date', { ascending: false }).limit(1000),
  ])
  for (const r of [s, t, p, a]) if (r.error) throw r.error
  const tot = {}, byClass = {}, byDay = {}
  ;(s.data || []).forEach(r => { const n = Number(r.total); tot[r.emotion] = (tot[r.emotion] || 0) + n; byClass[r.class] = byClass[r.class] || {}; byClass[r.class][r.emotion] = n })
  ;(t.data || []).forEach(r => { byDay[r.day] = byDay[r.day] || {}; byDay[r.day][r.emotion] = Number(r.total) })
  const amaran = (a.data || []).filter(r => r.alert_date >= from && r.alert_date <= to)
    .sort((x, y) => ORD.indexOf(x.status) - ORD.indexOf(y.status))
  return {
    from, to, tot, all: sum(tot), amaran,
    kelas: Object.keys(byClass).sort().map(c => [c, byClass[c]]),
    hari: Object.keys(byDay).sort().map(d => [d, byDay[d]]),
    part: p.data?.[0] || { total: 0, done: 0, pending: 0 },
    perlu: amaran.filter(r => r.status === 'Perlu Kaunseling').length,
  }
}

const rEmosi = d => KEYS.map(k => [LBL[k], d.tot[k] || 0, pct(d.tot[k] || 0, d.all)])
const rKelas = d => d.kelas.map(([c, m]) => [c, ...KEYS.map(k => m[k] || 0), sum(m)])
const rAmaran = d => d.amaran.map(r => [r.students?.name || '-', r.students?.class || '-', r.alert_date, r.status, r.action_notes || ''])

export async function janaPDF(from, to) {
  const d = await kumpul(from, to)
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const W = doc.internal.pageSize.getWidth()
  let y = 48
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Laporan Kesejahteraan Emosi Murid', 40, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text('EmosiCare - Unit Bimbingan dan Kaunseling, SK Telok Kalong', 40, (y += 18))
  doc.text(`Tempoh: ${tarikh(from)} hingga ${tarikh(to)}`, 40, (y += 14))
  doc.text(`Dijana: ${new Date().toLocaleString('ms-MY')}`, 40, (y += 14))
  doc.text(`Jumlah check-in: ${d.all}  |  Murid aktif: ${d.part.total}  |  Penyertaan pada ${tarikh(to)}: ${d.part.done} (${pct(d.part.done, d.part.total)})`, 40, (y += 14))
  doc.text(`Murid dalam amaran: ${d.amaran.length}  |  Perlu kaunseling: ${d.perlu}`, 40, (y += 14))
  y += 12
  const H = t => { if (y > 730) { doc.addPage(); y = 48 } doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(t, 40, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(10) }
  const T = (head, body, opt = {}) => {
    autoTable(doc, { startY: y + 8, head: [head], body: body.length ? body : [[{ content: 'Tiada rekod', colSpan: head.length }]],
      styles: { fontSize: 9 }, headStyles: { fillColor: [109, 93, 252] }, margin: { left: 40, right: 40 }, ...opt })
    y = doc.lastAutoTable.finalY + 24 }
  H('1. Ringkasan emosi keseluruhan'); T(['Emosi', 'Bilangan', 'Peratus'], rEmosi(d))
  H('2. Emosi mengikut kelas'); T(['Kelas', ...KEYS.map(k => LBL[k]), 'Jumlah'], rKelas(d))
  H('3. Murid dalam amaran / perlu kaunseling'); T(['Nama', 'Kelas', 'Tarikh', 'Status', 'Catatan GBK'], rAmaran(d), { columnStyles: { 4: { cellWidth: 150 } } })
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120)
    doc.text('SULIT - untuk kegunaan sekolah sahaja', 40, 820); doc.text(`Halaman ${i}/${n}`, W - 40, 820, { align: 'right' }) }
  doc.save(`EmosiCare_Laporan_${from}_${to}.pdf`)
}

export async function simpanExcel(from, to) {
  const d = await kumpul(from, to); const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new()
  const add = (name, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map(x => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, name) }
  add('Ringkasan', [['Laporan Kesejahteraan Emosi Murid - EmosiCare'], ['Tempoh', `${from} hingga ${to}`], ['Jumlah check-in', d.all],
    ['Murid aktif', d.part.total], [`Penyertaan pada ${to}`, d.part.done], ['Murid dalam amaran', d.amaran.length], ['Perlu kaunseling', d.perlu], [],
    ['Emosi', 'Bilangan', 'Peratus'], ...rEmosi(d)], [34, 16, 12])
  add('Mengikut Kelas', [['Kelas', ...KEYS.map(k => LBL[k]), 'Jumlah'], ...rKelas(d)], [14, ...KEYS.map(() => 14), 10])
  add('Trend Harian', [['Tarikh', ...KEYS.map(k => LBL[k]), 'Jumlah'], ...d.hari.map(([x, m]) => [x, ...KEYS.map(k => m[k] || 0), sum(m)])], [14, ...KEYS.map(() => 14), 10])
  add('Amaran Kaunseling', [['Nama', 'Kelas', 'Tarikh Amaran', 'Status', 'Catatan GBK'], ...rAmaran(d)], [36, 14, 14, 20, 50])
  XLSX.writeFile(wb, `EmosiCare_Laporan_${from}_${to}.xlsx`)
}
