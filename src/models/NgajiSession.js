const mongoose = require('mongoose');

const NgajiSessionSchema = new mongoose.Schema({
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creator_name: {
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
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NgajiSession', NgajiSessionSchema);
