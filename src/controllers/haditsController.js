const haditsService = require('../services/haditsService');

exports.getIndex = async (req, res) => {
  const q = req.query.q || '';
  let results = [];
  let error = null;

  try {
    if (q.trim()) {
      results = await haditsService.searchHadits(q.trim());
    }
  } catch (err) {
    error = 'Gagal mengambil data hadits dari server. Silakan coba lagi nanti.';
    console.error(err);
  }

  res.render('hadits/index', {
    title: 'Pencarian Hadits',
    q,
    results,
    error,
    path: '/hadits'
  });
};
