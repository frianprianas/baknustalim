const mongoose = require('mongoose');

const KelasSchema = new mongoose.Schema({
  nama_kelas: {
    type: String,
    required: true,
    trim: true
  },
  jurusan: {
    type: String,
    trim: true
  },
  tahun_ajaran: {
    type: String,
    required: true,
    trim: true // e.g. "2025/2026"
  }
}, {
  timestamps: true
});

// Compound unique key to prevent duplicate classes in the same academic year
KelasSchema.index({ nama_kelas: 1, tahun_ajaran: 1 }, { unique: true });

module.exports = mongoose.model('Kelas', KelasSchema);
