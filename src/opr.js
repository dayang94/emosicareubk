// One Page Report (OPR) UBK TesTKa - penjana PDF mengikut templat sekolah.
// Susun atur direka dalam ruang 910 x 1287 (sama seperti templat) dan ditukar kepada titik PDF (A4).
// pdf-lib dimuatkan hanya apabila PDF dijana, supaya halaman utama kekal ringan.

const W = 910, PW = 595.5, PH = 842.25, K = PW / W
const C = {
  latar: [240, 240, 240], kelabu: [224, 224, 224], ungu: [120, 41, 135], kuning: [240, 228, 30],
  label: [244, 230, 60], arc: [125, 125, 125], hitam: [25, 25, 25], putih: [255, 255, 255],
}
// pusat (x, y) dan jejari luar (px) enam bulatan gambar, mengikut templat
const BULATAN = [[95, 385, 85], [162, 572, 116], [387, 650, 127], [627, 725, 125], [780, 935, 125], [600, 1137, 150]]
const CINCIN = 9
const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']

// "2026-03-12" (+ pilihan tarikh akhir) -> "12 Mac 2026" / "12 - 14 Mac 2026" / "30 Mac - 2 April 2026"
export function tarikhMS(a, b) {
  const p = s => { const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number); return y && m && d ? { y, m, d } : null }
  const x = p(a), z = p(b)
  if (!x) return ''
  if (!z || (z.y === x.y && z.m === x.m && z.d === x.d)) return `${x.d} ${BULAN[x.m - 1]} ${x.y}`
  if (z.y === x.y && z.m === x.m) return `${x.d} - ${z.d} ${BULAN[x.m - 1]} ${x.y}`
  if (z.y === x.y) return `${x.d} ${BULAN[x.m - 1]} - ${z.d} ${BULAN[z.m - 1]} ${x.y}`
  return `${x.d} ${BULAN[x.m - 1]} ${x.y} - ${z.d} ${BULAN[z.m - 1]} ${z.y}`
}

/**
 * d: medan OPR (program_name, organizer, objective, summary, tarikh, event_time, venue, attendance,
 *    strengths, weaknesses, improvements, prepared_by, prepared_role, approved_by, approved_role)
 * a: { kpm, sekolah, ubk: Uint8Array PNG, gambar: Uint8Array[] JPEG (maks 6) }
 * Pulangan: Uint8Array PDF
 */
