const mongoose = require('mongoose');

const schoolSettingSchema = new mongoose.Schema({
  nama_sekolah: { type: String, default: 'SMK Bakti Nusantara 666' },
  alamat: { type: String, default: 'Jalan Raya Cileunyi No. 666, Bandung' },
  email: { type: String, default: 'info@smkbn666.sch.id' },
  kepala_sekolah: { type: String, default: 'H. M. Umar, S.Pd., M.M.' },
  logo_base64: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('SchoolSetting', schoolSettingSchema);
