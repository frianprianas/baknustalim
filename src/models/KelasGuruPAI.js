const mongoose = require('mongoose');

const KelasGuruPAISchema = new mongoose.Schema({
  kelas_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kelas',
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

// Ensure a teacher is mapped to a class only once
KelasGuruPAISchema.index({ kelas_id: 1, guru_id: 1 }, { unique: true });

module.exports = mongoose.model('KelasGuruPAI', KelasGuruPAISchema);
