const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Kelas = require('./src/models/Kelas');

async function diagnose() {
  await connectDB();
  
  try {
    console.log("=== DIAGNOSIS MASTER KELAS ===");
    const classes = await Kelas.find({ nama_kelas: /PPLG/i });
    console.log(`Daftar kelas PPLG yang terdaftar di database (${classes.length} kelas):`);
    classes.forEach(c => {
      console.log(`- ID: ${c._id} | Nama: "${c.nama_kelas}" | Tahun Ajaran: "${c.tahun_ajaran}" | Jurusan: "${c.jurusan}"`);
    });

    console.log("\n=== DIAGNOSIS SISWA ===");
    // Ambil sampel siswa yang memiliki kelas_id set ke salah satu kelas PPLG
    const classIds = classes.map(c => c._id);
    const users = await User.find({ kelas_id: { $in: classIds } });
    console.log(`Jumlah siswa yang terhubung ke kelas PPLG: ${users.length}`);

    if (users.length > 0) {
      console.log("Sampel 10 siswa terhubung kelas:");
      users.slice(0, 10).forEach(u => {
        console.log(`- Nama: "${u.nama}" | Email: "${u.mailcow_email}" | Role: "${u.role}" | NIS: "${u.nis}" | Kelas ID di User: ${u.kelas_id}`);
      });
    }

    console.log("\n=== ANALISIS KESALAHAN ===");
    // Cek apakah ada siswa dengan kelas_id tetapi role-nya BUKAN 'siswa'
    const nonSiswaUsers = await User.find({ kelas_id: { $in: classIds }, role: { $ne: 'siswa' } });
    console.log(`Siswa dengan kelas PPLG yang role-nya BUKAN 'siswa': ${nonSiswaUsers.length}`);
    nonSiswaUsers.forEach(u => {
      console.log(`- Nama: "${u.nama}" | Role saat ini: "${u.role}" (Seharusnya 'siswa')`);
    });

  } catch (err) {
    console.error('Error during diagnosis:', err);
  } finally {
    process.exit(0);
  }
}

diagnose();
