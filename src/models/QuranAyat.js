const mongoose = require('mongoose');

const QuranAyatSchema = new mongoose.Schema({
  surah_number: {
    type: Number,
    required: true
  },
  ayat_number: {
    type: Number,
    required: true
  },
  teks_arab: {
    type: String,
    required: true
  },
  teks_terjemahan_id: {
    type: String,
    required: true
  },
  teks_latin: {
    type: String,
    default: ''
  },
  teks_tajweed: {
    type: String,
    default: ''
  },
  tafsir: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index for fast querying per surah and page
QuranAyatSchema.index({ surah_number: 1, ayat_number: 1 }, { unique: true });

module.exports = mongoose.model('QuranAyat', QuranAyatSchema);
