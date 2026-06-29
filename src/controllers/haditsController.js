const haditsService = require('../services/haditsService');

/**
 * Helper function to highlight keywords inside HTML text without affecting HTML tags.
 */
function highlightKeyword(html, keyword) {
  if (!html || !keyword) return html;
  const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = html.split(/(<[^>]+>)/g);
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  const highlightedParts = parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part; // Skip HTML tags
    }
    return part.replace(regex, '<mark class="bg-warning text-dark px-1 rounded" style="font-weight: bold;">$1</mark>');
  });
  return highlightedParts.join('');
}

exports.getIndex = async (req, res) => {
  const q = req.query.q || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  let results = [];
  let pagination = null;
  let error = null;

  try {
    if (q.trim()) {
      const data = await haditsService.searchHadits(q.trim(), page, limit);
      results = data.results.map(h => {
        if (h.terjemah) {
          h.terjemah = highlightKeyword(h.terjemah, q.trim());
        }
        return h;
      });
      pagination = data.pagination;
    }
  } catch (err) {
    error = 'Gagal mengambil data hadits dari server. Silakan coba lagi nanti.';
    console.error(err);
  }

  res.render('hadits/index', {
    title: 'Pencarian Hadits',
    q,
    results,
    pagination,
    error,
    path: '/hadits'
  });
};
