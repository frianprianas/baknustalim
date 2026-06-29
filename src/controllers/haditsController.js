const haditsService = require('../services/haditsService');
const aiService = require('../services/aiService');
const webSearchService = require('../services/webSearchService');

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
 * Helper function to extract the most relevant topic keywords from a question.
 * Uses an expanded stopword list that removes question words, time words, and filler words
 * so that the actual Islamic topic (sahur, wudhu, zakat, etc.) is always prioritized.
 */
function extractKeywords(question) {
  const stopWords = new Set([
    // Question words
    'apakah', 'bolehkah', 'bagaimana', 'bagaimanakah', 'kapankah', 'kapan',
    'siapakah', 'siapa', 'mengapa', 'kenapa', 'dimanakah', 'dimana',
    'adakah', 'bisakah', 'dapatkah', 'haruskah', 'perlukah',
    // Filler / structural words
    'yang', 'dan', 'atau', 'juga', 'serta', 'untuk', 'agar', 'supaya',
    'dengan', 'dalam', 'pada', 'dari', 'oleh', 'karena', 'sebab',
    'ini', 'itu', 'tersebut', 'adalah', 'ialah', 'merupakan',
    'saya', 'kami', 'kita', 'anda', 'kamu', 'dia', 'mereka',
    'ada', 'tidak', 'bisa', 'dapat', 'harus', 'perlu', 'mau', 'akan',
    'sudah', 'sudahkah', 'belum', 'pernah', 'sering', 'selalu',
    'sangat', 'sangatlah', 'lebih', 'paling', 'terlalu',
    // Time/context words that are too generic
    'waktu', 'saat', 'ketika', 'kali', 'setelah', 'sebelum', 'selama',
    'terbaik', 'baik', 'benar', 'tepat', 'sesuai', 'boleh', 'haram', 'halal',
    'tentang', 'mengenai', 'terkait', 'hal', 'cara', 'hukum', 'hukumnya'
  ]);

  // Strip Indonesian verb prefixes: berkurban->kurban, berwudhu->wudhu
  const stripPrefix = (word) => {
    const prefixes = ['menge','memper','diper','ber','ter','mem','men','meng','me','ke','se'];
    for (const pfx of prefixes) {
      if (word.startsWith(pfx) && word.length > pfx.length + 2) return word.slice(pfx.length);
    }
    return word;
  };

  const words = question.toLowerCase()
    .replace(/[?,.\/!\-"']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .map(stripPrefix)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const unique = [...new Set(words)];
  return unique.slice(0, 2).join(' ');
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

// In-memory store for background AI jobs and user limits
const activeJobs = {};
const userLimits = {};

exports.postTanya = async (req, res) => {
  // Deprecated for direct EJS form submission, we now use API + polling
  res.redirect('/hadits/tanya');
};

exports.postTanyaApi = async (req, res) => {
  const { pertanyaan } = req.body;
  if (!pertanyaan || pertanyaan.trim() === '') {
    return res.status(400).json({ success: false, error: 'Pertanyaan tidak boleh kosong.' });
  }

  // Rate Limiting: Max 2 questions per user per day
  // Fix identifier: check mailcow_email, _id, or real client IP (x-forwarded-for) to prevent Docker NAT issues
  const userIdentifier = (req.session && req.session.user && (req.session.user.mailcow_email || req.session.user._id || req.session.user.email)) 
    || req.headers['x-forwarded-for'] 
    || req.ip 
    || 'anonymous';
  const todayDate = new Date().toISOString().split('T')[0];
  const limitKey = `${userIdentifier}_${todayDate}`;

  if (!userLimits[limitKey]) {
    userLimits[limitKey] = 0;
  }

  if (userLimits[limitKey] >= 2) {
    return res.status(429).json({ 
      success: false, 
      error: 'Batas harian tercapai. Setiap akun hanya dapat mengajukan 2 pertanyaan Tanya Hadits AI per hari. Silakan coba lagi besok.' 
    });
  }

  // Increment usage count
  userLimits[limitKey]++;

  const jobId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
  activeJobs[jobId] = { done: false, error: null, jawaban: null, referensi: [] };

  // Run AI processing asynchronously in the background
  (async () => {
    try {
      // 1. Ekstrak keyword utama dari pertanyaan
      const keyword = extractKeywords(pertanyaan);
      let referensi = [];
      
      console.log(`[HaditsController] Question: "${pertanyaan}" → Keywords: "${keyword}"`);

      // 2. Cari hadits dengan strategi progresif
      if (keyword.trim()) {
        const data = await haditsService.searchHadits(keyword.trim(), 1, 3);
        referensi = data.results;
        console.log(`[HaditsController] Search "${keyword}" → ${referensi.length} results`);

        // Fallback ke keyword pertama/kedua jika hasil kurang dari 2
        if (referensi.length < 2) {
          const words = keyword.split(' ');
          for (const word of words) {
            if (word && word.length > 2) {
              const fb = await haditsService.searchHadits(word, 1, 3);
              console.log(`[HaditsController] Fallback "${word}" → ${fb.results.length} results`);
              if (fb.results.length > referensi.length) {
                referensi = fb.results;
              }
              if (referensi.length >= 2) break;
            }
          }
        }
      }

      // 3. Generate jawaban dengan AI menggunakan referensi hadits
      const jawaban = await aiService.generateHaditsAnswer(pertanyaan, referensi);

      // 4. Cek apakah AI menyatakan hadits tidak relevan → fallback ke Wikipedia
      const isUnhelpful = /tidak (ada|menjelaskan|membahas|relevan|ditemukan|terkait|berkaitan)/i.test(jawaban) ||
                          /hadits (tidak|kurang|belum)/i.test(jawaban) ||
                          jawaban.trim().length < 80;

      let webSources = [];
      if (isUnhelpful) {
        console.log('[HaditsController] AI answer seems unhelpful, triggering web search fallback...');
        const webResult = await webSearchService.searchIslamicContext(pertanyaan, keyword || pertanyaan);
        webSources = webResult.sources || [];
        // Regenerate answer using web context if available
        if (webResult.context) {
          const enhancedJawaban = await aiService.generateHaditsAnswerWithWeb(pertanyaan, referensi, webResult.context);
          activeJobs[jobId].jawaban = enhancedJawaban;
        } else {
          activeJobs[jobId].jawaban = jawaban;
        }
      } else {
        activeJobs[jobId].jawaban = jawaban;
      }
      
      // 5. Save results to the job object
      activeJobs[jobId].referensi = referensi;
      activeJobs[jobId].webSources = webSources;
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
      referensi: job.referensi,
      webSources: job.webSources || []
    };
    delete activeJobs[jobId]; // Clean up memory
    return res.json(responseData);
  }

  // Not done yet
  return res.json({ success: true, done: false });
};

