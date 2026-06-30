const mongoose = require('mongoose');

const MateriIslamSchema = new mongoose.Schema({
  kategori: {
    type: String,
    enum: ['akhlak', 'fiqih_ibadah', 'aqidah'],
    required: true
  },
  judul: {
    type: String,
    required: true,
    trim: true
  },
  konten: {
    type: String,
    required: true
  },
  guru_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MateriIslam', MateriIslamSchema);
