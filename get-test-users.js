const connectDB = require('./src/config/db');
const User = require('./src/models/User');

async function getTestUsers() {
  await connectDB();
  try {
    const roles = ['admin', 'tu', 'guru', 'siswa'];
    for (const role of roles) {
      const sample = await User.findOne({ role });
      if (sample) {
        console.log(`Sample [${role.toUpperCase()}]:`);
        console.log(`  Name:  ${sample.nama}`);
        console.log(`  Email: ${sample.mailcow_email}`);
        console.log(`  NIS:   ${sample.nis || '-'}`);
        console.log(`  NIP:   ${sample.nip || '-'}`);
      } else {
        console.log(`No sample for [${role.toUpperCase()}]`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

getTestUsers();
