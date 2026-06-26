const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  mailcow_email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  nama: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['siswa', 'guru', 'tu', 'admin'],
    default: 'siswa'
  },
  nis: {
    type: String,
    default: null,
    trim: true
  },
  nip: {
    type: String,
    default: null,
    trim: true
  },
  kelas_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kelas',
    default: null
  },
  is_guru_pai: {
    type: Boolean,
    default: false
  },
  last_synced_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
