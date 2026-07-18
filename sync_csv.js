const fs = require('fs');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Kelas = require('./src/models/Kelas');

async function syncCsv() {
  await connectDB();
  const csvPath = './XII_PPLG.csv';
  
  try {
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n');
    const tahunAjaran = "2024/2025"; // Assume current academic year
    
    // First line is header: no;NIS;Nama;Kelas;EMAIL;PASSWORD
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(';');
      if (parts.length < 6) continue;
      
      const [no, nis, nama, kelasName, email, password] = parts;
      
      // Upsert Kelas
      let kelas = await Kelas.findOne({ nama_kelas: kelasName, tahun_ajaran: tahunAjaran });
      if (!kelas) {
        kelas = new Kelas({
          nama_kelas: kelasName,
          jurusan: 'PPLG',
          tahun_ajaran: tahunAjaran
        });
        await kelas.save();
        console.log(`Created new class: ${kelasName}`);
      } else {
        if (kelas.jurusan !== 'PPLG') {
           kelas.jurusan = 'PPLG';
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
        console.log(`Inserted user: ${nama}`);
      } else {
        user.nama = nama;
        user.nis = nis;
        user.kelas_id = kelas._id;
        await user.save();
        console.log(`Updated user: ${nama}`);
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
