/**
 * ============================================================================
 * ⚠️ PERINGATAN KRITIS / CRITICAL CORE SERVICE - JANGAN DIUSIK ATAU DIHAPUS ⚠️
 * ============================================================================
 * Layanan pengiriman email ini (mailerService) adalah FITUR UTAMA & WAJIB
 * pada aplikasi Baknus Ta'lim (termasuk notifikasi bookmark, hafalan, ibadah, dll).
 *
 * ATURAN BAKU:
 * 1. DILARANG menghapus, menonaktifkan, atau me-bypass fungsi sendNotification
 *    dan sendBookmarkNotification.
 * 2. Pengirim default adalah admin@smk.baktinusantara666.sch.id (pass: buhun666)
 *    pada host mail.smk.baktinusantara666.sch.id port 465 (SSL/TLS).
 * 3. Konfigurasi TLS { rejectUnauthorized: false } WAJIB dipertahankan.
 * 4. Jika ada perubahan controller, pastikan pemanggilan fungsi pengiriman
 *    email bookmark TETAP AKTIF baik untuk Web maupun REST API (Flutter).
 * ============================================================================
 */
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const MAIL_HOST = process.env.MAILCOW_MAIL_HOST || 'mail.smk.baktinusantara666.sch.id';
const SMTP_PORT = parseInt(process.env.MAILCOW_SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || 'admin@smk.baktinusantara666.sch.id';
const SMTP_PASS = process.env.SMTP_PASS || 'buhun666';

const SURAH_NAMES = {
  1: "Al-Fatihah (الفاتحة)", 2: "Al-Baqarah (البقرة)", 3: "Ali 'Imran (آل عمران)", 4: "An-Nisa' (النساء)",
  5: "Al-Ma'idah (المائدة)", 6: "Al-An'am (الأنعام)", 7: "Al-A'raf (الأعراف)", 8: "Al-Anfal (الأنفال)",
  9: "At-Taubah (التوبة)", 10: "Yunus (يونس)", 11: "Hud (هود)", 12: "Yusuf (يوسف)",
  13: "Ar-Ra'd (الرعد)", 14: "Ibrahim (إبراهيم)", 15: "Al-Hijr (الحجر)", 16: "An-Nahl (النحل)",
  17: "Al-Isra' (الإسراء)", 18: "Al-Kahf (الكهف)", 19: "Maryam (مريم)", 20: "Ta-Ha (طه)",
  21: "Al-Anbiya' (الأنبياء)", 22: "Al-Hajj (الحج)", 23: "Al-Mu'minun (المؤمنون)", 24: "An-Nur (النور)",
  25: "Al-Furqan (الفرقان)", 26: "Asy-Syu'ara' (الشعراء)", 27: "An-Naml (النمل)", 28: "Al-Qasas (القصص)",
  29: "Al-'Ankabut (العنكبوت)", 30: "Ar-Rum (الروم)", 31: "Luqman (لقمان)", 32: "As-Sajdah (السجدة)",
  33: "Al-Ahzab (الأحزاب)", 34: "Saba' (سبأ)", 35: "Fatir (فاطر)", 36: "Ya-Sin (يس)",
  37: "As-Saffat (الصافات)", 38: "Sad (ص)", 39: "Az-Zumar (الزمر)", 40: "Ghafir (غافر)",
  41: "Fussilat (فصلت)", 42: "Asy-Syura (الشورى)", 43: "Az-Zukhruf (الزخرف)", 44: "Ad-Dukhan (الدخان)",
  45: "Al-Jasiyah (الجاثية)", 46: "Al-Ahqaf (الأحقاف)", 47: "Muhammad (محمد)", 48: "Al-Fath (الفتح)",
  49: "Al-Hujurat (الحجرات)", 50: "Qaf (ق)", 51: "Az-Zariyat (الذاريات)", 52: "At-Tur (الطور)",
  53: "An-Najm (النجم)", 54: "Al-Qamar (القمر)", 55: "Ar-Rahman (الرحمن)", 56: "Al-Waqi'ah (الواقعة)",
  57: "Al-Hadid (الحديد)", 58: "Al-Mujadilah (المجادلة)", 59: "Al-Hasyr (الحشر)", 60: "Al-Mumtahanah (الممتحنة)",
  61: "As-Saff (الصف)", 62: "Al-Jumu'ah (الجمعة)", 63: "Al-Munafiqun (المنافقون)", 64: "At-Taghabun (التغابن)",
  65: "At-Talaq (الطلاق)", 66: "At-Tahrim (التحريم)", 67: "Al-Mulk (الملك)", 68: "Al-Qalam (القلم)",
  69: "Al-Haqqah (الحاقة)", 70: "Al-Ma'arij (المعارج)", 71: "Nuh (نوح)", 72: "Al-Jinn (الجن)",
  73: "Al-Muzzammil (المزمل)", 74: "Al-Muddassir (المدثر)", 75: "Al-Qiyamah (القيامة)", 76: "Al-Insan (الإنسان)",
  77: "Al-Mursalat (المرسلات)", 78: "An-Naba' (النبأ)", 79: "An-Nazi'at (النازعات)", 80: "'Abasa (عبس)",
  81: "At-Takwir (التكوير)", 82: "Al-Infitar (الانفطار)", 83: "Al-Mutaffifin (المطففين)", 84: "Al-Insyiqaq (الانشقاق)",
  85: "Al-Buruj (البروج)", 86: "At-Tariq (الطارق)", 87: "Al-A'la (الأعلى)", 88: "Al-Ghasyiyah (الغاشية)",
  89: "Al-Fajr (الفجر)", 90: "Al-Balad (البلد)", 91: "Asy-Syams (الشمس)", 92: "Al-Lail (الليل)",
  93: "Ad-Duha (الضحى)", 94: "Asy-Syarh (الشرح)", 95: "At-Tin (التين)", 96: "Al-'Alaq (العلق)",
  97: "Al-Qadr (القدر)", 98: "Al-Bayyinah (البينة)", 99: "Az-Zalzalah (الزلزلة)", 100: "Al-'Adiyat (العاديات)",
  101: "Al-Qari'ah (القارعة)", 102: "At-Takasur (التكاثر)", 103: "Al-'Asr (العصر)", 104: "Al-Humazah (الهمزة)",
  105: "Al-Fil (الفيل)", 106: "Quraisy (قريش)", 107: "Al-Ma'un (الماعون)", 108: "Al-Kausar (الكوثر)",
  109: "Al-Kafirun (الكافرون)", 110: "An-Nasr (النصر)", 111: "Al-Lahab (المسد)", 112: "Al-Ikhlas (الإخلاص)",
  113: "Al-Falaq (الفلق)", 114: "An-Nas (الناس)"
};

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000
});

