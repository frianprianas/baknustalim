# ATURAN PENGEMBANGAN BAKNUS TA'LIM

## ⚠️ PERINGATAN KRITIS: PERLINDUNGAN SISTEM PENGIRIMAN EMAIL (MAILER SERVICE)

Layanan pengiriman email notifikasi pada aplikasi ini (**`src/services/mailerService.js`**) adalah **KOMPONEN KRITIS YANG DILINDUNGI**.

### Aturan Baku untuk Semua AI Agent & Pengembang:
1. **DILARANG MENGUSIK / MENGHAPUS LAYANAN EMAIL:**
   - Dilarang keras menghapus, mematikan (*bypass*), atau mengubah fungsi:
     - `sendNotification(to, subject, title, bodyHtml)`
     - `sendBookmarkNotification(user, surahNumber, ayatNumber, catatan)`
   - Dilarang menghapus pemanggilan `mailerService.sendBookmarkNotification` di:
     - `src/controllers/quranController.js` (Web App Bookmark)
     - `src/controllers/apiQuranController.js` (Mobile / Flutter API Bookmark)
     - Serta notifikasi pada modul Hafalan, Ibadah, Tilawah, dan Tanya Guru.

2. **KREDENSIAL & KONFIGURASI SMTP WAJIB:**
   - Host: `mail.smk.baktinusantara666.sch.id`
   - Port: `465` (SSL/TLS)
   - User: `admin@smk.baktinusantara666.sch.id`
   - Password Default: `buhun666`
   - Opsi TLS: `tls: { rejectUnauthorized: false }` **WAJIB DIPERTAHANKAN** untuk mencegah penolakan sertifikat SSL.

3. **VERIFIKASI INTEGRITAS:**
   - Setiap kali melakukan perubahan kode di repo ini, selalu pastikan integrity check email lulus dengan menjalankan:
     ```bash
     npm test
     ```
   - Jika tes ini gagal, proses deployment atau commit TIDAK BOLEH DILANJUTKAN.
