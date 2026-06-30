const mongoose = require('mongoose');

const AmalanYaumiSchema = new mongoose.Schema({
  siswa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tanggal: {
    type: Date,
    required: true
  },
  is_halangan: {
    type: Boolean,
    default: false
  },
  sholat_fardu: {
    subuh: { type: Boolean, default: false },
    dzuhur: { type: Boolean, default: false },
    ashar: { type: Boolean, default: false },
    maghrib: { type: Boolean, default: false },
    isya: { type: Boolean, default: false }
  },
  sholat_sunnah: {
    tahajud: { type: Boolean, default: false },
    duha: { type: Boolean, default: false },
    rawatib: { type: Boolean, default: false }
  },
  puasa: {
    senin: { type: Boolean, default: false },
    kamis: { type: Boolean, default: false },
    ayyamul_bidh: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Enforce unique log per student per day
AmalanYaumiSchema.index({ siswa_id: 1, tanggal: 1 }, { unique: true });

module.exports = mongoose.model('AmalanYaumi', AmalanYaumiSchema);
