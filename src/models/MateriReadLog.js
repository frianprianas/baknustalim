const mongoose = require('mongoose');

const MateriReadLogSchema = new mongoose.Schema({
  siswa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  materi_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MateriIslam',
    required: true
  }
}, {
  timestamps: true
});

// A student can log reading a specific article only once for points
MateriReadLogSchema.index({ siswa_id: 1, materi_id: 1 }, { unique: true });

module.exports = mongoose.model('MateriReadLog', MateriReadLogSchema);
