const aiService = require('../services/aiService');

// Handle requesting an AI answer draft for a student's question
exports.getDraftAnswer = async (req, res) => {
  const { pertanyaan } = req.body;
  
  if (!pertanyaan || pertanyaan.trim() === '') {
    return res.status(400).json({ success: false, message: 'Pertanyaan wajib diisi.' });
  }

  try {
    const draft = await aiService.generateDraftAnswer(pertanyaan);
    res.json({ success: true, draft });
  } catch (error) {
    console.error('[AIController] Error generating draft answer:', error);
    res.status(500).json({ success: false, message: error.message || 'Gagal menghasilkan draf jawaban.' });
  }
};

// Handle generating motivation feedback for grades (hafalan / ibadah)
exports.getFeedback = async (req, res) => {
  const { type, item, status, notes, nama_siswa } = req.body;

  if (!type || !item || !status || !nama_siswa) {
    return res.status(400).json({ success: false, message: 'Parameter evaluasi (tipe, nama siswa, status) wajib diisi.' });
  }

  try {
    const feedback = await aiService.generateFeedback({ type, item, status, notes, nama_siswa });
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('[AIController] Error generating student feedback:', error);
    res.status(500).json({ success: false, message: error.message || 'Gagal menghasilkan catatan motivasi.' });
  }
};
