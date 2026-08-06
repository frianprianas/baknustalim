const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Kelas = require('./src/models/Kelas');

async function migrate() {
  await connectDB();
  const targetYear = "2026/2027";
  
  try {
    console.log("Starting DB migration for academic year 2026/2027...");
    
    // Get all classes
    const allC = await Kelas.find();
    console.log(`Found ${allC.length} classes in total.`);
    
    // Group classes by name
    const grouped = {};
    allC.forEach(c => {
      if (!grouped[c.nama_kelas]) {
        grouped[c.nama_kelas] = [];
      }
      grouped[c.nama_kelas].push(c);
    });
    
    for (const name in grouped) {
      const list = grouped[name];
      console.log(`Processing class group: "${name}"`);
      
      const targetClass = list.find(c => c.tahun_ajaran === targetYear);
      const oldClasses = list.filter(c => c.tahun_ajaran !== targetYear);
      
      if (targetClass) {
        // Target class exists (e.g. 2026/2027)
        // If there's an older version of the class, merge students and delete the old one
        for (const oldC of oldClasses) {
          console.log(`  Merging old class "${name}" (${oldC.tahun_ajaran}) ID: ${oldC._id} into target (${targetYear}) ID: ${targetClass._id}...`);
          
          // Update students in this old class
          const updateResult = await User.updateMany(
            { kelas_id: oldC._id },
            { $set: { kelas_id: targetClass._id } }
          );
          console.log(`  Updated ${updateResult.nModified || updateResult.modifiedCount} students.`);
          
          // Delete old class
          await Kelas.deleteOne({ _id: oldC._id });
          console.log(`  Deleted old class document ${oldC._id}.`);
        }
        
        // Ensure the target class has correct jurusan
        let jurusan = name.replace(/^(X|XI|XII)\s+/i, '').replace(/\s+\d+$/, '').trim();
        if (targetClass.jurusan !== jurusan) {
          targetClass.jurusan = jurusan;
          await targetClass.save();
          console.log(`  Updated jurusan for target class "${name}" to "${jurusan}".`);
        }
        
      } else {
        // Target class 2026/2027 does NOT exist (e.g. XII PPLG 1 has only 2024/2025)
        // We can safely rename the year of the oldest one to 2026/2027 (if there's only one, or process them)
        if (list.length === 1) {
          const singleC = list[0];
          console.log(`  Updating year for class "${name}" from ${singleC.tahun_ajaran} to ${targetYear}...`);
          singleC.tahun_ajaran = targetYear;
          
          let jurusan = name.replace(/^(X|XI|XII)\s+/i, '').replace(/\s+\d+$/, '').trim();
          singleC.jurusan = jurusan;
          
          await singleC.save();
        } else {
          // If there are multiple non-2026/2027 classes, merge them into the newest one and rename that one to 2026/2027
          list.sort((a, b) => b.tahun_ajaran.localeCompare(a.tahun_ajaran)); // newest first
          const mainC = list[0];
          
          console.log(`  Updating year for class "${name}" (${mainC.tahun_ajaran}) to ${targetYear} (acting as main)...`);
          mainC.tahun_ajaran = targetYear;
          let jurusan = name.replace(/^(X|XI|XII)\s+/i, '').replace(/\s+\d+$/, '').trim();
          mainC.jurusan = jurusan;
          await mainC.save();
          
          // Merge others into mainC and delete them
          for (let i = 1; i < list.length; i++) {
            const oldC = list[i];
            console.log(`  Merging old class "${name}" (${oldC.tahun_ajaran}) ID: ${oldC._id} into main ID: ${mainC._id}...`);
            const updateResult = await User.updateMany(
              { kelas_id: oldC._id },
              { $set: { kelas_id: mainC._id } }
            );
            console.log(`  Updated ${updateResult.nModified || updateResult.modifiedCount} students.`);
            await Kelas.deleteOne({ _id: oldC._id });
            console.log(`  Deleted old class document ${oldC._id}.`);
          }
        }
      }
    }
    
    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

migrate();
