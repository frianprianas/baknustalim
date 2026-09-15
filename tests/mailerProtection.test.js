const fs = require('fs');
const path = require('path');

console.log('--- MENJALANKAN UJI INTEGRITAS LAYANAN EMAIL (MAILER PROTECTION TEST) ---');

let hasError = false;

// 1. Verify mailerService exports and config
try {
  const mailerService = require('../src/services/mailerService');
  
  if (typeof mailerService.sendNotification !== 'function') {
    console.error('❌ FAIL: sendNotification TIDAK DITEMUKAN atau bukan fungsi!');
    hasError = true;
  } else {
    console.log('✅ PASS: sendNotification tersedia dan aktif.');
  }

  if (typeof mailerService.sendBookmarkNotification !== 'function') {
    console.error('❌ FAIL: sendBookmarkNotification TIDAK DITEMUKAN atau bukan fungsi!');
    hasError = true;
  } else {
    console.log('✅ PASS: sendBookmarkNotification tersedia dan aktif.');
  }
} catch (err) {
  console.error('❌ FAIL: Gagal memuat mailerService:', err.message);
  hasError = true;
}

// 2. Verify TLS rejectUnauthorized: false is preserved in mailerService.js
const mailerSource = fs.readFileSync(path.join(__dirname, '../src/services/mailerService.js'), 'utf8');
if (!mailerSource.includes('rejectUnauthorized: false')) {
  console.error('❌ FAIL: rejectUnauthorized: false DIHAPUS dari mailerService.js! Ini wajib ada.');
  hasError = true;
} else {
  console.log('✅ PASS: Konfigurasi TLS rejectUnauthorized: false aman.');
}

if (!mailerSource.includes('admin@smk.baktinusantara666.sch.id') || !mailerSource.includes('buhun666')) {
  console.error('❌ FAIL: Kredensial default admin@smk.baktinusantara666.sch.id / buhun666 diusik!');
  hasError = true;
} else {
  console.log('✅ PASS: Kredensial SMTP default aman.');
}

// 3. Verify quranController calls sendBookmarkNotification
const quranControllerSource = fs.readFileSync(path.join(__dirname, '../src/controllers/quranController.js'), 'utf8');
if (!quranControllerSource.includes('sendBookmarkNotification')) {
  console.error('❌ FAIL: Pemanggilan sendBookmarkNotification di quranController.js DIHAPUS atau DIUSIK!');
  hasError = true;
} else {
  console.log('✅ PASS: Notifikasi email bookmark di Web Controller (quranController.js) aktif.');
}

// 4. Verify apiQuranController calls sendBookmarkNotification
const apiQuranSource = fs.readFileSync(path.join(__dirname, '../src/controllers/apiQuranController.js'), 'utf8');
if (!apiQuranSource.includes('sendBookmarkNotification')) {
  console.error('❌ FAIL: Pemanggilan sendBookmarkNotification di apiQuranController.js DIHAPUS atau DIUSIK!');
  hasError = true;
} else {
  console.log('✅ PASS: Notifikasi email bookmark di API Flutter (apiQuranController.js) aktif.');
}

console.log('------------------------------------------------------------------------');
if (hasError) {
  console.error('🚨 INTEGRITAS LAYANAN EMAIL GAGAL! Ada bagian pengiriman email yang diusik!');
  process.exit(1);
} else {
  console.log('🎉 SEMUA PEMERIKSAAN LULUS: Sistem pengiriman email terlindungi dan 100% utuh.');
  process.exit(0);
}