export async function buatOPR(d, a) {
  const pl = await import('pdf-lib')
  const { PDFDocument, StandardFonts, rgb, degrees } = pl
  const pdf = await PDFDocument.create()
  pdf.setTitle('OPR - ' + String(d.program_name || '').slice(0, 120))
  pdf.setProducer('EmosiCare')
  const page = pdf.addPage([PW, PH])
  const fR = await pdf.embedFont(StandardFonts.TimesRoman)
  const fB = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const fH = await pdf.embedFont(StandardFonts.HelveticaBold)

  const col = c => rgb(c[0] / 255, c[1] / 255, c[2] / 255)
  const X = x => x * K, Y = y => PH - y * K
  const rect = (x, y, w, h, c) => page.drawRectangle({ x: X(x), y: Y(y + h), width: w * K, height: h * K, color: col(c) })
  const disc = (cx, cy, r, c) => page.drawCircle({ x: X(cx), y: Y(cy), size: r * K, color: col(c) })

  // Fon standard hanya menyokong set WinAnsi; aksara lain (cth. emoji) diganti '?'
  const cache = new Map()
  const baik = (font, ch) => {
    const k = ch + (font === fR ? 'r' : font === fB ? 'b' : 'h')
    if (!cache.has(k)) { try { font.encodeText(ch); cache.set(k, ch) } catch { cache.set(k, '?') } }
    return cache.get(k)
  }
  const limpa = (font, s) => Array.from(String(s ?? '').replace(/\r/g, '').replace(/\t/g, ' ')).map(ch => (ch === '\n' ? ch : ch.codePointAt(0) > 0xffff || ch === '\u200d' || (ch >= '\ufe00' && ch <= '\ufe0f') ? '' : baik(font, ch))).join('')

  const bungkus = (font, size, text, w) => {
    const out = []
    for (const para of text.split('\n')) {
      const words = para.split(/\s+/).filter(Boolean)
      if (!words.length) { out.push(''); continue }
      let line = ''
      const tolak = wd => {
        // perkataan yang lebih lebar daripada baris dipecahkan ikut aksara
        while (font.widthOfTextAtSize(wd, size) > w && wd.length > 1) {
          let n = wd.length - 1
          while (n > 1 && font.widthOfTextAtSize(wd.slice(0, n), size) > w) n--
          out.push(wd.slice(0, n)); wd = wd.slice(n)
        }
        return wd
      }
      for (let wd of words) {
        const t = line ? line + ' ' + wd : wd
        if (font.widthOfTextAtSize(t, size) <= w) line = t
        else { if (line) out.push(line); line = tolak(wd) }
      }
      out.push(line)
    }
    return out
  }
  // Cari saiz fon terbesar yang memuatkan teks dalam kotak (lebar w, tinggi h, dalam titik)
  const muat = (font, text, w, h, max, min, lh = 1.26) => {
    text = limpa(font, text).trim()
    for (let s = max; s >= min - 0.01; s -= 0.5) {
      const L = bungkus(font, s, text, w)
      if (L.length * s * lh <= h) return { s, L, lh }
    }
    const s = min; let L = bungkus(font, s, text, w)
    const n = Math.max(1, Math.floor(h / (s * lh)))
    if (L.length > n) {
      L = L.slice(0, n); let last = L[n - 1]
      while (last.length && font.widthOfTextAtSize(last + '…', s) > w) last = last.slice(0, -1)
      L[n - 1] = last + '…'
    }
    return { s, L, lh }
  }
  // Teks dalam kotak (px templat). top = atas kotak; align: 'left' | 'center'
  const blok = (font, text, x, top, w, h, max, min, c, align = 'left') => {
    if (!String(text ?? '').trim()) return
    const { s, L, lh } = muat(font, text, w * K, h * K, max, min)
    L.forEach((ln, i) => {
      const base = top + (i * lh * s + 0.82 * s) / K
      const tw = font.widthOfTextAtSize(ln, s) / K
      page.drawText(ln, { x: X(align === 'center' ? x - tw / 2 : x), y: Y(base), size: s, font, color: col(c) })
    })
  }
  const tengah = (font, text, cx, base, size, c, lebarMaks) => {
    text = limpa(font, text); let s = size
    while (lebarMaks && s > 6 && font.widthOfTextAtSize(text, s) / K > lebarMaks) s -= 0.5
    page.drawText(text, { x: X(cx - font.widthOfTextAtSize(text, s) / K / 2), y: Y(base), size: s, font, color: col(c) })
  }

  // ---------- Latar ----------
  rect(0, 0, W, 1287, C.latar)
  disc(417, 383, 320, C.kelabu)                    // gelang kelabu (lengkung "ONE PAGE REPORT")
  disc(417, 383, 271, C.ungu)                      // panel ungu kiri
  rect(417, 63, 493, 640, C.kelabu)                // panel kelabu kanan (maklumat program)
  rect(560, 688, 350, 599, C.ungu)                 // kawasan ungu kanan bawah
  disc(500, 985, 270, C.latar)
  rect(455, 1235, 455, 52, C.ungu)
  rect(455, 0, 455, 92, C.ungu)                    // jalur tajuk

  // ---------- Tajuk sekolah ----------
  tengah(fH, 'SEKOLAH KEBANGSAAN TELOK KALONG', 682, 47, 16, C.putih, 400)
  tengah(fH, '(TBA2012)', 682, 78, 13, C.putih)

  // ---------- Teks lengkung "ONE PAGE REPORT (OPR)" ----------
  {
    const t = 'ONE PAGE REPORT (OPR)', cx0 = 417, cy0 = 383, R = 287
    const a0 = 152, a1 = 100
    const tot = Array.from(t).reduce((n, ch) => n + fH.widthOfTextAtSize(ch, 12), 0)
    const s = 12 * ((a0 - a1) * Math.PI / 180 * R * K) / tot
    let th = a0 * Math.PI / 180
    for (const ch of t) {
      const w = fH.widthOfTextAtSize(ch, s), mid = th - (w / 2) / (R * K), phi = mid - Math.PI / 2
      if (ch !== ' ') {
        const gx = cx0 + R * Math.cos(mid), gy = cy0 - R * Math.sin(mid)
        const ox = gx - (w / 2 / K) * Math.cos(phi), oy = gy + (w / 2 / K) * Math.sin(phi)
        page.drawText(ch, { x: X(ox), y: Y(oy), size: s, font: fH, color: col(C.arc), rotate: degrees(phi * 180 / Math.PI) })
      }
      th -= w / (R * K)
    }
  }

  // ---------- Logo ----------
  const logo = async (bytes, x, y, w, h) => {
    if (!bytes) return
    const im = await pdf.embedPng(bytes)
    const hh = h || (w * im.height) / im.width
    page.drawImage(im, { x: X(x), y: Y(y + hh), width: w * K, height: hh * K })
  }
  await logo(a.kpm, 14, 14, 172)
  await logo(a.sekolah, 54, 122, 82)
  await logo(a.ubk, 48, 215, 96, 96 * 0.99)

  // ---------- Panel ungu kiri: tarikh, masa, tempat, kehadiran ----------
  const kecil = [['Tarikh Pelaksanaan', d.tarikh, 211], ['Masa', d.event_time, 267], ['Tempat', d.venue, 323], ['Kehadiran', d.attendance, 392]]
  for (const [lbl, val, y] of kecil) {
    tengah(fB, lbl, 305, y, 12.5, C.label)
    blok(fR, val, 305, y + 7, 200, 44, 13.5, 8, C.putih, 'center')
  }

  // ---------- Panel kanan ----------
  const H1 = (t, y) => tengah(fB, t, 682, y, 13, C.ungu)
  H1('Nama Program', 124)
  blok(fR, d.program_name, 682, 128, 440, 40, 13.5, 8, C.hitam, 'center')
  H1('Anjuran', 183)
  blok(fR, d.organizer, 434, 190, 458, 95, 12.5, 8, C.hitam)
  H1('Objektif Program', 299)
  blok(fR, d.objective, 434, 306, 458, 104, 12.5, 8, C.hitam)
  H1('Rumusan Program', 422)
  blok(fR, d.summary, 440, 429, 452, 112, 12.5, 8, C.hitam)

  // ---------- Kiri bawah ----------
  const H2 = (t, y) => page.drawText(t, { x: X(22), y: Y(y), size: 12.5, font: fB, color: col(C.ungu) })
  H2('Kekuatan Program', 768); blok(fR, d.strengths, 22, 775, 452, 100, 12.5, 8, C.hitam)
  H2('Kelemahan Program', 885); blok(fR, d.weaknesses, 22, 892, 452, 100, 12.5, 8, C.hitam)
  H2('Penambahbaikan', 1007); blok(fR, d.improvements, 22, 1014, 420, 100, 12.5, 8, C.hitam)

  // ---------- Tandatangan ----------
  tengah(fB, 'Disediakan oleh:', 122, 1137, 12.5, C.hitam)
  tengah(fB, 'Disahkan oleh:', 335, 1137, 12.5, C.hitam)
  tengah(fB, '.............................', 122, 1186, 12, C.hitam)
  tengah(fB, '.............................', 335, 1186, 12, C.hitam)
  const nama = (n, p, cx, w) => blok(fB, [n, p].filter(Boolean).join('\n'), cx, 1196, w, 72, 9.5, 6.5, C.hitam, 'center')
  nama(d.prepared_by, d.prepared_role, 122, 205)
  nama(d.approved_by, d.approved_role, 335, 190)

  // ---------- Gambar bulat (dipotong dengan laluan bulatan) ----------
  const gambar = (a.gambar || []).slice(0, 6)
  // Jika kurang daripada 6 gambar, sebarkan sepanjang lengkung supaya susun atur kekal seimbang
  const pos = gambar.length === 1 ? [2] : gambar.map((_, i) => Math.round((i * 5) / (gambar.length - 1)))
  for (let i = 0; i < gambar.length; i++) {
    const [cx, cy, R] = BULATAN[pos[i]], r = R - CINCIN
    let im
    try { im = await pdf.embedJpg(gambar[i]) } catch { try { im = await pdf.embedPng(gambar[i]) } catch { im = null } }
    if (!im) continue
    const px = X(cx), py = Y(cy), rr = r * K, k = 0.5523 * rr
    page.pushOperators(
      pl.pushGraphicsState(), pl.moveTo(px + rr, py),
      pl.appendBezierCurve(px + rr, py + k, px + k, py + rr, px, py + rr),
      pl.appendBezierCurve(px - k, py + rr, px - rr, py + k, px - rr, py),
      pl.appendBezierCurve(px - rr, py - k, px - k, py - rr, px, py - rr),
      pl.appendBezierCurve(px + k, py - rr, px + rr, py - k, px + rr, py),
      pl.closePath(), pl.clip(), pl.endPath())
    const sk = Math.max((2 * rr) / im.width, (2 * rr) / im.height), w = im.width * sk, h = im.height * sk
    page.drawImage(im, { x: px - w / 2, y: py - h / 2, width: w, height: h })
    page.pushOperators(pl.popGraphicsState())
    page.drawCircle({ x: px, y: py, size: (R - CINCIN / 2) * K, borderColor: col(C.kuning), borderWidth: CINCIN * K })
  }
  return await pdf.save()
}

// ================= Pembantu pelayar =================
const slug = s => String(s || 'laporan').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'laporan'

// r: baris penuh daripada fungsi opr_get
export async function janaOPR(r) {
  const muat = async u => { const res = await fetch(u); if (!res.ok) throw new Error('Gagal memuatkan ' + u); return new Uint8Array(await res.arrayBuffer()) }
  const [kpm, sekolah, ubk] = await Promise.all([muat('/opr-kpm.png'), muat('/opr-sekolah.png'), muat('/logo-ubk.png')])
  const gambar = (r.photos || []).map(u => Uint8Array.from(atob(String(u).split(',')[1] || ''), c => c.charCodeAt(0)))
  const bytes = await buatOPR({ ...r, tarikh: tarikhMS(r.event_date, r.event_date_end) }, { kpm, sekolah, ubk, gambar })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  a.download = `OPR_${slug(r.program_name)}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// Kecilkan gambar yang dimuat naik (maks 800 px, JPEG) supaya ringan disimpan
export function kecilkanGambar(file, maks = 800, mutu = 0.8) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => {
      const s = Math.min(1, maks / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', mutu))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak dapat dibaca. Gunakan format JPG atau PNG.')) }
    img.src = url
  })
}
