const connectDB = require('c:\\Users\\Administrator\\Documents\\website_baknus\\BaknusTalim\\src\\config\\db');
const User = require('c:\\Users\\Administrator\\Documents\\website_baknus\\BaknusTalim\\src\\models\\User');

async function run() {
  await connectDB();
  const teachers = await User.find({ role: 'guru', is_guru_pai: true });
  teachers.forEach(t => {
    console.log(`- Nama: ${t.nama}, Email: ${t.mailcow_email}`);
  });
  process.exit(0);
}
run();
