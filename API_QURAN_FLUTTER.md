# Panduan Integrasi RESTful API Al-Qur'an (Flutter & Pihak Ketiga)
**Baknus Ta'lim - SMK Bakti Nusantara 666**

Dokumentasi ini dibuat khusus untuk memandu pengembang pihak ketiga (seperti aplikasi mobile Flutter/Android/iOS) dalam mengintegrasikan fitur Al-Qur'an lengkap (Teks Arab, Latin, Terjemahan, Tajwid, Audio/Sound Murottal, Tafsir Kemenag, dan Sinkronisasi Bookmark).

---

## 1. Ringkasan Endpoint

Base URL: `https://<domain_atau_ip_server>/api/v1/quran` (atau `/api/quran`)

| Method | Endpoint | Auth? | Keterangan |
| :--- | :--- | :---: | :--- |
| `GET` | `/surah` | Tidak | Mengambil daftar 114 Surah lengkap |
| `GET` | `/surah/:number` | Opsional | Detail Surah & seluruh ayat (Arab, Latin, Arti, Tajwid, Tafsir, Audio) |
| `GET` | `/surah/:number/:ayat` | Opsional | Detail 1 ayat tertentu |
| `GET` | `/qari` | Tidak | Daftar Qari murottal yang didukung |
| `GET` | `/tajweed-guide` | Tidak | Kamus kode warna tajwid untuk Flutter RichText |
| `GET` | `/search?q=...` | Tidak | Pencarian ayat berdasarkan terjemahan / latin |
| `GET` | `/bookmarks` | **Ya** | Daftar ayat yang ditandai / disimpan user login |
| `POST` | `/bookmark` | **Ya** | Menambah / memperbarui bookmark ayat |
| `DELETE` | `/bookmark/:id` | **Ya** | Menghapus bookmark berdasarkan ID |
| `DELETE` | `/bookmark/surah/:surah/ayat/:ayat` | **Ya** | Menghapus bookmark berdasarkan nomor surah & ayat |

---

## 2. Autentikasi User (Opsional untuk Membaca, Wajib untuk Bookmark)

Untuk menyinkronkan bookmark siswa ke server sekolah:
- **Login API:** `POST /api/v1/auth/login`
  - Body (JSON):
    ```json
    {
      "email": "siswa1@smk.baktinusantara666.sch.id",
      "password": "password_siswa"
    }
    ```
  - Response:
    ```json
    {
      "success": true,
      "message": "Login berhasil.",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "668f1234...",
        "nama": "Ahmad Fauzi",
        "email": "siswa1@smk.baktinusantara666.sch.id",
        "role": "siswa",
        "nis": "222310001",
        "poin": 150
      }
    }
    ```
- Setiap kali memanggil endpoint yang butuh autentikasi (seperti bookmark), sertakan Header:
  ```http
  Authorization: Bearer <token_dari_login>
  ```

---

## 3. Detail Endpoint Al-Qur'an

### A. Daftar 114 Surah
`GET /api/v1/quran/surah`
- **Contoh Response:**
  ```json
  {
    "success": true,
    "total": 114,
    "data": [
      {
        "number": 1,
        "name_latin": "Al-Fatihah",
        "name_arabic": "الفاتحة",
        "name_translation": "Pembukaan",
        "jumlah_ayat": 7,
        "tempat_turun": "Makkiyah",
        "audio_full_preview": "https://cdn.equran.id/audio-full/Misyari-Rasyid-Al-Afasi/001.mp3"
      }
    ]
  }
  ```

---

### B. Baca Surah Lengkap
`GET /api/v1/quran/surah/:number?qari=05`
- **Query Params:** `qari` (opsional, default `05` Misyari Rasyid Al-Afasi. Nilai lain: `01` s.d. `06`).
- **Contoh Response:**
  ```json
  {
    "success": true,
    "surah": {
      "number": 1,
      "name_latin": "Al-Fatihah",
      "name_arabic": "الفاتحة",
      "name_translation": "Pembukaan",
      "jumlah_ayat": 7,
      "tempat_turun": "Makkiyah"
    },
    "qari_selected": {
      "code": "05",
      "name": "Misyari Rasyid Al-Afasi"
    },
    "audio_full": "https://cdn.equran.id/audio-full/Misyari-Rasyid-Al-Afasi/001.mp3",
    "total_ayat": 7,
    "ayat": [
      {
        "ayat_number": 1,
        "teks_arab": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        "teks_latin": "Bismillāhir-raḥmānir-raḥīm",
        "teks_terjemahan": "Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.",
        "teks_tajweed": "[h:1]بِسْمِ[/h] اللَّهِ [n]الرَّحْمَٰنِ[/n] الرَّحِيمِ",
        "tafsir": "Surat ini diawali dengan basmalah sebagai pembuka seluruh urusan...",
        "audio_per_ayah_cloud": "https://api.alquran.cloud/v1/ayah/1:1/ar.alafasy",
        "is_bookmarked": false
      }
    ]
  }
  ```

---

### C. Daftar Pilihan Qari Murottal
`GET /api/v1/quran/qari`
- **Response:**
  ```json
  {
    "success": true,
    "total": 6,
    "data": [
      { "code": "01", "name": "Abdullah Al-Juhany", "is_default": false },
      { "code": "02", "name": "Abdul Muhsin Al-Qasim", "is_default": false },
      { "code": "03", "name": "Abdurrahman As-Sudais", "is_default": false },
      { "code": "04", "name": "Ibrahim Al-Dossari", "is_default": false },
      { "code": "05", "name": "Misyari Rasyid Al-Afasi", "is_default": true },
      { "code": "06", "name": "Yasser Al-Dosari", "is_default": false }
    ]
  }
  ```

---

### D. Panduan Kode Warna Tajwid untuk Flutter
`GET /api/v1/quran/tajweed-guide`
Menyediakan daftar tag tajwid kurung siku (misal `[n]huruf[/n]` atau `[q]huruf[/q]`) beserta kode warna HEX yang disarankan untuk diaplikasikan ke `TextSpan` di Flutter:
- `[h]`: Hamzat Wasl (`#AAAAAA`)
- `[n]`: Ghunnah / Tasydid (`#169200` Hijau)
- `[m]`: Mad Panjang (`#0077D4` Biru)
- `[q]`: Qalqalah Pantul (`#D30000` Merah)
- `[i]`: Ikhfa' Samaran (`#E67E22` Oranye)
- `[p]`: Iqlab (`#26A69A` Tosca)

---

### E. Manajemen Bookmark (Tersinkron ke Database Sekolah)
1. **Ambil Bookmark Saya:**
   `GET /api/v1/quran/bookmarks` (Header: `Authorization: Bearer <token>`)
2. **Tambah / Simpan Bookmark:**
   `POST /api/v1/quran/bookmark`
   - Body:
     ```json
     {
       "surah_number": 2,
       "ayat_number": 255,
       "catatan": "Ayat Kursi - hafalan wajib"
     }
     ```
3. **Hapus Bookmark:**
   `DELETE /api/v1/quran/bookmark/:id` atau `DELETE /api/v1/quran/bookmark/surah/2/ayat/255`

---

## 4. Rekomendasi Package di Flutter

```yaml
dependencies:
  flutter:
    sdk: flutter
  dio: ^5.4.0            # Request REST API HTTP
  just_audio: ^0.9.36    # Pemutar audio murottal yang handal
  audio_session: ^0.1.18 # Manajemen session audio latar belakang
```