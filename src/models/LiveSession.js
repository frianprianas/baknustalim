const mongoose = require('mongoose');

const LiveSessionSchema = new mongoose.Schema({
  guru_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nama_guru: {
    type: String,
    required: true
  },
  nama_room: {
    type: String,
    required: true,
    unique: true
  },
  topik: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['aktif', 'selesai'],
    default: 'aktif'
  },
  waktu_mulai: {
    type: Date,
    default: Date.now
  },
  waktu_selesai: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LiveSession', LiveSessionSchema);
