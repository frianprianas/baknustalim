const mongoose = require('mongoose');

const BookmarkSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  surah_number: {
    type: Number,
    required: true
  },
  ayat_number: {
    type: Number,
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

// Ensure a user can bookmark a specific verse only once
BookmarkSchema.index({ user_id: 1, surah_number: 1, ayat_number: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', BookmarkSchema);
