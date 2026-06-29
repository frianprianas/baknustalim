const haditsService = require('../services/haditsService');
const aiService = require('../services/aiService');

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

/**
 * Helper function to extract 3 main keywords from a question string for hadith search.
 */
function extractKeywords(question) {
  const finalStopWords = [
    'bolehkah', 'apakah', 'bagaimana', 'hukumnya', 'hukum', 'tentang', 
    'dengan', 'dan', 'di', 'ke', 'yang', 'saya', 'kami', 'kita', 'ada', 
    'adakah', 'ini', 'itu', 'adalah', 'untuk', 'saja', 'atau', 'dalam', 
    'dari', 'pada', 'bisa', 'kah', 'apakah', 'apa', 'bagaimanakah'
  ];
  let words = question.toLowerCase()
    .replace(/[?,.!\-"']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !finalStopWords.includes(w));
  return words.slice(0, 3).join(' ');
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

exports.getTanya = async (req, res) => {
  res.render('hadits/tanya', {
    title: 'Tanya Hadits AI',
    pertanyaan: '',
    jawaban: null,
    referensi: [],
    error: null,
    path: '/hadits/tanya'
  });
};

exports.postTanya = async (req, res) => {
  const { pertanyaan } = req.body;
  if (!pertanyaan || pertanyaan.trim() === '') {
    return res.render('hadits/tanya', {
      title: 'Tanya Hadits AI',
      pertanyaan: '',
      jawaban: null,
      referensi: [],
      error: 'Pertanyaan tidak boleh kosong.',
      path: '/hadits/tanya'
    });
  }

  let jawaban = null;
  let referensi = [];
  let error = null;

  try {
    // 1. Ekstrak keyword dari pertanyaan
    const keyword = extractKeywords(pertanyaan);
    
    // 2. Cari hadits relevan
    if (keyword.trim()) {
      const data = await haditsService.searchHadits(keyword.trim(), 1, 5);
      referensi = data.results;
      
      // Fallback jika tidak ada hadits sama sekali
      if (referensi.length === 0) {
        const firstWord = keyword.split(' ')[0];
        if (firstWord) {
          const fallbackData = await haditsService.searchHadits(firstWord, 1, 5);
          referensi = fallbackData.results;
        }
      }
    }

    // 3. Generate jawaban dengan AI menggunakan referensi hadits
    jawaban = await aiService.generateHaditsAnswer(pertanyaan, referensi);
  } catch (err) {
    error = 'Gagal memproses pertanyaan Anda menggunakan AI. Pastikan server AI aktif.';
    console.error(err);
  }

  res.render('hadits/tanya', {
    title: 'Tanya Hadits AI',
    pertanyaan,
    jawaban,
    referensi,
    error,
    path: '/hadits/tanya'
  });
};

