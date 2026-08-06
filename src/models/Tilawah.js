const mongoose = require('mongoose');

const TilawahSchema = new mongoose.Schema({
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
  ayat_start: {
    type: Number,
    required: true
  },
  ayat_end: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Kompeten', 'Belum Kompeten'],
    required: true
  },
  nilai: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: null
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

module.exports = mongoose.model('Tilawah', TilawahSchema);
