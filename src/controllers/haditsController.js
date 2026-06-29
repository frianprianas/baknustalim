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

// In-memory store for background AI jobs
const activeJobs = {};

exports.postTanya = async (req, res) => {
  // Deprecated for direct EJS form submission, we now use API + polling
  res.redirect('/hadits/tanya');
};

exports.postTanyaApi = async (req, res) => {
  const { pertanyaan } = req.body;
  if (!pertanyaan || pertanyaan.trim() === '') {
    return res.status(400).json({ success: false, error: 'Pertanyaan tidak boleh kosong.' });
  }

  const jobId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
  activeJobs[jobId] = { done: false, error: null, jawaban: null, referensi: [] };

  // Run AI processing asynchronously in the background
  (async () => {
    try {
      // 1. Ekstrak keyword dari pertanyaan
      const keyword = extractKeywords(pertanyaan);
      let referensi = [];
      
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
      const jawaban = await aiService.generateHaditsAnswer(pertanyaan, referensi);
      
      // 4. Save results to the job object
      activeJobs[jobId].jawaban = jawaban;
      activeJobs[jobId].referensi = referensi;
      activeJobs[jobId].done = true;
    } catch (err) {
      console.error('[HaditsController] Error in background AI job:', err);
      activeJobs[jobId].error = 'Gagal memproses pertanyaan Anda menggunakan AI. Pastikan server AI aktif.';
      activeJobs[jobId].done = true;
    }
  })();

  // Return job ID immediately to prevent HTTP 504 timeouts!
  res.json({ success: true, jobId });
};

exports.getTanyaStatus = async (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs[jobId];

  if (!job) {
    return res.status(404).json({ success: false, error: 'Proses tidak ditemukan atau sudah kedaluwarsa.' });
  }

  if (job.error) {
    const errorMsg = job.error;
    delete activeJobs[jobId]; // Clean up memory
    return res.json({ success: true, done: true, error: errorMsg });
  }

  if (job.done) {
    const responseData = {
      success: true,
      done: true,
      jawaban: job.jawaban,
      referensi: job.referensi
    };
    delete activeJobs[jobId]; // Clean up memory
    return res.json(responseData);
  }

  // Not done yet
  return res.json({ success: true, done: false });
};

