const mongoose = require('mongoose');

const HafalanSchema = new mongoose.Schema({
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
  surah_number: {
    type: Number,
    required: true
  },
  surah_nama: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Kompeten', 'Belum Kompeten'],
    required: true
  },
  nip_penilai: {
    type: String,
    required: true,
    trim: true
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

module.exports = mongoose.model('Hafalan', HafalanSchema);
