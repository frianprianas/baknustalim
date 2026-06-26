const mongoose = require('mongoose');

const JenisIbadahSchema = new mongoose.Schema({
  nama_ibadah: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  deskripsi: {
    type: String,
    default: '',
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('JenisIbadah', JenisIbadahSchema);
