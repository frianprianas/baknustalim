const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pertanyaan: {
    type: String,
    required: true,
    trim: true
  },
  jawaban: {
    type: String,
    default: null,
    trim: true
  },
  guru_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['belum_dijawab', 'dijawab'],
    default: 'belum_dijawab'
  },
  tanggal_dijawab: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Question', QuestionSchema);
