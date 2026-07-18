const fs = require('fs');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Kelas = require('./src/models/Kelas');

async function syncCsv() {
  await connectDB();
  const csvPath = './kls_xii.csv';
  
  try {
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n');
    const tahunAjaran = "2024/2025"; // Assume current academic year
    
    // Header in kls_xii.csv: no;Nama;Kelas;EMAIL
    // Some lines might have extra semicolons, but we split by ;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(';');
      if (parts.length < 4) continue;
      
      const no = parts[0].trim();
      let nama = parts[1].trim();
      // Sometimes NIS is present in another format if we reuse this, but here it's 4 cols
      let kelasName = parts[2].trim();
      let email = parts[3].trim();
      
      let nis = '';
      if (email && email.includes('@')) {
        nis = email.split('@')[0];
      }
      
      if (!nama || !kelasName || !email) continue;
      
      // Determine Jurusan
      let jurusan = kelasName.replace(/^(X|XI|XII)\s+/i, ''); // remove grade prefix
      jurusan = jurusan.replace(/\s+\d+$/, ''); // remove trailing number
      jurusan = jurusan.trim();
      
      // Upsert Kelas
      let kelas = await Kelas.findOne({ nama_kelas: kelasName, tahun_ajaran: tahunAjaran });
      if (!kelas) {
        kelas = new Kelas({
          nama_kelas: kelasName,
          jurusan: jurusan,
          tahun_ajaran: tahunAjaran
        });
        await kelas.save();
        console.log(`Created new class: ${kelasName} (Jurusan: ${jurusan})`);
      } else {
        if (kelas.jurusan !== jurusan) {
           kelas.jurusan = jurusan;
           await kelas.save();
        }
      }
      
      // Upsert User
      let user = await User.findOne({ mailcow_email: email });
      if (!user) {
        user = new User({
          mailcow_email: email,
          nama: nama,
          role: 'siswa',
          nis: nis,
          kelas_id: kelas._id
        });
        await user.save();
        console.log(`Inserted user: ${nama} (${nis})`);
      } else {
        user.nama = nama;
        if (!user.nis) user.nis = nis; // update NIS if empty
        user.kelas_id = kelas._id;
        await user.save();
        console.log(`Updated user: ${nama} (${nis})`);
      }
    }
    
    console.log('Synchronization complete.');
  } catch (err) {
    console.error('Error during synchronization:', err);
  } finally {
    process.exit(0);
  }
}

syncCsv();