/**
 * Send HTML notification email
 * 
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} title - Action title
 * @param {string} bodyHtml - HTML body content
 */
async function sendNotification(to, subject, title, bodyHtml) {
  try {
    const appName = "BaknusTa'lim";
    const fromAddress = `"${appName} Notifikasi" <${SMTP_USER}>`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #10b981; padding: 24px; color: white; text-align: center;">
            <h2 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">[${appName} Notifikasi]</h2>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6; background-color: #ffffff;">
            <h3 style="margin-top: 0; color: #065f46; font-size: 18px; border-bottom: 2px solid #ecfdf5; padding-bottom: 10px;">${title}</h3>
            <div style="margin-top: 15px;">
                ${bodyHtml}
            </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
            &copy; ${new Date().getFullYear()} SMK Bhakti Nusantara 666. All rights reserved.
        </div>
    </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html
    });
    console.log(`[SMTP] Email notification sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[SMTP] Failed to send email notification to ${to}: ${error.message}`);
  }
}

/**
 * Send Bookmark Al-Quran notification email
 * 
 * @param {object} user - User object containing mailcow_email/email and nama
 * @param {number|string} surahNumber - Surah number
 * @param {number|string} ayatNumber - Ayat number
 * @param {string} catatan - Optional user note
 */
async function sendBookmarkNotification(user, surahNumber, ayatNumber, catatan) {
  try {
    if (!user) {
      console.warn('[BookmarkMail] No user provided');
      return;
    }

    let email = user.mailcow_email || user.email;
    let nama = user.nama || user.name || 'Sobat Ta\'lim';

    // If email is missing and mongoose is connected, try fetching from User model
    if (!email && (user._id || user.id) && mongoose.connection.readyState === 1) {
      try {
        const User = require('../models/User');
        const foundUser = await User.findById(user._id || user.id).maxTimeMS(2000).exec();
        if (foundUser) {
          email = foundUser.mailcow_email;
          nama = foundUser.nama;
        }
      } catch (userErr) {
        console.warn('[BookmarkMail] Could not resolve user email from DB:', userErr.message);
      }
    }

    if (!email) {
      console.warn('[BookmarkMail] No recipient email found for user:', user);
      return;
    }

    const surahNum = parseInt(surahNumber) || 1;
    const ayatNum = parseInt(ayatNumber) || 1;

    // Instant lookup for surah name without database wait
    let surahName = SURAH_NAMES[surahNum] || `Surah ke-${surahNum}`;
    let teksArab = '';
    let teksTerjemahan = '';

    // Only query verse text if Mongoose is actively connected
    if (mongoose.connection.readyState === 1) {
      try {
        const QuranAyat = require('../models/QuranAyat');
        const verse = await QuranAyat.findOne({ surah_number: surahNum, ayat_number: ayatNum }).maxTimeMS(2000).exec();
        if (verse) {
          teksArab = verse.teks_arab || '';
          teksTerjemahan = verse.teks_terjemahan_id || '';
        }
      } catch (vErr) {
        // Fallback gracefully
      }
    }

    const bodyHtml = `
      <p>Halo <b>${nama}</b>,</p>
      <p>Alhamdulillah, Anda baru saja menandai (bookmark) ayat Al-Qur'an pada akun <b>Baknus Ta'lim</b> Anda:</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <div style="font-size: 16px; font-weight: bold; color: #166534; margin-bottom: 8px;">
          📖 ${surahName} : Ayat ${ayatNum}
        </div>
        ${teksArab ? `<p style="font-size: 20px; text-align: right; font-family: 'Traditional Arabic', serif; color: #1e293b; margin: 10px 0; line-height: 1.8;">${teksArab}</p>` : ''}
        ${teksTerjemahan ? `<p style="font-style: italic; color: #475569; font-size: 13px; margin: 8px 0 0 0;">"${teksTerjemahan}"</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
        <tr><td style="padding: 4px 0; font-weight: bold; width: 100px; color: #64748b;">Surah Ke:</td><td style="color: #334155;">${surahNum}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Ayat Ke:</td><td style="color: #334155;">${ayatNum}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Catatan:</td><td style="color: #334155;">${catatan ? catatan : '<em>(Tidak ada catatan)</em>'}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Waktu:</td><td style="color: #334155;">${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</td></tr>
      </table>

      <p style="margin-top: 20px; color: #334155;">Semoga menjadi amal ibadah dan istiqomah dalam membaca serta mengamalkan Al-Qur'an.</p>
    `;

    return await sendNotification(
      email,
      `[BaknusTa'lim] Notifikasi Penanda (Bookmark) ${surahName} : Ayat ${ayatNum}`,
      "Penanda (Bookmark) Al-Qur'an Berhasil Disimpan",
      bodyHtml
    );
  } catch (err) {
    console.error('[BookmarkMail] Error sending bookmark notification:', err);
  }
}


// ============================================================================
// 🛡️ RUNTIME INTEGRITY GUARD: Validasi Konfigurasi SMTP saat Aplikasi Dijalankan
// ============================================================================
(function checkEmailServiceIntegrity() {
  if (!MAIL_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('\n' + '!'.repeat(80));
    console.error('🚨 [PERINGATAN KRITIS] KONFIGURASI EMAIL SMTP BAKNUSTA\'LIM HILANG ATAU DIUSIK!');
    console.error('Host:', MAIL_HOST || 'TIDAK TERDEFINISI');
    console.error('User:', SMTP_USER || 'TIDAK TERDEFINISI');
    console.error('Pastikan SMTP_USER=admin@smk.baktinusantara666.sch.id dan SMTP_PASS=buhun666 tetap aktif!');
    console.error('!'.repeat(80) + '\n');
  } else {
    console.log(`🛡️ [EmailGuard] Layanan Notifikasi Email Aktif (${SMTP_USER} via ${MAIL_HOST}:${SMTP_PORT})`);
  }
})();

module.exports = {
  sendNotification,
  sendBookmarkNotification
};
