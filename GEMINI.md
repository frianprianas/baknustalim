# ATURAN PENGEMBANGAN BAKNUS TA'LIM

## 🚨 PERINGATAN KRITIS: PERLINDUNGAN SISTEM PENGIRIMAN EMAIL (MAILER SERVICE)

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

## Lingkungan Pengembangan (Workstation Only)
4. **Hanya Workstation untuk Koding**:
   - Mesin/komputer lokal ini HANYA digunakan sebagai workstation untuk menulis, mengedit, dan me-review kode.
   - **DILARANG KERAS** menjalankan Docker (`docker`, `docker compose`, dsb.) atau service container di komputer lokal ini.
   - Jangan pernah menyarankan, mencoba mengeksekusi, atau menjalankan Docker di mesin ini.

## Deployment & Server Workflow
5. **Sinkronisasi via Git**:
   - Semua perubahan kode dan update aplikasi disinkronkan ke server melalui Git (`git commit`, `git push` ke remote repository).
   - Server yang bertanggung jawab untuk menjalankan container/service dan production runtime.

## Identitas Git Pengembang
6. **Akun & Identitas Git**:
   - Username: `frianprianas`
   - Email: `freeyhan87@hotmail.com`
   - Remote: `https://github.com/frianprianas/baknustalim.git`
   - Agent AI harus selalu menggunakan dan mengingat identitas ini untuk setiap operasi Git di workstation ini tanpa perlu ditanyakan kembali.
