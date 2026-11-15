# EmosiCare – SK Telok Kalong
1. Supabase: projek baharu → SQL Editor → tampal `supabase/001_schema.sql` (jalankan bahagian akaun selepas cipta 3 pengguna Auth).
2. GitHub: `git init && git add . && git commit -m init`, push ke repo.
3. Netlify: Import dari GitHub. Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (anon key SAHAJA, bukan service_role).
4. Supabase > Database > Replication: aktifkan `referral_alerts` untuk notifikasi masa nyata. Aktifkan backup (PITR) di Pro plan.

5. Jalankan `supabase/001`, `002`, `003` mengikut urutan.
## Kapasiti & pengeluaran
- Anggaran ~800 murid x ~200 hari = ~160 ribu rekod setahun; PostgreSQL dengan indeks mengendalikan jutaan rekod dengan mudah.
- Statistik dikira dalam pangkalan data (bukan dimuat turun ke pelayar); senarai dihadkan 50 rekod/halaman.
- Untuk pengeluaran gunakan pelan berbayar (tiada pause, ada backup harian) dan simpan salinan `pg_dump` berkala.
