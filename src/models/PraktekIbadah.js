const mongoose = require('mongoose');

const PraktekIbadahSchema = new mongoose.Schema({
  nis: {
    type: String,
    required: true,
    trim: true
  },
  siswa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tanggal: {
    type: Date,
    default: Date.now,
    required: true
  },
  jenis_ibadah_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JenisIbadah',
    required: true
  },
  status: {
    type: String,
    enum: ['Kompeten', 'Belum Kompeten'],
    required: true
  },
  guru_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  catatan: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PraktekIbadah', PraktekIbadahSchema);
