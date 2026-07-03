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
  },
  bacaan: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    user_name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    },
    surah_name: {
      type: String,
      required: true
    },
    ayat_number: {
      type: Number,
      required: true
    },
    waktu: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('NgajiSession', NgajiSessionSchema);
