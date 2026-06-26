const mongoose = require('mongoose');

const SurahSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true
  },
  name_arabic: {
    type: String,
    required: true
  },
  name_latin: {
    type: String,
    required: true
  },
  name_translation_id: {
    type: String,
    required: true
  },
  jumlah_ayat: {
    type: Number,
    required: true
  },
  tempat_turun: {
    type: String,
    required: true // "mechan" or "medinan"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Surah', SurahSchema);
